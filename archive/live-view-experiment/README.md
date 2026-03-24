# Live View Experiment

This archive preserves the out-of-scope live viewer experiment that was removed from the launch path on 2026-03-14.

## What it did

- Started a tiny local HTTP server inside `packages/mcp`
- Captured JPEG screenshots from the active Playwright page on an interval
- Exposed:
  - `/`
  - `/latest.jpg`
  - `/stream.mjpeg`
- Reserved a local viewer URL in `packages/supervisor`
- Passed that URL into the MCP child process through env
- Surfaced the viewer URL at the start of test execution in the CLI

## Archived standalone files

These files can largely be restored directly:

- `files/packages/mcp/src/constants.ts`
- `files/packages/mcp/src/live-view-server.ts`
- `files/packages/supervisor/src/utils/resolve-live-view-url.ts`
- `files/apps/cli/src/components/ui/url-link.tsx`

## Existing files that were changed

These files had integration changes when the experiment was active:

- `packages/mcp/src/server.ts`
- `packages/supervisor/src/browser-mcp-config.ts`
- `packages/supervisor/src/constants.ts`
- `packages/supervisor/src/events.ts`
- `packages/supervisor/src/execute-browser-flow.ts`
- `packages/supervisor/src/types.ts`
- `packages/supervisor/tests/execute-browser-flow.test.ts`
- `apps/cli/src/components/screens/testing-screen.tsx`
- `apps/cli/src/utils/run-test.ts`

## Reintegration notes

- `packages/mcp/src/server.ts`
  - import the live-view constants and server helper
  - add a top-level `liveViewServer`
  - start the HTTP server during MCP startup
  - close it during browser session shutdown
- `packages/supervisor/src/browser-mcp-config.ts`
  - add `liveViewUrl` to `buildBrowserMcpServerEnv()`
  - pass `EXPECT_LIVE_VIEW_URL`
- `packages/supervisor/src/constants.ts`
  - restore the live-view host, port, search-limit, and env-name constants
- `packages/supervisor/src/types.ts`
  - restore `liveViewUrl?: string` on `ExecuteBrowserFlowOptions`
- `packages/supervisor/src/events.ts`
  - restore `liveViewUrl?: string` on the `run-started` event
- `packages/supervisor/src/execute-browser-flow.ts`
  - resolve a free local URL with `resolve-live-view-url.ts`
  - pass `liveViewUrl` into the MCP env via `buildBrowserMcpSettings()`
  - emit it on the initial `run-started` event
- `packages/supervisor/tests/execute-browser-flow.test.ts`
  - restore the env and `run-started` assertions around `liveViewUrl`
- `apps/cli/src/utils/run-test.ts`
  - print the live-view URL when present on `run-started`
- `apps/cli/src/components/screens/testing-screen.tsx`
  - this file now contains newer user-authored cancellation-flow changes
  - when reviving the experiment, re-add only the `liveViewUrl` state/update/render pieces without overwriting those newer changes
