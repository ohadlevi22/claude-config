---
name: python-app-quality
description: >-
  Engineering hygiene for Reachy Mini Python apps — pyproject.toml + .venv, ruff
  lint/format, pytest against a hardware-free MockReachyMini that enforces joint
  limits, type hints, and async/threaded control-loop patterns that never block.
  Use this whenever you are setting up, testing, linting, or reviewing the
  quality of a Reachy Mini Python app, or deciding goto_target vs set_target in a
  loop. Triggers: "test the Reachy app", "MockReachyMini", "pyproject / venv /
  ruff / pytest", "CI without hardware", "control loop", "10 Hz loop", "never
  block the loop", "goto_target vs set_target", "type hints". Complements
  `reachy-app-template` and `reachy-sdk-core`.
---

# python-app-quality

Tooling and control-loop patterns that keep a Reachy Mini Python app safe,
testable, and CI-friendly without hardware. This skill teaches process and
patterns, not new SDK symbols (those live in `reachy-sdk-core` et al).

## When to use

- Setting up `pyproject.toml`, `.venv`, `ruff`, `pytest` for a Reachy app.
- Writing motion tests against `MockReachyMini` (no hardware in CI).
- Choosing `goto_target` vs `set_target` and structuring a control loop.
- Reviewing an app for blocking calls, missing `stop_event` handling, or
  joint-limit violations.

## Project layout & tooling

- **`pyproject.toml` (PEP 621)** with `[project]` (name/version/deps — pin
  `reachy_mini`), `[project.optional-dependencies].dev` = `ruff`, `pytest`,
  `pytest-asyncio`, a `[project.scripts]` entry point, and `[tool.ruff]` /
  `[tool.pytest.ini_options]` config. Use an isolated `.venv`.
- **Lint/format**: `ruff check` + `ruff format`. Keep CI clean.
- **Type hints** on all public functions — especially the control-loop surface,
  where signature drift bites.
- **Testing**: `pytest` against `MockReachyMini` so CI never needs hardware. The
  mock enforces joint limits, so unsafe-motion tests fail fast. See
  [`reference/mock_reachy.py`](reference/mock_reachy.py) for a ready double.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
ruff check . && ruff format --check .
pytest
```

## Control-loop patterns (the #1 motion bug is mixing these up)

- **Real-time loop (10 Hz+)**: compute the next frame → `mini.set_target(...)` →
  sleep to hold cadence. **Never** call the blocking `goto_target` / `play_move`
  / network I/O inside it.
- **Discrete gesture (≥ ~0.5 s)**: a single `goto_target(..., duration>=0.5)`
  blocks until done. If the UI/app must stay responsive, run it off the
  responsive thread.
- **Always honor `stop_event`** from `ReachyMiniApp.run` — check it every
  iteration; use `stop_event.wait(dt)` instead of `time.sleep(dt)` so a stop is
  immediate.

### goto_target vs set_target

| | `goto_target` | `set_target` |
|--|---------------|--------------|
| Interpolated | yes (min-jerk default) | no (snaps) |
| Blocking | **yes** — waits for completion | no — one frame |
| Use for | discrete gestures ≥ ~0.5 s | real-time loops you time yourself |
| `duration` | must be `> 0` (0 raises `ValueError`) | n/a |

(Mirrors capability map §3 / `AGENTS.md:111-116`.)

## DO

- Pin the SDK and dev tools in `pyproject.toml`; use an isolated `.venv`.
- Type-hint public functions; keep `ruff` clean in CI.
- Write every motion test against `MockReachyMini` and assert clamp behavior
  (requested vs clamped) and call order (`enable_motors` before `set_target`).
- Ensure `goto_target` durations are `> 0` (0 raises `ValueError` — use
  `set_target`).
- Use `stop_event.wait(dt)` to pace loops responsively.

## DON'T

- Don't put blocking calls (`goto_target`, `play_move`, network I/O, or `sleep`
  beyond cadence) inside a high-rate `set_target` loop.
- Don't test against real hardware in CI.
- Don't skip type hints on the control-loop surface.
- Don't rely on the SDK's auto-clamp instead of validating ranges — the mock
  records the clamp so your tests catch out-of-range intent.

## Copy-paste snippets

### A non-blocking 20 Hz control loop

```python
import time
import numpy as np
from reachy_mini import ReachyMini, ReachyMiniApp
from reachy_mini.utils import create_head_pose

HZ = 20
DT = 1.0 / HZ


class SwayApp(ReachyMiniApp):
    def run(self, reachy_mini: ReachyMini, stop_event) -> None:
        reachy_mini.enable_motors()                 # before set_target
        t0 = time.monotonic()
        while not stop_event.is_set():
            t = time.monotonic() - t0
            yaw_deg = 20.0 * np.sin(2 * np.pi * 0.25 * t)   # within limits
            head = create_head_pose(yaw=yaw_deg, degrees=True)
            reachy_mini.set_target(head=head)        # non-blocking, one frame
            # hold cadence WITHOUT a blocking sleep; stop is immediate
            if stop_event.wait(DT):
                break
```

### pytest against the mock (asserts clamp + call order)

```python
import numpy as np
from reachy_mini.utils import create_head_pose
from my_reachy_app.mock_reachy import MockReachyMini   # see reference/mock_reachy.py


def test_enable_motors_before_set_target():
    with MockReachyMini() as mini:
        mini.enable_motors()
        mini.set_target(head=create_head_pose(pitch=10, degrees=True))
    order = [c[0] for c in mini.calls]
    assert order.index("enable_motors") < order.index("set_target")


def test_pitch_is_clamped_to_40_degrees():
    with MockReachyMini(strict=False) as mini:   # mirror real auto-clamp
        mini.enable_motors()
        mini.set_target(head=create_head_pose(pitch=80, degrees=True))
    last = mini.last_target
    assert abs(np.degrees(last["pitch"])) <= 40 + 1e-6      # clamped from 80


def test_goto_duration_zero_raises():
    import pytest
    with MockReachyMini() as mini:
        with pytest.raises(ValueError):
            mini.goto_target(head=create_head_pose(), duration=0.0)
```

## Reference material

- `docs/source/SDK/python-sdk.md`, `AGENTS.md:111-116` (goto vs set_target).
- ruff / pytest / PEP 621 docs.
- [`reference/mock_reachy.py`](reference/mock_reachy.py),
  [`reference/pyproject-shape.md`](reference/pyproject-shape.md).
