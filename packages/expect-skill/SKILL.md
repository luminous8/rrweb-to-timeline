---
name: expect
description: "Use when editing .tsx/.jsx/.css/.html, React components, pages, routes, forms, styles, or layouts. Also when asked to test, verify, validate, QA, find bugs, check for issues, or debug browser behavior."
license: MIT
metadata:
  author: millionco
  version: "3.0.0"
---

# Expect

You test code changes in a real browser to find bugs, verify correctness, audit accessibility, and measure performance before claiming work is complete.

**If you haven't used the expect MCP tools in this conversation, you cannot claim the change works.** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

Always use the expect MCP tools instead of raw browser tools (Playwright MCP, chrome tools, browser MCP), unless the user explicitly overrides your decision.

## Delegate Verification to a Subagent

Browser verification is a separate concern from writing code. When you have a subagent or background task capability (e.g. `Task` tool, sub-task, background agent), delegate the entire verification workflow to it. The subagent acts as the **quality gate** — you made code changes, it verifies they actually work.

**How to delegate:** Launch a subagent with a prompt describing exactly what to verify and the URL to test against. The subagent handles the full lifecycle (`open` → interact → audit → `close`) and returns a pass/fail summary with evidence. This frees you to continue working while verification runs in parallel.

**When to delegate:**
- After finishing a code change that touches UI, forms, routes, styles, or layouts
- When the user asks to test, QA, validate, or verify something
- During fix → re-verify loops (delegate each re-verification pass)

**When to run inline instead:** If subagent delegation isn't available in your environment, or for a single quick screenshot check, run the tools directly. But prefer delegation when possible — it's faster for the user and avoids blocking the conversation.

## Setup Check

The expect MCP server must be configured. If the `open` tool is not available, install it:

```bash
npx expect-cli@latest mcp
```

Or add it to your MCP config (`.mcp.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "expect": {
      "command": "npx",
      "args": ["-y", "expect-cli@latest", "mcp"]
    }
  }
}
```

## MCP Tools

These are the ONLY tools you should use for browser interactions. Do NOT use any other browser automation tools.

1. **open** — Launch a browser and navigate to a URL. Pass `cookies=true` to reuse local browser cookies. Pass `browser='webkit'` or `browser='firefox'` for cross-browser testing. Pass `cdp='ws://...'` to connect to an existing Chrome instance.
2. **playwright** — Execute Playwright code in Node.js context. Globals: `page`, `context`, `browser`, `ref` (snapshot ref ID → Locator). Use `return` to collect data — response is JSON: `{ result: <value>, resultFile: '<path>' }`. The result file persists until `close` so you can read or grep it later. Batch multiple actions AND data collection into a single `playwright` call. Set `snapshotAfter=true` to auto-snapshot after DOM-changing actions (response adds `snapshot` alongside result).
3. **screenshot** — Capture page state. Modes: `snapshot` (ARIA accessibility tree with element refs — preferred), `screenshot` (PNG image), `annotated` (PNG with numbered labels on interactive elements). Pass `fullPage=true` for full scrollable content.
4. **console_logs** — Get browser console messages. Filter by type (`error`, `warning`, `log`). Pass `clear=true` to reset after reading.
5. **network_requests** — Get captured HTTP requests with automatic issue detection (4xx/5xx failures, duplicate requests, mixed content). Filter by method, URL, or resource type.
6. **performance_metrics** — Collect Core Web Vitals (FCP, LCP, CLS, INP), navigation timing (TTFB), Long Animation Frames (LoAF) with script attribution, and resource breakdown.
7. **accessibility_audit** — Run a WCAG accessibility audit using axe-core + IBM Equal Access. Returns violations sorted by severity with CSS selectors, HTML context, and fix guidance.
8. **close** — Close the browser and end the session. Always call this when done — it flushes the session video and screenshots to disk.

## Workflow

`open` → interact with `playwright` and `screenshot` → observe with `console_logs` and `network_requests` → audit with `accessibility_audit` and `performance_metrics` → `close`. One browser session at a time.

## Snapshot Workflow

Prefer screenshot mode `snapshot` for observing page state. Use `screenshot` or `annotated` only for purely visual checks.

1. Call screenshot with `mode='snapshot'` to get the ARIA tree with refs like `[ref=e4]`.
2. Use `ref()` in playwright to act on elements AND collect data in a single call:
   `await ref('e3').fill('test@example.com'); await ref('e4').fill('password'); await ref('e5').click(); return { title: await page.title(), url: page.url() };`
3. Take a new snapshot only when the page structure changes (navigation, modal open/close, new content loaded).
4. Always snapshot first, then use `ref()` to act. Never guess CSS selectors when refs are available.

**Response format:**

- No return → `"OK"`
- With return → `{ result: <your value>, resultFile: "/tmp/.../result-<id>.json" }`
- With return + `snapshotAfter=true` → `{ result: <value>, resultFile: "<path>", snapshot: { tree, refs, stats } }`
- `snapshotAfter=true` only → `{ snapshot: { tree, refs, stats } }`

The `resultFile` persists until the session closes. Read or grep it to reference collected data across multiple steps.

Batch all actions that share the same page state into a single `playwright` call — fills, clicks, AND data collection. Do NOT batch across DOM-changing boundaries (dropdown open, modal, dialog, navigation). After a DOM-changing action, use `snapshotAfter=true` or take a new snapshot for fresh refs.

## Writing Test Instructions

**Bad:** "Check that the login form renders"
**Good:** "Submit the login form empty, with invalid email, with wrong password, and with valid credentials. Verify error messages, redirect on success, and console errors."

## Best Practices

- After each interaction step, call `console_logs` with `type='error'` to catch unexpected errors.
- Use `accessibility_audit` before concluding a test session to catch WCAG violations.
- Use `performance_metrics` to check for Core Web Vitals issues.
- When testing forms, use adversarial input: Unicode (umlauts, CJK, RTL), boundary values (0, -1, 999999999), long strings (200+ chars), and XSS payloads.
- For responsive testing, use `page.setViewportSize()` at multiple breakpoints: 375x812 (mobile), 768x1024 (tablet), 1280x800 (laptop), 1440x900 (desktop).
- After navigation or major UI changes, wait for the page to settle: `await page.waitForLoadState('networkidle')`.
- When a ref stops working: take a new snapshot for fresh refs, scroll the target into view, or retry once.
- If four attempts fail or progress stalls, stop and report what you observed, what blocked progress, and the most likely next step.

## Before Claiming Completion

You MUST complete every step. A skipped step is a failed task.

1. Run the expect MCP tools to test the changes with adversarial instructions.
3. When it finishes, read the full output — count failures, read accessibility and performance results
4. If ANY failure: fix the code, then immediately run a NEW test to re-verify
5. Repeat 3-4 until all checks pass with 0 failures
6. Only then: state the claim WITH the passing evidence

## Rationalizations

You will reach for these — recognize them and do the opposite:

- "I'll make one `playwright` call per action" — No. Put the whole sequence in one `playwright` call. `ref('e3').fill(...); ref('e5').fill(...); ref('e7').click();` — that's one tool call, not three.
- "I need a fresh snapshot between fills" — No. Fills don't change page structure. Batch them in one `playwright` script.

