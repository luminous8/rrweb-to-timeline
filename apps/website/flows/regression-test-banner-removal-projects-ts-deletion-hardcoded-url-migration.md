---
format_version: 2
title: "Regression test: Banner removal, projects.ts deletion, hardcoded URL migration"
description: "Unstaged changes on main — 7 files changed (+18/-56). Deleted: banner.tsx, projects.ts. Modified: page.tsx (Banner remo…"
slug: "regression-test-banner-removal-projects-ts-deletion-hardcoded-url-migration"
saved_target_scope: "unstaged"
saved_target_display_name: "unstaged changes on main"
plan:
  {
    "title": "Regression test: Banner removal, projects.ts deletion, hardcoded URL migration",
    "rationale": "Seven files changed in unstaged work, with two files fully deleted (banner.tsx, projects.ts) and three components refactored to remove their dependency on the PROJECTS data array. The primary risks are: (1) a blank/broken layout where the Banner used to render, (2) broken or missing GitHub/Docs links in ActionButtons now that they rely on hardcoded constants instead of PROJECTS[0], and (3) regressions in CommandDisplay and ProjectInfo that previously sourced data from PROJECTS. Because the diff is unstaged, the test targets the live working-tree state of the local dev server.",
    "targetSummary": "Unstaged changes on main — 7 files changed (+18/-56). Deleted: banner.tsx, projects.ts. Modified: page.tsx (Banner removed), action-buttons.tsx (PROJECTS→hardcoded URLs), command-display.tsx, project-info.tsx, next-env.d.ts.",
    "assumptions":
      [
        "The dev server is running locally; assumed base URL is http://localhost:3000.",
        "The site is a public, unauthenticated Next.js marketing/landing page — no login required.",
        "The hardcoded GITHUB_URL points to https://github.com/millionco/expect and DOCS_URL to https://github.com/millionco/expect#readme.",
        "CommandDisplay and ProjectInfo previously read name, description, or install command from PROJECTS[0] and now either use hardcoded strings or props.",
        "No feature flags or environment variables gate any of the changed components.",
      ],
    "riskAreas":
      [
        "Banner removal causing layout shift, empty space, or missing announcement/CTA at top of page",
        "ActionButtons GitHub and Docs links resolving to correct hardcoded URLs after PROJECTS dependency removed",
        "ProjectInfo rendering correct project name, description, and metadata without PROJECTS data",
        "CommandDisplay rendering correct install/usage command string without PROJECTS data",
        "Overall page layout integrity — flex column, max-w-lg centering, and spacing after Banner is gone",
        "No runtime import errors from deleted banner.tsx or projects.ts modules",
      ],
    "targetUrls": ["http://localhost:3000"],
    "cookieSync":
      {
        "required": false,
        "reason": "The target is a public Next.js marketing site. All changed components (Banner, ActionButtons, CommandDisplay, ProjectInfo) are statically rendered without authentication, user sessions, or org-gated data. Cookie sync adds no value here.",
      },
    "steps":
      [
        {
          "id": "step-1",
          "title": "Load homepage and confirm no runtime errors",
          "instruction": "Navigate to http://localhost:3000. Open the browser console before navigating and watch for any module-not-found or import errors on load.",
          "expectedOutcome": "Page loads fully with HTTP 200, no red console errors referencing banner.tsx, projects.ts, or missing exports.",
          "routeHint": "/",
          "changedFileEvidence":
            [
              "apps/website/app/page.tsx",
              "apps/website/lib/projects.ts",
              "apps/website/components/banner.tsx",
            ],
        },
        {
          "id": "step-2",
          "title": "Confirm Banner is absent and no empty gap remains",
          "instruction": "Inspect the top of the page above the <main> content area. Verify there is no visible empty whitespace, broken component shell, or missing announcement bar where the Banner previously rendered.",
          "expectedOutcome": "The page flows directly from the document top into the main content container with no visual gap, broken box, or React error boundary fallback.",
          "routeHint": "/",
          "changedFileEvidence":
            ["apps/website/app/page.tsx", "apps/website/components/banner.tsx"],
        },
        {
          "id": "step-3",
          "title": "Verify ProjectInfo renders correct content",
          "instruction": "Locate the ProjectInfo section on the page. Confirm it displays a project name, description, or tagline that is coherent and not empty, undefined, or '[object Object]'.",
          "expectedOutcome": "ProjectInfo shows meaningful text content. No 'undefined', blank fields, or JavaScript errors visible.",
          "routeHint": "/",
          "changedFileEvidence":
            ["apps/website/components/project-info.tsx", "apps/website/lib/projects.ts"],
        },
        {
          "id": "step-4",
          "title": "Verify CommandDisplay renders a valid command string",
          "instruction": "Locate the CommandDisplay component (install or usage command block). Confirm it shows a non-empty, properly formatted command string (e.g. an npm/npx install command).",
          "expectedOutcome": "CommandDisplay renders a complete command with no empty text, 'undefined', or visual breakage.",
          "routeHint": "/",
          "changedFileEvidence":
            ["apps/website/components/command-display.tsx", "apps/website/lib/projects.ts"],
        },
        {
          "id": "step-5",
          "title": "Verify GitHub button link target",
          "instruction": "Find the GitHub button in the ActionButtons section. Right-click or inspect it to confirm its href is 'https://github.com/millionco/expect'. Then click it and confirm it opens the correct GitHub repository.",
          "expectedOutcome": "GitHub button href equals 'https://github.com/millionco/expect' and navigates to the correct repo page.",
          "routeHint": "/",
          "changedFileEvidence":
            ["apps/website/components/action-buttons.tsx", "apps/website/lib/projects.ts"],
        },
        {
          "id": "step-6",
          "title": "Verify Docs button link target",
          "instruction": "Return to the homepage. Find the Docs button in the ActionButtons section. Inspect its href to confirm it is 'https://github.com/millionco/expect#readme'. Click it and verify it reaches the README anchor.",
          "expectedOutcome": "Docs button href equals 'https://github.com/millionco/expect#readme' and navigates to the README section.",
          "routeHint": "/",
          "changedFileEvidence":
            ["apps/website/components/action-buttons.tsx", "apps/website/lib/projects.ts"],
        },
        {
          "id": "step-7",
          "title": "Validate overall page layout and spacing",
          "instruction": "Return to http://localhost:3000. Visually scan the full page at desktop width (~1280px). Confirm the main content is centered, the flex column layout is intact, and no section appears displaced or overlapping compared to expected design (content hugs left edge of max-w-lg container, 16px vertical padding at top).",
          "expectedOutcome": "Page layout is visually correct: centered max-w-lg column, consistent spacing between ProjectInfo, CommandDisplay, and ActionButtons, no overflow or misalignment.",
          "routeHint": "/",
          "changedFileEvidence":
            ["apps/website/app/page.tsx", "apps/website/components/banner.tsx"],
        },
        {
          "id": "step-8",
          "title": "Check mobile layout for regressions",
          "instruction": "Using browser DevTools, switch to a mobile viewport (375px wide, e.g. iPhone SE preset). Reload http://localhost:3000 and confirm all three components (ProjectInfo, CommandDisplay, ActionButtons) render correctly without overflow, clipping, or broken spacing.",
          "expectedOutcome": "All components stack cleanly at 375px width. No horizontal scroll bar. ActionButtons wrap gracefully if needed.",
          "routeHint": "/",
          "changedFileEvidence":
            [
              "apps/website/app/page.tsx",
              "apps/website/components/action-buttons.tsx",
              "apps/website/components/project-info.tsx",
            ],
        },
      ],
    "userInstruction": "Check for regressions in related features",
  }
environment: {}
---

# Regression test: Banner removal, projects.ts deletion, hardcoded URL migration

Unstaged changes on main — 7 files changed (+18/-56). Deleted: banner.tsx, projects.ts. Modified: page.tsx (Banner remo…

## User Instruction

Check for regressions in related features

## Target

- Scope: unstaged
- Display name: unstaged changes on main
- Current branch: main
- Main branch: main

## Cookie Sync

- Required: No
- Reason: The target is a public Next.js marketing site. All changed components (Banner, ActionButtons, CommandDisplay, ProjectInfo) are statically rendered without authentication, user sessions, or org-gated data. Cookie sync adds no value here.
- Enabled for this saved flow: No

## Target URLs

- http://localhost:3000

## Risk Areas

- Banner removal causing layout shift, empty space, or missing announcement/CTA at top of page
- ActionButtons GitHub and Docs links resolving to correct hardcoded URLs after PROJECTS dependency removed
- ProjectInfo rendering correct project name, description, and metadata without PROJECTS data
- CommandDisplay rendering correct install/usage command string without PROJECTS data
- Overall page layout integrity — flex column, max-w-lg centering, and spacing after Banner is gone
- No runtime import errors from deleted banner.tsx or projects.ts modules

## Assumptions

- The dev server is running locally; assumed base URL is http://localhost:3000.
- The site is a public, unauthenticated Next.js marketing/landing page — no login required.
- The hardcoded GITHUB_URL points to https://github.com/millionco/expect and DOCS_URL to https://github.com/millionco/expect#readme.
- CommandDisplay and ProjectInfo previously read name, description, or install command from PROJECTS[0] and now either use hardcoded strings or props.
- No feature flags or environment variables gate any of the changed components.

## Steps

### 1. Load homepage and confirm no runtime errors

Instruction: Navigate to http://localhost:3000. Open the browser console before navigating and watch for any module-not-found or import errors on load.
Expected outcome: Page loads fully with HTTP 200, no red console errors referencing banner.tsx, projects.ts, or missing exports.
Route hint: /
Changed file evidence: apps/website/app/page.tsx, apps/website/lib/projects.ts, apps/website/components/banner.tsx

### 2. Confirm Banner is absent and no empty gap remains

Instruction: Inspect the top of the page above the <main> content area. Verify there is no visible empty whitespace, broken component shell, or missing announcement bar where the Banner previously rendered.
Expected outcome: The page flows directly from the document top into the main content container with no visual gap, broken box, or React error boundary fallback.
Route hint: /
Changed file evidence: apps/website/app/page.tsx, apps/website/components/banner.tsx

### 3. Verify ProjectInfo renders correct content

Instruction: Locate the ProjectInfo section on the page. Confirm it displays a project name, description, or tagline that is coherent and not empty, undefined, or '[object Object]'.
Expected outcome: ProjectInfo shows meaningful text content. No 'undefined', blank fields, or JavaScript errors visible.
Route hint: /
Changed file evidence: apps/website/components/project-info.tsx, apps/website/lib/projects.ts

### 4. Verify CommandDisplay renders a valid command string

Instruction: Locate the CommandDisplay component (install or usage command block). Confirm it shows a non-empty, properly formatted command string (e.g. an npm/npx install command).
Expected outcome: CommandDisplay renders a complete command with no empty text, 'undefined', or visual breakage.
Route hint: /
Changed file evidence: apps/website/components/command-display.tsx, apps/website/lib/projects.ts

### 5. Verify GitHub button link target

Instruction: Find the GitHub button in the ActionButtons section. Right-click or inspect it to confirm its href is 'https://github.com/millionco/expect'. Then click it and confirm it opens the correct GitHub repository.
Expected outcome: GitHub button href equals 'https://github.com/millionco/expect' and navigates to the correct repo page.
Route hint: /
Changed file evidence: apps/website/components/action-buttons.tsx, apps/website/lib/projects.ts

### 6. Verify Docs button link target

Instruction: Return to the homepage. Find the Docs button in the ActionButtons section. Inspect its href to confirm it is 'https://github.com/millionco/expect#readme'. Click it and verify it reaches the README anchor.
Expected outcome: Docs button href equals 'https://github.com/millionco/expect#readme' and navigates to the README section.
Route hint: /
Changed file evidence: apps/website/components/action-buttons.tsx, apps/website/lib/projects.ts

### 7. Validate overall page layout and spacing

Instruction: Return to http://localhost:3000. Visually scan the full page at desktop width (~1280px). Confirm the main content is centered, the flex column layout is intact, and no section appears displaced or overlapping compared to expected design (content hugs left edge of max-w-lg container, 16px vertical padding at top).
Expected outcome: Page layout is visually correct: centered max-w-lg column, consistent spacing between ProjectInfo, CommandDisplay, and ActionButtons, no overflow or misalignment.
Route hint: /
Changed file evidence: apps/website/app/page.tsx, apps/website/components/banner.tsx

### 8. Check mobile layout for regressions

Instruction: Using browser DevTools, switch to a mobile viewport (375px wide, e.g. iPhone SE preset). Reload http://localhost:3000 and confirm all three components (ProjectInfo, CommandDisplay, ActionButtons) render correctly without overflow, clipping, or broken spacing.
Expected outcome: All components stack cleanly at 375px width. No horizontal scroll bar. ActionButtons wrap gracefully if needed.
Route hint: /
Changed file evidence: apps/website/app/page.tsx, apps/website/components/action-buttons.tsx, apps/website/components/project-info.tsx
