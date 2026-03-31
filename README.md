# Sci‑Fi Control Panel — CSS-Heavy Haunted Console

A single-page **sci-fi operations console** built with **plain HTML + light JavaScript + heavy CSS**. The goal is to show how far a strong CSS system can go: panel chrome, scanlines, glows, radar sweep, segmented readouts, animated indicators, warning states, and responsive layout—without frameworks and without canvas doing the heavy lifting.

## Why this is CSS-heavy

- **Visual identity lives in CSS**: custom properties, layered gradients, pseudo-element panel casing, glow stacks, and micro-interactions.
- **Primary visuals are CSS-driven**: radar sweep (`conic-gradient`), grid overlays, scanlines/noise, equalizer bars, segmented meters.
- **JS is deliberately minimal**: state toggles (power/lock/alert), believable telemetry drift, fake contacts/log entries, and small keyboard shortcuts.

## File structure

```
.
├─ Dockerfile
├─ .dockerignore
├─ index.html
├─ styles.css
├─ script.js
├─ nginx.conf
├─ docker-compose.yml
├─ LICENSE
└─ README.md
```

## Run it locally

Any static server works. Examples:

- Python:
  - `python3 -m http.server 5173`
  - open `http://localhost:5173`
- Node:
  - `npx serve .`

You can also open `index.html` directly, but a server is nicer for consistent loading behavior.

## Run it with Docker (nginx)

Nginx is used because it’s a **small, boring, production-grade static server** with excellent defaults and a tiny runtime footprint.

- Build:
  - `docker build -t sci-fi-control-panel .`
- Run (served at `http://localhost:3021`):
  - `docker run --rm -p 3021:80 sci-fi-control-panel`

## Run it with Docker Compose

- Start (served at `http://localhost:3021`):
  - `docker compose up -d --build`
- Stop:
  - `docker compose down`

## Interaction summary

- **Boot sequence**
  - Starts in **BOOTING**
  - Progress bar + boot lines populate
  - Subsystems transition **OFFLINE → SYNCING → NOMINAL**
  - Telemetry “wakes up” and begins drifting
  - Radar sweep/contacts animate
  - Logs populate with initialization messages

- **Global modes**
  - **OPS CYAN**: cold-cyan operations mode
  - **RED ALERT**: global palette shift, subtle panel pulse, alerts injected, telemetry jitter increases
  - **LOW POWER**: monochrome/greenish conservation look

- **Commands (bottom strip)**
  - **ARM**: toggles readiness state (`SAFE ↔ ARMED`)
  - **VENT**: temporarily drops pressure/thermal drift
  - **SYNC**: temporarily stabilizes comms/noise + boosts “link quality”
  - **PURGE**: clears logs and resets alert count
  - **LOCK**: locks the console (controls become disabled-looking and actions are blocked)

- **Log controls**
  - **ACK**: acknowledges alerts (resets count)
  - **CLEAR**: clears log
  - **INJECT**: adds a demo incident line

- **Keyboard shortcuts**
  - `P` power toggle
  - `A` alert toggle
  - `L` lock toggle
  - `1` ping radar
  - `2` sweep boost
  - `3` toggle IFF
  - `4` ack alerts
  - `5` purge logs

## Key CSS techniques used

- **CSS custom properties** for theming + live widget parameters
- **Layered gradients** for “industrial glass” + internal illumination
- **Pseudo-elements** for chrome edges, grid overlays, and sheen passes
- **`conic-gradient` radar sweep** and circular masking
- **Keyframe animation** for pulse states, scanline drift, sweep rotation, and equalizer motion
- **Responsive grid** with breakpoints and `clamp()` sizing
- **Focus-visible** styling and improved keyboard usability
- **Styled scrollbars** for the log and boot sequence

## Future enhancements

- Add an optional `print.css` for “console report” output
- Add panel collapse/expand states and a command palette
- Add a “topology” subsystem map (CSS grid + pseudo-element wiring)
- Add a richer boot path with deterministic stages and fault injection

