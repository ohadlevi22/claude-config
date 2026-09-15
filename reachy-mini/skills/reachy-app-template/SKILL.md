---
name: reachy-app-template
description: >-
  Create a well-formed, discoverable Reachy Mini app — the plan.md-first
  convention, the `reachy-mini-app-assistant` CLI, the `ReachyMiniApp` subclass
  structure, the static web UI, and the daemon REST/WS surface apps talk to. Use
  this whenever you are starting, scaffolding, structuring, or publishing a
  Reachy Mini app. Triggers: "build / create / scaffold a Reachy Mini app",
  "reachy-mini-app-assistant", "ReachyMiniApp", "app structure / run() /
  stop_event", "conversation template", "publish the app", "static web UI",
  "daemon REST API", "Python vs JS app". Pulls in the motion/audio/vision skills
  for the app body.
---

# reachy-app-template

Scaffold and structure a Reachy Mini app the right way. This skill owns the
process rules; the app body uses `reachy-sdk-core`, `reachy-motion-emotions`,
`reachy-audio-voice`, and `reachy-vision`, with `python-app-quality` for tooling
and tests.

## When to use

- Kicking off any new Reachy Mini app.
- Deciding Python vs JS flavor.
- Structuring the `ReachyMiniApp` subclass and its `run()`/`stop_event`.
- Serving a static web UI or talking to the daemon REST/WS API.
- Publishing to the robot app store.

## plan.md FIRST (mandatory)

Per `AGENTS.md:65-73` / `:159`: **before writing any app code**, create
`plan.md` in the app dir with your understanding + technical approach +
clarifying questions (each with an answer field), and **wait for user approval**.
Applies to both Python and JS. Do not scaffold or write code before plan.md is
approved. Template: [`reference/plan-template.md`](reference/plan-template.md).

## Python vs JS flavor (repo conflict — resolve up front)

The repo conflicts: `AGENTS.md` defaults to **JS** for shareable/zero-install;
`skills/create-app.md` says **"always Python."** Reconciliation (`AGENTS.md:202`):

> **Python is required for an app to be discoverable in the store or to run
> on-robot compute. JS is for shareable/zero-install experiences.**

This skill **defaults to Python** and confirms the flavor with the user before
scaffolding. (JS golden path: `ts/APP_CREATION_GUIDE.md`,
`skills/create-js-app.md`; JS SDK is degrees-first — don't mix flavors.)

## Exact SDK APIs

**App base class** — `reachy_mini/apps/app.py#ReachyMiniApp`, imported
`from reachy_mini import ReachyMiniApp`.
- Subclass and implement:
  `run(self, reachy_mini: ReachyMini, stop_event: threading.Event) -> None`.
- Class attributes: `custom_app_url`, `dont_start_webserver`,
  `request_media_backend`.
- `#ReachyMiniApp.wrapped_run` opens the `ReachyMini` context for you and picks
  `localhost_only`/`network` automatically — you get a live `reachy_mini` in
  `run()`, so **don't** open your own `with ReachyMini()` inside `run()`.

**CLI** — `reachy_mini/apps/app.py#main` (`reachy-mini-app-assistant`),
subcommands `create` / `check` / `publish` (argparse `#parse_args`):

```bash
reachy-mini-app-assistant create <app_name> <path> --publish
reachy-mini-app-assistant create --template conversation <app_name> <path> --publish
```

- Templates: `default` (blank), `conversation` (LLM/speech scaffold).
- Both `app_name` and `path` are required for non-interactive use.
- `--publish` needs `hf auth login`.
- **Never hand-create app folders** (`AGENTS.md:52`, `create-app.md:24`) — always
  scaffold via the CLI.

**Static web UI** — served from the app's `static/` folder at `/static`
(`apps/app.py:66-78`).

**Daemon REST/WS surface** — base `http://{daemon-ip}:8000/api` (`sdk_ws` at
root). Interactive docs at `http://{daemon-ip}:8000/docs`. Key routers in
[`reference/rest-api.md`](reference/rest-api.md):
- Motion `routers/move.py`: `POST /move/goto`, `POST /move/set_target`,
  `POST /move/stop`, `WS /move/ws/set_target`, `WS /move/ws/updates`.
- State `routers/state.py`: `GET /state/full`, `WS /state/ws/full`.
- Media/Volume/Camera/Motors/Apps routers.
- Primary SDK transport: `WS /ws/sdk` (`routers/sdk_ws.py`).

## App structure

```
my_reachy_app/
├── plan.md                     # written & approved FIRST
├── pyproject.toml              # PEP 621 + ruff/pytest, entry point
├── README.md
├── src/my_reachy_app/
│   ├── __init__.py
│   ├── app.py                  # ReachyMiniApp subclass; run(reachy_mini, stop_event)
│   ├── motions.py              # create_head_pose gestures / Move subclasses
│   └── mock_reachy.py          # MockReachyMini (see python-app-quality)
├── static/                     # web UI served at /static (optional)
└── tests/
```

## DO

- Write and get approval on `plan.md` before any code.
- Scaffold via `reachy-mini-app-assistant create` — never hand-make folders.
- Honor `stop_event` in `run()` — check it every loop iteration for a clean stop.
- Put web assets under `static/`.
- Use the `reachy_mini` passed into `run()` (via `wrapped_run`), not a new
  context manager.
- Run `reachy-mini-app-assistant check` before `publish`.

## DON'T

- Don't start coding before an approved `plan.md`.
- Don't manually build the app directory structure.
- Don't block inside `run()` without ever checking `stop_event`.
- Don't open a second `with ReachyMini()` inside `run()` — the app framework
  already provides one.
- Don't assume a JS-flavored app is discoverable in the store — that requires
  Python (`AGENTS.md:202`).

## Copy-paste snippets

### Minimal ReachyMiniApp

```python
import time
from reachy_mini import ReachyMini, ReachyMiniApp
from reachy_mini.utils import create_head_pose


class WaveApp(ReachyMiniApp):
    def run(self, reachy_mini: ReachyMini, stop_event) -> None:
        reachy_mini.enable_motors()           # before set_target
        reachy_mini.wake_up()
        while not stop_event.is_set():         # honor stop_event every iteration
            reachy_mini.goto_target(
                head=create_head_pose(yaw=20, degrees=True),
                duration=0.6, method="minjerk",
            )
            if stop_event.wait(0.1):           # responsive sleep
                break
            reachy_mini.goto_target(
                head=create_head_pose(yaw=-20, degrees=True),
                duration=0.6, method="minjerk",
            )
        reachy_mini.goto_sleep()
```

### Scaffold commands

```bash
# blank app
reachy-mini-app-assistant create my_reachy_app ./my_reachy_app
# conversational (LLM/speech) scaffold
reachy-mini-app-assistant create --template conversation my_voice_app ./my_voice_app
# validate before shipping
reachy-mini-app-assistant check ./my_reachy_app
# publish (needs: hf auth login)
reachy-mini-app-assistant publish ./my_reachy_app
```

## Reference material

- `reachy_mini/apps/app.py`, `AGENTS.md`, `skills/create-app.md`,
  `ts/APP_CREATION_GUIDE.md` (JS), `daemon/app/routers/`, `skills/rest-api.md`.
- [`reference/plan-template.md`](reference/plan-template.md),
  [`reference/rest-api.md`](reference/rest-api.md).
