# rrweb-to-timeline

Extract a timeline of user actions from [rrweb](https://www.rrweb.io/) session recordings and replay them in a local player.

Based on the replay viewer from [expect.dev](https://www.expect.dev/replay?demo=true).

## CLI

Extract a timeline from a `.json` or `.jsonl` rrweb recording:

```bash
node timeline.mjs events.json
```

Output:

```
  Timeline (51:49 total)

  Time       Action
  ────────── ────────────────────────────────────────
  0:00       Navigated to app.tembo.io/sign-in
  0:12       Clicked
  0:37       Typed "user@example.com"
  0:59       Typed "Bertrand"
  1:04       Typed "Bruandet"
  ...
```

JSON output:

```bash
node timeline.mjs events.json --json
```

## Player

Replay recordings in the browser with an interactive timeline sidebar.

```bash
npx serve .
# open http://localhost:3000/player.html
```

- Drag & drop `.json` or `.jsonl` files onto the page
- Click "Open file..." to pick a file
- Click any action in the timeline to jump to that moment
- Playback controls with 1x/2x/4x/8x speed

## Supported events

- Navigation (page URL changes)
- Mouse interactions (click, double-click, right-click, focus, tap)
- Text input (debounced)
- Scroll (debounced)
- Viewport resize
- Media play/pause
- Drag

## Upstream

This project is forked from [millionco/expect](https://github.com/millionco/expect). To pull upstream updates:

```bash
git fetch upstream
git merge upstream/main
```

## License

FSL-1.1-MIT
