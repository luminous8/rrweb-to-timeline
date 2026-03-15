---
format_version: 2
title: "Regression test: nisarg.io public site audit (unstaged changes on main)"
description: "14 files changed (+507/-134) on main (unstaged). Key additions: live-view-server.ts (new MCP browser live view), resolv…"
slug: "regression-test-nisarg-io-public-site-audit-unstaged-changes-on-main"
saved_target_scope: "unstaged"
saved_target_display_name: "unstaged changes on main"
plan: {"title":"Regression test: nisarg.io public site audit (unstaged changes on main)","rationale":"The unstaged diff introduces a live-view server, URL resolution utilities, and clickable wrappers around CLI UI components. While these changes are primarily in the CLI/supervisor layer, the live-view server exposes a browser-facing URL that may render content from the tested site. Testing nisarg.io directly validates that the browser agent can navigate a public site while the risk areas focus on anything the new live-view infrastructure might affect in terms of navigation, event handling, and URL resolution.","targetSummary":"14 files changed (+507/-134) on main (unstaged). Key additions: live-view-server.ts (new MCP browser live view), resolve-live-view-url.ts (URL resolution helper), constants.ts additions in both mcp and supervisor packages. Key modifications: CLI screens now wrap interactive elements in Clickable components; testing-screen.tsx and run-test.ts updated; supervisor events and browser-mcp-config extended.","assumptions":["nisarg.io is a public personal/portfolio site requiring no authentication.","The live-view server introduced in packages/mcp/src/live-view-server.ts may serve a proxied or mirrored view of the target URL — if so, the test should catch any rendering breakage.","No login credentials or session cookies are needed to browse nisarg.io.","The browser agent has network access to nisarg.io at test execution time.","Any new MCP tool calls introduced in packages/mcp/src/server.ts are invoked server-side and do not directly alter what the browser renders on nisarg.io."],"riskAreas":["resolve-live-view-url.ts: incorrect URL construction could cause the browser to navigate to a wrong or broken endpoint instead of the intended target.","live-view-server.ts: new server may proxy or frame nisarg.io content — any misconfiguration could break page load or navigation.","supervisor/src/events.ts: added event type could affect how browser navigation events are tracked or reported during the test run.","browser-mcp-config.ts changes: updated config may alter which browser capabilities or permissions are granted, potentially breaking navigation.","testing-screen.tsx: expanded screen logic may affect how test results/live-view are displayed, but could also hide errors if event handling regresses.","run-test.ts: small addition (+3 lines) could affect how the test session is initialized or the target URL is passed to the browser agent."],"targetUrls":["https://nisarg.io","https://nisarg.io/#projects","https://nisarg.io/#contact"],"cookieSync":{"required":false,"reason":"nisarg.io is a public portfolio/personal site with no login wall or authenticated content. All pages are accessible without a session, so cookie sync is unnecessary."},"steps":[{"id":"step-1","title":"Load homepage and verify initial render","instruction":"Navigate to https://nisarg.io and wait for the page to fully load. Check that the hero/above-the-fold content is visible with no console errors or failed network requests.","expectedOutcome":"Page loads successfully (HTTP 200), hero section with name/title is visible, no JS errors in the console.","routeHint":"https://nisarg.io","changedFileEvidence":["packages/supervisor/src/utils/resolve-live-view-url.ts","packages/mcp/src/live-view-server.ts"]},{"id":"step-2","title":"Verify all navigation links are present and clickable","instruction":"Inspect the main navigation bar. Confirm all nav links (e.g. About, Projects, Contact or equivalent) are rendered and not overlapping or hidden.","expectedOutcome":"All navigation items are visible, non-overlapping, and have correct href attributes.","routeHint":"https://nisarg.io","changedFileEvidence":["packages/supervisor/src/browser-mcp-config.ts","packages/supervisor/src/events.ts"]},{"id":"step-3","title":"Navigate to Projects section","instruction":"Click the Projects navigation link (or scroll to the projects section if it is a single-page app). Verify the projects/portfolio section loads and at least one project card or entry is displayed.","expectedOutcome":"Projects section is visible with at least one project listed, images load without broken src, and links are present.","routeHint":"https://nisarg.io/#projects","changedFileEvidence":["apps/cli/src/utils/run-test.ts","packages/supervisor/src/events.ts"]},{"id":"step-4","title":"Click an external project link and verify it opens correctly","instruction":"Find a project link (e.g. GitHub repo or live demo link) and verify it has a valid href. If it opens in a new tab, check the URL is well-formed and not a relative broken path.","expectedOutcome":"Project link href is a valid absolute URL (https://). No 404 or malformed URL.","routeHint":"https://nisarg.io/#projects","changedFileEvidence":["packages/supervisor/src/utils/resolve-live-view-url.ts"]},{"id":"step-5","title":"Navigate to Contact section and check for issues","instruction":"Scroll to or click the Contact section. Verify contact information or a contact form is displayed. Check that mailto or social links are not broken.","expectedOutcome":"Contact section is visible, at least one contact method (email, social link) is rendered with a valid href.","routeHint":"https://nisarg.io/#contact","changedFileEvidence":["apps/cli/src/components/screens/testing-screen.tsx"]},{"id":"step-6","title":"Check page for visual/layout regressions on full scroll","instruction":"Scroll from the top of the page to the bottom in a single pass. Look for any overlapping elements, broken images (img with no src or 404), or sections that appear empty when they should have content.","expectedOutcome":"No overlapping UI elements, no broken images, all sections render with visible content.","routeHint":"https://nisarg.io","changedFileEvidence":["apps/cli/src/components/screens/results-screen.tsx","apps/cli/src/components/screens/plan-review-screen.tsx"]},{"id":"step-7","title":"Verify page performance and absence of console errors","instruction":"After completing navigation, review the browser console for any errors or warnings. Check that no resources failed to load (no red entries in the network panel) and that the page does not display any error boundaries or fallback UI.","expectedOutcome":"Zero JS console errors, no failed network requests for critical assets (JS, CSS, fonts), no visible error states on the page.","routeHint":"https://nisarg.io","changedFileEvidence":["packages/mcp/src/server.ts","packages/mcp/src/constants.ts","packages/supervisor/src/constants.ts"]}],"userInstruction":"go and test https://nisarg.io for issues"}
environment: {}
---

# Regression test: nisarg.io public site audit (unstaged changes on main)

14 files changed (+507/-134) on main (unstaged). Key additions: live-view-server.ts (new MCP browser live view), resolv…

## User Instruction

go and test https://nisarg.io for issues

## Target

- Scope: unstaged
- Display name: unstaged changes on main
- Current branch: main
- Main branch: main

## Cookie Sync

- Required: No
- Reason: nisarg.io is a public portfolio/personal site with no login wall or authenticated content. All pages are accessible without a session, so cookie sync is unnecessary.
- Enabled for this saved flow: No

## Target URLs

- https://nisarg.io
- https://nisarg.io/#projects
- https://nisarg.io/#contact

## Risk Areas

- resolve-live-view-url.ts: incorrect URL construction could cause the browser to navigate to a wrong or broken endpoint instead of the intended target.
- live-view-server.ts: new server may proxy or frame nisarg.io content — any misconfiguration could break page load or navigation.
- supervisor/src/events.ts: added event type could affect how browser navigation events are tracked or reported during the test run.
- browser-mcp-config.ts changes: updated config may alter which browser capabilities or permissions are granted, potentially breaking navigation.
- testing-screen.tsx: expanded screen logic may affect how test results/live-view are displayed, but could also hide errors if event handling regresses.
- run-test.ts: small addition (+3 lines) could affect how the test session is initialized or the target URL is passed to the browser agent.

## Assumptions

- nisarg.io is a public personal/portfolio site requiring no authentication.
- The live-view server introduced in packages/mcp/src/live-view-server.ts may serve a proxied or mirrored view of the target URL — if so, the test should catch any rendering breakage.
- No login credentials or session cookies are needed to browse nisarg.io.
- The browser agent has network access to nisarg.io at test execution time.
- Any new MCP tool calls introduced in packages/mcp/src/server.ts are invoked server-side and do not directly alter what the browser renders on nisarg.io.

## Steps

### 1. Load homepage and verify initial render

Instruction: Navigate to https://nisarg.io and wait for the page to fully load. Check that the hero/above-the-fold content is visible with no console errors or failed network requests.
Expected outcome: Page loads successfully (HTTP 200), hero section with name/title is visible, no JS errors in the console.
Route hint: https://nisarg.io
Changed file evidence: packages/supervisor/src/utils/resolve-live-view-url.ts, packages/mcp/src/live-view-server.ts

### 2. Verify all navigation links are present and clickable

Instruction: Inspect the main navigation bar. Confirm all nav links (e.g. About, Projects, Contact or equivalent) are rendered and not overlapping or hidden.
Expected outcome: All navigation items are visible, non-overlapping, and have correct href attributes.
Route hint: https://nisarg.io
Changed file evidence: packages/supervisor/src/browser-mcp-config.ts, packages/supervisor/src/events.ts

### 3. Navigate to Projects section

Instruction: Click the Projects navigation link (or scroll to the projects section if it is a single-page app). Verify the projects/portfolio section loads and at least one project card or entry is displayed.
Expected outcome: Projects section is visible with at least one project listed, images load without broken src, and links are present.
Route hint: https://nisarg.io/#projects
Changed file evidence: apps/cli/src/utils/run-test.ts, packages/supervisor/src/events.ts

### 4. Click an external project link and verify it opens correctly

Instruction: Find a project link (e.g. GitHub repo or live demo link) and verify it has a valid href. If it opens in a new tab, check the URL is well-formed and not a relative broken path.
Expected outcome: Project link href is a valid absolute URL (https://). No 404 or malformed URL.
Route hint: https://nisarg.io/#projects
Changed file evidence: packages/supervisor/src/utils/resolve-live-view-url.ts

### 5. Navigate to Contact section and check for issues

Instruction: Scroll to or click the Contact section. Verify contact information or a contact form is displayed. Check that mailto or social links are not broken.
Expected outcome: Contact section is visible, at least one contact method (email, social link) is rendered with a valid href.
Route hint: https://nisarg.io/#contact
Changed file evidence: apps/cli/src/components/screens/testing-screen.tsx

### 6. Check page for visual/layout regressions on full scroll

Instruction: Scroll from the top of the page to the bottom in a single pass. Look for any overlapping elements, broken images (img with no src or 404), or sections that appear empty when they should have content.
Expected outcome: No overlapping UI elements, no broken images, all sections render with visible content.
Route hint: https://nisarg.io
Changed file evidence: apps/cli/src/components/screens/results-screen.tsx, apps/cli/src/components/screens/plan-review-screen.tsx

### 7. Verify page performance and absence of console errors

Instruction: After completing navigation, review the browser console for any errors or warnings. Check that no resources failed to load (no red entries in the network panel) and that the page does not display any error boundaries or fallback UI.
Expected outcome: Zero JS console errors, no failed network requests for critical assets (JS, CSS, fonts), no visible error states on the page.
Route hint: https://nisarg.io
Changed file evidence: packages/mcp/src/server.ts, packages/mcp/src/constants.ts, packages/supervisor/src/constants.ts
