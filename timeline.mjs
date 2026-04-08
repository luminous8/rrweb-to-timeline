#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";

// rrweb event constants
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
const SCROLL_DEBOUNCE_MS = 800;
const IDLE_GAP_MS = 15000;

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

// Extract raw actions from rrweb events
const extractRawActions = (events) => {
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
        actions.push({ type: "navigation", label: `Navigated to ${displayPath}`, ms: relativeMs, url: data.href });
      } catch {}
      continue;
    }

    if (event.type !== RRWEB_EVENT_INCREMENTAL) continue;

    if (data.source === RRWEB_SOURCE_MOUSE_INTERACTION) {
      const interactionType = data.type;
      const label = MOUSE_INTERACTION_LABELS[interactionType];
      if (label) {
        actions.push({ type: "click", label, ms: relativeMs });
      }
      continue;
    }

    if (data.source === RRWEB_SOURCE_INPUT) {
      if (event.timestamp - lastInputTs > INPUT_DEBOUNCE_MS) {
        const rawText = typeof data.text === "string" ? data.text : "";
        const displayText = rawText.length > 30 ? `${rawText.slice(0, 30)}…` : rawText;
        actions.push({
          type: "input",
          label: displayText.length > 0 ? `Typed "${displayText}"` : "Typed input",
          ms: relativeMs,
          text: rawText,
        });
      }
      lastInputTs = event.timestamp;
      continue;
    }

    if (data.source === RRWEB_SOURCE_SCROLL) {
      if (event.timestamp - lastScrollTs > SCROLL_DEBOUNCE_MS) {
        actions.push({ type: "scroll", label: "Scrolled", ms: relativeMs });
      }
      lastScrollTs = event.timestamp;
      continue;
    }

    if (data.source === RRWEB_SOURCE_VIEWPORT_RESIZE) {
      actions.push({
        type: "resize",
        label: `Resized to ${data.width}×${data.height}`,
        ms: relativeMs,
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
        actions.push({ type: "media", label, ms: relativeMs });
      }
      continue;
    }

    if (data.source === RRWEB_SOURCE_DRAG) {
      actions.push({ type: "drag", label: "Dragged", ms: relativeMs });
      continue;
    }
  }

  return actions;
};

// Pre-process: dedupe consecutive navigations to same host, drop solo Focused
const preProcess = (actions) => {
  const result = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Skip Focused that immediately follows a Click (<300ms)
    if (
      action.type === "click" && action.label === "Focused" &&
      result.length > 0 &&
      result[result.length - 1].type === "click" &&
      action.ms - result[result.length - 1].ms < 300
    ) continue;

    // Dedupe consecutive navigations to same URL
    if (
      action.type === "navigation" &&
      result.length > 0 &&
      result[result.length - 1].type === "navigation" &&
      result[result.length - 1].url === action.url
    ) continue;

    result.push(action);
  }
  return result;
};

// Derive a readable page name from a URL
const pageNameFromUrl = (url) => {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return u.hostname;
    // Use last meaningful segment, skip UUIDs and long tokens
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (!seg.match(/^[0-9a-f-]{20,}$/i) && seg.length < 40) {
        return seg;
      }
    }
    // All segments are UUIDs/tokens — use hostname
    return u.hostname;
  } catch {
    return "page";
  }
};

// Summarize a group of actions into a step title
const summarizeGroup = (group) => {
  const inputs = group.filter((a) => a.type === "input");
  const navigations = group.filter((a) => a.type === "navigation");
  const clicks = group.filter((a) => a.type === "click" && a.label !== "Focused");
  const scrolls = group.filter((a) => a.type === "scroll");
  const hasNav = navigations.length > 0;

  // Determine page context from first navigation
  const pageName = hasNav ? pageNameFromUrl(navigations[0].url) : undefined;

  // Form filling with inputs
  if (inputs.length >= 2) {
    const fieldTypes = inputs.map((i) => {
      if (i.text && i.text.includes("@")) return "email";
      if (i.text && i.text.match(/^\*+$/)) return "password";
      if (i.text && i.text.match(/^\d{4,8}$/)) return "verification code";
      return null;
    });
    const unique = [...new Set(fieldTypes.filter(Boolean))];

    if (unique.includes("email") && unique.includes("password")) {
      return hasNav ? `Sign in on ${pageName}` : "Fill in credentials";
    }
    if (unique.includes("verification code")) {
      return "Enter verification code";
    }
    if (hasNav) {
      return `Fill form on ${pageName} (${inputs.length} fields)`;
    }
    return `Fill form (${inputs.length} fields)`;
  }

  // Single input
  if (inputs.length === 1) {
    const text = inputs[0].text || "";
    if (hasNav) return `Navigate to ${pageName} and type "${text.slice(0, 20)}"`;
    if (text.includes("@")) return `Enter email "${text}"`;
    if (text.match(/^\*+$/)) return "Enter password";
    if (text.match(/^\d{4,8}$/)) return `Enter code "${text}"`;
    return inputs[0].label;
  }

  // Navigation-led group
  if (hasNav) {
    if (navigations.length > 1) {
      const lastNav = navigations[navigations.length - 1];
      const lastPage = pageNameFromUrl(lastNav.url);
      if (lastPage !== pageName) return `Navigate from ${pageName} to ${lastPage}`;
    }
    if (scrolls.length > 2) return `Browse ${pageName}`;
    if (clicks.length > 3) return `Interact with ${pageName}`;
    return `Navigate to ${pageName}`;
  }

  // Mostly scrolling
  if (scrolls.length >= 2 && scrolls.length >= clicks.length) {
    return "Scroll and browse";
  }

  // Clicking
  if (clicks.length > 0) {
    return `Interact with page (${clicks.length} clicks)`;
  }

  // Fallback
  return group[0].label;
};

// Group raw actions into intelligible steps
const groupIntoSteps = (actions) => {
  if (actions.length === 0) return [];

  const processed = preProcess(actions);
  const groups = [];
  let currentGroup = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    groups.push([...currentGroup]);
    currentGroup = [];
  };

  for (let i = 0; i < processed.length; i++) {
    const action = processed[i];
    const prev = currentGroup[currentGroup.length - 1];

    // Split on: new navigation to different host/path, or idle gap
    const isNewNavigation =
      action.type === "navigation" &&
      currentGroup.length > 0 &&
      !(currentGroup.length === 1 && currentGroup[0].type === "navigation" && action.ms - currentGroup[0].ms < 2000);

    const isIdleGap = prev && action.ms - prev.ms > IDLE_GAP_MS;

    if ((isNewNavigation || isIdleGap) && currentGroup.length > 0) {
      flushGroup();
    }

    currentGroup.push(action);
  }
  flushGroup();

  // Merge tiny groups (1-3 actions, no inputs, no navigation) into neighbors
  const merged = [];
  for (const group of groups) {
    const hasNav = group.some((a) => a.type === "navigation");
    const hasInput = group.some((a) => a.type === "input");
    const isTiny = group.length <= 3 && !hasNav && !hasInput;

    if (isTiny && merged.length > 0) {
      const prevGroup = merged[merged.length - 1];
      const gap = group[0].ms - prevGroup[prevGroup.length - 1].ms;
      if (gap < IDLE_GAP_MS * 2) {
        prevGroup.push(...group);
        continue;
      }
    }
    merged.push(group);
  }

  // Second pass: merge consecutive scroll-only or click-only groups
  const final = [];
  for (const group of merged) {
    const prevGroup = final[final.length - 1];
    if (prevGroup) {
      const prevTitle = summarizeGroup(prevGroup);
      const thisTitle = summarizeGroup(group);
      const gap = group[0].ms - prevGroup[prevGroup.length - 1].ms;
      const bothScroll = prevTitle.startsWith("Scroll") && thisTitle.startsWith("Scroll") && gap < IDLE_GAP_MS * 3;
      const bothInteract = prevTitle.startsWith("Interact") && thisTitle.startsWith("Interact") && gap < IDLE_GAP_MS * 2;
      if (bothScroll || bothInteract) {
        prevGroup.push(...group);
        continue;
      }
    }
    final.push(group);
  }

  return final.map((group, i) => {
    const first = group[0];
    const last = group[group.length - 1];
    return {
      step: i + 1,
      title: summarizeGroup(group),
      startTime: formatTime(first.ms),
      startTimeMs: first.ms,
      endTime: formatTime(last.ms),
      endTimeMs: last.ms,
      actionCount: group.length,
    };
  });
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
  return Array.isArray(parsed) ? parsed : parsed.events;
};

// --- CLI ---
const args = process.argv.slice(2);
const jsonFlag = args.includes("--json");
const rawFlag = args.includes("--raw");
const filteredArgs = args.filter((a) => !a.startsWith("--"));
const filePath = filteredArgs[0] || "events.json";

if (filteredArgs.includes("--help") || filteredArgs.includes("-h") || args.includes("-h") || args.includes("--help")) {
  console.log(`
  Usage: node timeline.mjs [file] [--json] [--raw]

  Extract a timeline of user actions from rrweb recording files.

  Arguments:
    file        Path to .json or .jsonl rrweb recording (default: events.json)

  Options:
    --raw       Show individual actions instead of grouped steps
    --json      Output as JSON instead of formatted table
    -h, --help  Show this help

  Examples:
    node timeline.mjs events.json
    node timeline.mjs events.json --raw
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
const actions = extractRawActions(events);

if (rawFlag) {
  // Raw action output (original behavior)
  if (jsonFlag) {
    console.log(JSON.stringify({
      duration: durationMs,
      durationFormatted: formatTime(durationMs),
      eventCount: actions.length,
      totalRawEvents: events.length,
      actions: actions.map(({ type, ...rest }) => rest),
    }, null, 2));
  } else {
    console.log(`\n  Timeline (${formatTime(durationMs)} total)\n`);
    console.log(`  ${"Time".padEnd(10)} Action`);
    console.log(`  ${"─".repeat(10)} ${"─".repeat(40)}`);
    for (const action of actions) {
      console.log(`  ${formatTime(action.ms).padEnd(10)} ${action.label}`);
    }
    console.log(`\n  ${actions.length} events extracted\n`);
  }
} else {
  // Grouped steps (default)
  const steps = groupIntoSteps(actions);

  if (jsonFlag) {
    console.log(JSON.stringify({
      duration: durationMs,
      durationFormatted: formatTime(durationMs),
      stepCount: steps.length,
      totalRawEvents: events.length,
      steps,
    }, null, 2));
  } else {
    console.log(`\n  Timeline (${formatTime(durationMs)} total, ${steps.length} steps)\n`);
    console.log(`  ${"#".padEnd(5)} ${"Time".padEnd(18)} Step`);
    console.log(`  ${"─".repeat(5)} ${"─".repeat(18)} ${"─".repeat(48)}`);
    for (const step of steps) {
      const timeRange = `${step.startTime} → ${step.endTime}`;
      console.log(`  ${String(step.step).padEnd(5)} ${timeRange.padEnd(18)} ${step.title}`);
    }
    console.log(`\n  ${steps.length} steps · ${formatTime(durationMs)} total\n`);
  }
}
