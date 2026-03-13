import { detectBrowserProfiles } from "./browser/detector.js";
import { extractProfileCookies } from "./extract.js";

const main = async () => {
  console.log("Detecting browser profiles...\n");

  const profiles = detectBrowserProfiles();

  if (profiles.length === 0) {
    console.log("No browser profiles found.");
    return;
  }

  console.log(`Found ${profiles.length} profile(s):\n`);

  for (const [index, profile] of profiles.entries()) {
    console.log(`  ${index + 1}. ${profile.browser.name} - ${profile.displayName}`);
    console.log(`     ${profile.profilePath}\n`);
  }

  const targetIndex = parseInt(process.argv[2] ?? "1", 10) - 1;
  const target = profiles[targetIndex];

  if (!target) {
    console.log(`Invalid profile index. Use 1-${profiles.length}`);
    return;
  }

  console.log(`\nExtracting cookies from: ${target.browser.name} - ${target.displayName}`);
  console.log(`Profile path: ${target.profilePath}\n`);

  const { cookies, warnings } = await extractProfileCookies({ profile: target });

  for (const warning of warnings) {
    console.log(`⚠ ${warning}`);
  }

  if (cookies.length === 0) {
    console.log("No cookies extracted.");
    return;
  }

  const domains = new Set(cookies.map((cookie) => cookie.domain));

  console.log(`Extracted ${cookies.length} cookies from ${domains.size} domains:\n`);

  const domainCounts = new Map<string, number>();
  for (const cookie of cookies) {
    domainCounts.set(cookie.domain, (domainCounts.get(cookie.domain) ?? 0) + 1);
  }

  const sorted = [...domainCounts.entries()].sort((left, right) => right[1] - left[1]);

  for (const [domain, count] of sorted.slice(0, 20)) {
    console.log(`  ${domain}: ${count} cookie(s)`);
  }

  if (sorted.length > 20) {
    console.log(`  ... and ${sorted.length - 20} more domains`);
  }

  console.log(`\nSample cookies (first 5):\n`);

  for (const cookie of cookies.slice(0, 5)) {
    console.log(
      `  ${cookie.name}=${cookie.value.slice(0, 40)}${cookie.value.length > 40 ? "..." : ""}`,
    );
    console.log(`    domain: ${cookie.domain}, path: ${cookie.path}`);
    console.log(
      `    secure: ${cookie.secure}, httpOnly: ${cookie.httpOnly}, sameSite: ${cookie.sameSite ?? "unset"}\n`,
    );
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
