# @browser-tester/cookies — Package Learnings

What the code does, how it connects, and what it consists of. Written for migration planning.

---

## What This Package Is

A cross-platform library for extracting browser cookies from the local filesystem. It reads cookie databases from **18 Chromium-based browsers**, **Firefox**, and **Safari** on **macOS, Linux, and Windows**. There are two extraction modes:

1. **SQLite extraction** — Reads the browser's SQLite cookie database directly from disk (decrypting Chromium cookie values using platform-specific key retrieval).
2. **Profile extraction via CDP** — Launches a headless browser with Chrome DevTools Protocol and calls `Network.getAllCookies` to get cookies from a specific profile.

---

## Directory Structure

```
src/
├── index.ts                    ← Public API (re-exports)
├── types.ts                    ← All interfaces and types
├── constants.ts                ← Global constants (epoch offsets, bundle IDs, browser maps)
├── jar.ts                      ← Cookie matching/filtering + Playwright/Puppeteer converters
│
├── sqlite/                     ← Direct SQLite extraction (reads cookie DB from disk)
│   ├── extract.ts              ← Main entry: extractCookies() — dispatches to browser-specific extractors
│   ├── chromium.ts             ← Chromium cookie extraction (DB path resolution, decryption, parsing)
│   ├── firefox.ts              ← Firefox cookie extraction (moz_cookies table)
│   ├── safari.ts               ← Safari binary cookie parser (Cookies.binarycookies format)
│   ├── crypto.ts               ← AES-128-CBC (macOS/Linux) and AES-256-GCM (Windows) decryption
│   ├── adapter.ts              ← SQLite query adapter (Bun vs Node runtime detection)
│   └── constants.ts            ← Browser-specific configs (cookie paths, keychain names, crypto constants)
│
├── profiles/                   ← Profile-aware extraction (detects & extracts from specific profiles)
│   ├── detector.ts             ← Detects installed browsers + their profiles across all platforms
│   ├── extract.ts              ← Profile-level extraction (dispatches Firefox/Safari/Chromium)
│   ├── cdp-client.ts           ← CDP WebSocket client (connects to headless browser, sends commands)
│   ├── cdp-extract.ts          ← Launches headless Chromium, copies profile, extracts cookies via CDP
│   └── constants.ts            ← Per-browser profile detection configs (executable paths, user data dirs)
│
└── utils/                      ← Pure helper functions
    ├── host-matching.ts        ← Domain matching logic (cookie domain vs request host)
    ├── dedupe-cookies.ts       ← Deduplicates cookies by name|domain|path key
    ├── copy-database.ts        ← Copies SQLite DB + WAL/SHM sidecars to temp dir
    ├── detect-default-browser.ts ← Detects OS default browser via bundle ID / .desktop file
    ├── browser-name-map.ts     ← Maps display names ("Google Chrome") to Browser keys ("chrome")
    ├── expand-host-candidates.ts ← Expands "a.b.c.com" → ["a.b.c.com", "b.c.com", "c.com"]
    ├── normalize-expiration.ts ← Normalizes Chrome epoch / milliseconds / bigint to Unix seconds
    ├── normalize-same-site.ts  ← Maps numeric/string sameSite values to "Strict"/"Lax"/"None"
    ├── parse-firefox-expiry.ts ← Parses Firefox expiry (bigint/string/number → seconds)
    ├── parse-profiles-ini.ts   ← Parses Firefox profiles.ini file format
    ├── format-cookie-header.ts ← Formats cookies as "name=value; ..." header string
    ├── format-warning.ts       ← Formats error warnings consistently
    ├── sql.ts                  ← SQL helpers (literal escaping, host WHERE clause builder, bool coercion)
    ├── string-field.ts         ← Safe string coercion from unknown DB row values
    ├── strip-leading-dot.ts    ← Removes leading "." from cookie domains
    └── natural-sort.ts         ← Natural string comparison for profile sorting
```

---

## Public API

Exported from `index.ts`:

| Export | What it does |
|---|---|
| `extractCookies(options)` | Main entry. Extracts cookies from specified browsers for a URL via SQLite. |
| `extractProfileCookies(options)` | Extracts cookies from a specific browser profile (CDP for Chromium, SQLite for Firefox/Safari). |
| `extractAllProfileCookies(profiles)` | Extracts cookies from multiple profiles sequentially. |
| `detectBrowserProfiles(options?)` | Detects all installed browsers and their profiles on the system. |
| `matchCookies(cookies, url)` | Filters cookies that match a given URL (domain, path, secure, expiry). |
| `matchCookieHeader(cookies, url)` | Same as matchCookies but returns a `Cookie:` header string. |
| `toPlaywrightCookies(cookies)` | Converts to Playwright's cookie format. |
| `toPuppeteerCookies(cookies)` | Converts to Puppeteer's cookie format. |
| `toCookieHeader(cookies)` | Formats cookies as `name=value; ...` string. |
| `detectDefaultBrowser()` | Returns the OS default browser as a `Browser` key. |
| `SUPPORTED_BROWSERS` | List of all supported browser keys. |

---

## Core Data Flow

### Path 1: SQLite Extraction (`extractCookies`)

```
extractCookies({ url, browsers })
  │
  ├── For each Chromium browser:
  │     resolveCookieDbPath(browser)          ← finds ~/Library/.../Cookies or ~/...Network/Cookies
  │     copyDatabaseToTemp(dbPath)            ← copies DB + WAL/SHM to temp dir (avoids lock)
  │     readMetaVersion(tempDb)               ← checks meta.version for hash prefix stripping
  │     buildDecryptor(browser, platform)     ← gets encryption key per platform:
  │     │   ├── macOS: `security find-generic-password` → PBKDF2(1003 iters) → AES-128-CBC
  │     │   ├── Linux: `secret-tool lookup` → PBKDF2(1 iter) → AES-128-CBC
  │     │   └── Windows: Local State → DPAPI → AES-256-GCM
  │     querySqlite(tempDb, sql)              ← SELECT from cookies WHERE host matches
  │     For each row:
  │       decrypt encrypted_value             ← uses buildDecryptor result
  │       normalizeExpiration(expires_utc)    ← Chrome epoch → Unix seconds
  │       normalizeSameSite(samesite)         ← numeric → "Strict"/"Lax"/"None"
  │     rmSync(tempDir)                       ← cleanup
  │
  ├── For Firefox:
  │     Find default-release profile dir
  │     copyDatabaseToTemp(cookies.sqlite)
  │     querySqlite: SELECT FROM moz_cookies WHERE host matches
  │     parseFirefoxExpiry(expiry)            ← already Unix seconds, just validate
  │
  ├── For Safari:
  │     Find Cookies.binarycookies file
  │     parseBinaryCookies(buffer)            ← custom binary format parser
  │     │   Parse pages → parse cookie records → read C-strings for name/value/domain/path
  │     │   Convert Mac epoch (978307200 offset) to Unix seconds
  │     Filter by host match
  │
  └── dedupeCookies(allCookies)              ← merge by name|domain|path
```

### Path 2: Profile Extraction (`extractProfileCookies`)

```
extractProfileCookies({ profile, port? })
  │
  ├── Firefox: same as SQLite path but reads from profile.profilePath
  ├── Safari: same as SQLite path but reads from profile.profilePath
  └── Chromium (via CDP):
        mkdtempSync → copy profile dir to temp
        Copy "Local State" file alongside
        spawn(browser.executablePath, [--headless, --remote-debugging-port, --user-data-dir, --profile-directory])
        sleep(3000ms)                         ← wait for browser startup
        getCookiesFromBrowser(port):
          fetch("http://localhost:PORT/json")  ← get CDP targets
          Find page target → get webSocketDebuggerUrl
          WebSocket → send { method: "Network.getAllCookies" }
          Parse response → CdpRawCookie[]
        Map to Cookie[]
        browser.kill()
        rmSync(tempDir)
```

### Path 3: Browser Profile Detection (`detectBrowserProfiles`)

```
detectBrowserProfiles()
  │
  ├── Chromium-based browsers (per platform):
  │     macOS: check /Applications/*.app exists
  │     Linux: check /usr/bin/*, /snap/bin/*
  │     Windows: registry lookup + Program Files scan
  │     For each found browser:
  │       getUserDataDir(platform, config)
  │       loadProfileMetadataFromLocalState(userDataDir)  ← reads "Local State" JSON
  │       readdirSync(userDataDir) → filter dirs with Preferences file
  │       Sort: last-used profile first, then natural sort
  │
  ├── Firefox:
  │     Find Firefox data dir → read profiles.ini
  │     parseProfilesIni(content) → IniProfile[]
  │     Filter to profiles with cookies.sqlite
  │
  └── Safari:
        macOS only, single "Default" profile
        Find Cookies.binarycookies file
```

---

## Key Types

```typescript
interface Cookie {
  name: string;
  value: string;
  domain: string;        // Leading dot stripped
  path: string;
  expires?: number;      // Unix epoch seconds
  secure: boolean;
  httpOnly: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  browser: Browser;      // Which browser this came from
}

type Browser = "chrome" | "edge" | "brave" | "arc" | "dia" | "helium" | "chromium"
  | "vivaldi" | "opera" | "ghost" | "sidekick" | "yandex" | "iridium" | "thorium"
  | "sigmaos" | "wavebox" | "comet" | "blisk" | "firefox" | "safari";

type ChromiumBrowser = Exclude<Browser, "firefox" | "safari">;

interface BrowserProfile {
  profileName: string;   // Directory name (e.g., "Default", "Profile 1")
  profilePath: string;   // Absolute path to profile directory
  displayName: string;   // Human-readable name from Local State
  browser: BrowserInfo;  // { name, executablePath }
  locale?: string;       // From Preferences intl.selected_languages
}
```

---

## Subsystem Details

### Chromium Cookie Decryption (`sqlite/crypto.ts`)

Three decryption paths based on platform:

| Platform | Cipher | Key Source | Key Derivation |
|---|---|---|---|
| macOS | AES-128-CBC | `security find-generic-password -w -s "Chrome Safe Storage"` | PBKDF2(password, "saltysalt", 1003 iters, sha1) |
| Linux | AES-128-CBC | `secret-tool lookup application chrome` (fallback: "peanuts") | PBKDF2(password, "saltysalt", 1 iter, sha1) |
| Windows | AES-256-GCM | Local State → `os_crypt.encrypted_key` → DPAPI via PowerShell | Direct master key from DPAPI |

Chromium cookie values are prefixed with `v10`, `v11`, etc. The prefix is stripped before decryption. After meta version 24, an additional 32-byte hash prefix is stripped from the plaintext.

### Safari Binary Cookie Parser (`sqlite/safari.ts`)

Parses Apple's proprietary `Cookies.binarycookies` format:
- Magic: `"cook"` (4 bytes)
- Page count (4 bytes BE)
- Page sizes array
- Each page: header (0x00000100) → cookie count → offsets → cookie records
- Each record: size, flags, field offsets (url, name, path, value), expiration (double LE)
- Strings are null-terminated C-strings at the specified offsets
- Expiration is Mac epoch (seconds since 2001-01-01), converted by adding `978_307_200`

### SQLite Adapter (`sqlite/adapter.ts`)

Runtime-adaptive: detects Bun vs Node and uses the appropriate SQLite API:
- Bun: `import("bun:sqlite")` → `new Database(path, { readonly: true })`
- Node: `import("node:sqlite")` → `new DatabaseSync(path, { readOnly: true, readBigInts: true })`

### CDP Profile Extraction (`profiles/cdp-extract.ts`)

For Chromium profiles, SQLite doesn't work because the cookie encryption key is tied to the profile. Instead:
1. Copy the entire profile directory + `Local State` to a temp dir
2. Launch the browser headless with `--remote-debugging-port`
3. Wait 3 seconds for startup
4. Connect via CDP WebSocket → `Network.getAllCookies`
5. Kill browser, clean up temp dir

### Profile Detection (`profiles/detector.ts`)

Platform-specific browser discovery:
- **macOS**: Checks `/Applications/*.app` existence
- **Linux**: Scans `/usr/bin`, `/usr/local/bin`, `/snap/bin`
- **Windows**: Registry query (`HKLM\SOFTWARE\...\App Paths`), then `Program Files` scan

Profile detection for Chromium: reads `Local State` JSON → `profile.info_cache` for display names, `profile.last_used` for sorting. Validates profiles by checking `Preferences` file exists.

Firefox profiles: parses `profiles.ini` (INI format) for profile paths.

---

## Dependencies

| Dependency | Usage |
|---|---|
| `@browser-tester/utils` | `execCommand`, `getEpochSeconds`, `formatError`, `sleep`, `copyDir`, `MS_PER_SECOND` |
| `default-browser` | Detects OS default browser (returns bundle ID / .desktop name) |
| `ws` | WebSocket client for CDP communication |
| `node:crypto` | PBKDF2 key derivation, AES decryption |
| `node:sqlite` / `bun:sqlite` | SQLite queries (runtime-detected) |
| `node:child_process` | Spawning headless browser for CDP extraction |
| `node:fs` | File operations (read, copy, temp dirs) |

---

## Configuration Data

The package has extensive per-browser configuration spread across two files:

### `sqlite/constants.ts` — `CHROMIUM_SQLITE_CONFIGS`

For each of 18 Chromium browsers: `cookiePaths` (per platform), `keychainService`, `linuxSecretLabel`, `localStatePath`.

### `profiles/constants.ts` — `PROFILE_BROWSER_CONFIGS`

For each Chromium browser: `BrowserInfo` (name, macOS executable), `darwinUserDataPath`, `linuxUserDataPath`, `win32UserDataPath`, `win32ExecutablePaths`, `registryKey`.

### `constants.ts` — Global maps

`BUNDLE_ID_TO_BROWSER` (macOS bundle IDs), `DESKTOP_FILE_TO_BROWSER` (Linux desktop entries), `SAFARI_COOKIE_RELATIVE_PATHS`.

### `utils/browser-name-map.ts` — `DISPLAY_NAME_TO_BROWSER`

Maps display names ("Google Chrome") to `Browser` keys ("chrome").

There is **significant duplication** between the sqlite configs, profile configs, bundle ID maps, and display name maps. All describe the same set of 18 browsers but in different structures.

---

## How the Jar Works (`jar.ts`)

Cookie matching for a URL:
1. Parse URL → extract hostname, pathname, protocol
2. For each cookie: check domain match (host matches or is subdomain), path prefix, secure flag, expiry
3. Handle `__Host-` prefix cookies (must not have leading dot on domain)

Conversion to Playwright/Puppeteer format: same shape, just ensures dot-prefix on domain and defaults expires to `-1` for session cookies.

---

## Error Handling Strategy

The package uses a **warnings array** pattern. Every extraction function returns `{ cookies: Cookie[], warnings: string[] }`. Errors never throw — they push to warnings and return empty cookies:

```typescript
try { ... }
catch (error) {
  warnings.push(formatWarning(browser, "failed to read cookies", error));
  return { cookies: [], warnings };
}
```

Temp directories are always cleaned up in `finally` blocks.

---

## Cross-Cutting Concerns

### Temp File Management

All SQLite reads copy the database + WAL/SHM to a temp directory first (avoids lock conflicts with running browsers). Cleanup is always in `finally`.

### Host Matching

`expandHostCandidates("a.b.c.com")` → `["a.b.c.com", "b.c.com", "c.com"]`. Used to build SQL WHERE clauses that match cookies stored with any parent domain.

### Expiration Normalization

Handles three epoch formats:
- Chrome epoch: microseconds since 1601-01-01 → divide by 1M, subtract 11644473600
- Millisecond timestamps: divide by 1000
- Unix seconds: pass through
- Bigint variants of all above (from `node:sqlite` with `readBigInts: true`)

---

## Test Coverage

53 files total, 18 test files covering:
- Crypto decryption
- Jar matching
- Default browser detection
- Firefox expiry parsing
- Profile INI parsing
- Browser name mapping
- Safari binary parsing
- String field coercion
- Natural sort
- Profile extraction
- Integration tests
