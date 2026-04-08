#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";

// rrweb event constants (same as replay-viewer.tsx)
const RRWEB_EVENT_INCREMENTAL = 3;
const RRWEB_EVENT_META = 4;
const RRWEB_SOURCE_MOUSE_INTERACTION = 2;
const RRWEB_SOURCE_SCROLL = 3;
const RRWEB_SOURCE_VIEWPORT_RESIZE = 4;
const RRWEB_SOURCE_INPUT = 5;
const RRWEB_SOURCE_MEDIA_INTERACTION = 7;
const RRWEB_SOURCE_DRAG = 12;
const RRWEB_MOUSE_CLICK = 2;
const RRWEB_MOUSE_DBLCLICK = 4;
const RRWEB_MOUSE_CONTEXT_MENU = 8;
const RRWEB_MOUSE_FOCUS = 6;
const RRWEB_MOUSE_TOUCH_START = 9;
const RRWEB_MEDIA_PLAY = 0;
const RRWEB_MEDIA_PAUSE = 1;
const INPUT_DEBOUNCE_MS = 500;
const INPUT_ACTION_OFFSET_MS = 500;
const SCROLL_DEBOUNCE_MS = 800;

const MOUSE_INTERACTION_LABELS = {
  [RRWEB_MOUSE_CLICK]: "Clicked",
  [RRWEB_MOUSE_DBLCLICK]: "Double-clicked",
  [RRWEB_MOUSE_CONTEXT_MENU]: "Right-clicked",
  [RRWEB_MOUSE_FOCUS]: "Focused",
  [RRWEB_MOUSE_TOUCH_START]: "Tapped",
};

const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const extractReplayActions = (events) => {
  if (events.length < 2) return [];
  const startTs = events[0].timestamp;
  const actions = [];
  let lastInputTs = -Infinity;
  let lastScrollTs = -Infinity;

  for (const event of events) {
    const relativeMs = event.timestamp - startTs;
    const data = event.data;

    if (event.type === RRWEB_EVENT_META && typeof data.href === "string") {
      try {
        const url = new URL(data.href);
        const displayPath =
          url.pathname === "/" ? url.hostname : `${url.hostname}${url.pathname}`;
        actions.push({
          id: `nav-${event.timestamp}`,
          label: `Navigated to ${displayPath}`,
          relativeMs,
        });
      } catch {
        // skip invalid URLs
      }
      continue;
    }

    if (event.type !== RRWEB_EVENT_INCREMENTAL) continue;

    if (data.source === RRWEB_SOURCE_MOUSE_INTERACTION) {
      const interactionType = data.type;
      const label = MOUSE_INTERACTION_LABELS[interactionType];
      if (label) {
        actions.push({ id: `mouse-${interactionType}-${event.timestamp}`, label, relativeMs });
      }
      continue;
    }

    if (data.source === RRWEB_SOURCE_INPUT) {
      if (event.timestamp - lastInputTs > INPUT_DEBOUNCE_MS) {
        const rawText = typeof data.text === "string" ? data.text : "";
        const displayText = rawText.length > 30 ? `${rawText.slice(0, 30)}…` : rawText;
        actions.push({
          id: `input-${event.timestamp}`,
          label: displayText.length > 0 ? `Typed "${displayText}"` : "Typed input",
          relativeMs: relativeMs + INPUT_ACTION_OFFSET_MS,
        });
      }
      lastInputTs = event.timestamp;
      continue;
    }

    if (data.source === RRWEB_SOURCE_SCROLL) {
      if (event.timestamp - lastScrollTs > SCROLL_DEBOUNCE_MS) {
        actions.push({ id: `scroll-${event.timestamp}`, label: "Scrolled", relativeMs });
      }
      lastScrollTs = event.timestamp;
      continue;
    }

    if (data.source === RRWEB_SOURCE_VIEWPORT_RESIZE) {
      actions.push({
        id: `resize-${event.timestamp}`,
        label: `Resized to ${data.width}×${data.height}`,
        relativeMs,
      });
      continue;
    }

    if (data.source === RRWEB_SOURCE_MEDIA_INTERACTION) {
      const mediaType = data.type;
      const label =
        mediaType === RRWEB_MEDIA_PLAY
          ? "Played media"
          : mediaType === RRWEB_MEDIA_PAUSE
            ? "Paused media"
            : undefined;
      if (label) {
        actions.push({ id: `media-${event.timestamp}`, label, relativeMs });
      }
      continue;
    }

    if (data.source === RRWEB_SOURCE_DRAG) {
      actions.push({ id: `drag-${event.timestamp}`, label: "Dragged", relativeMs });
      continue;
    }
  }

  return actions;
};

const loadEvents = (filePath) => {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath);

  if (ext === ".jsonl") {
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  const parsed = JSON.parse(content);
  // Handle both { events: [...] } and plain [...]
  return Array.isArray(parsed) ? parsed : parsed.events;
};

const printTimeline = (actions, durationMs) => {
  console.log(`\n  Timeline (${formatTime(durationMs)} total)\n`);
  console.log(`  ${"Time".padEnd(10)} Action`);
  console.log(`  ${"─".repeat(10)} ${"─".repeat(40)}`);

  for (const action of actions) {
    const time = formatTime(action.relativeMs);
    console.log(`  ${time.padEnd(10)} ${action.label}`);
  }

  console.log(`\n  ${actions.length} events extracted\n`);
};

const printJson = (actions, durationMs, events) => {
  const startTs = events[0].timestamp;
  const output = {
    duration: durationMs,
    durationFormatted: formatTime(durationMs),
    eventCount: actions.length,
    totalRawEvents: events.length,
    actions: actions.map((a) => ({
      time: formatTime(a.relativeMs),
      timeMs: a.relativeMs,
      label: a.label,
    })),
  };
  console.log(JSON.stringify(output, null, 2));
};

// --- CLI ---
const args = process.argv.slice(2);
const jsonFlag = args.includes("--json");
const filteredArgs = args.filter((a) => a !== "--json");
const filePath = filteredArgs[0] || "events.json";

if (filteredArgs.includes("--help") || filteredArgs.includes("-h")) {
  console.log(`
  Usage: node timeline.mjs [file] [--json]

  Extract a timeline of user actions from rrweb recording files.

  Arguments:
    file        Path to .json or .jsonl rrweb recording (default: events.json)

  Options:
    --json      Output as JSON instead of formatted table
    -h, --help  Show this help

  Examples:
    node timeline.mjs events.json
    node timeline.mjs events.jsonl --json
`);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const events = loadEvents(filePath);
const durationMs =
  events.length >= 2 ? Math.max(events[events.length - 1].timestamp - events[0].timestamp, 0) : 0;
const actions = extractReplayActions(events);

if (jsonFlag) {
  printJson(actions, durationMs, events);
} else {
  printTimeline(actions, durationMs);
}
