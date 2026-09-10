---
name: reachy-sdk-core
description: >-
  Foundational Reachy Mini SDK skill — connect to the robot and issue safe head
  6-DOF, body-yaw, and antenna targets from Python. Use this whenever you are
  writing or reviewing Reachy Mini Python code that imports `reachy_mini`,
  constructs `ReachyMini`, builds a head pose, moves the head/antennas/body, or
  reads robot state. Triggers: "connect to Reachy", "move Reachy's head", "set
  target", "goto target", "create_head_pose", "body yaw", "antennas", "look at",
  "joint limits", "enable motors", "wake up / go to sleep". This is the base
  skill every other Reachy skill builds on.
---

# reachy-sdk-core

Connect to a Reachy Mini and drive the head (6-DOF), body-yaw, and antennas
**safely** from Python. Every API below is grounded in the verified capability
map — no invented methods. If a symbol is not listed here, do not assume it
exists; read the cited SDK file.

**Flavor: Python.** This skill is Python-only (`import reachy_mini`). The JS SDK
is degrees-first and has different method names — do not mix the two. Confirm the
app flavor with the user up front (see `reachy-app-template`).

## When to use

- Establishing a connection to the robot / simulator.
- Any single head/antenna/body-yaw motion, immediate or interpolated.
- Reading current pose or joint state.
- As the prerequisite skill under `reachy-motion-emotions`, `reachy-vision`,
  `reachy-audio-voice`, and `reachy-app-template`.

## Exact SDK APIs

Cited `file#symbol` (paths relative to the SDK repo root).

**Connection** — `reachy_mini/reachy_mini.py#ReachyMini`
- Constructor `#ReachyMini.__init__`. Key defaults: `robot_name="reachy_mini"`,
  `host="reachy-mini.local"`, `port=8000`,
  `connection_mode="auto"` (tries `localhost:8000`, then `host:port`),
  `spawn_daemon=False`, `use_sim=False`, `automatic_body_yaw=True`.
- Context manager `#ReachyMini.__enter__` / `#ReachyMini.__exit__` — releases
  media and disconnects the client on exit. **Always** use `with`.
- Connection failure raises `ConnectionError`. A daemon must be running;
  `spawn_daemon=True` can start one, `use_sim=True` spawns a simulated robot.

**Pose builder** — `reachy_mini/utils/__init__.py#create_head_pose`
- `create_head_pose(x=0, y=0, z=0, roll=0, pitch=0, yaw=0, mm=False, degrees=True)`
  → 4x4 `np.ndarray`. `degrees=True` treats angles as degrees; `mm=True` treats
  x/y/z as millimeters. Frame: origin at neutral head, **x forward, y left,
  z up** (`docs/source/SDK/core-concept.md`).

**Motion primitives** — all on `reachy_mini/reachy_mini.py`
- `#ReachyMini.set_target(head=None, antennas=None, body_yaw=None)` — immediate,
  non-blocking, one frame. `head` is 4x4; `antennas=[right, left]` radians;
  `body_yaw` radians. At least one arg required.
- `#ReachyMini.goto_target(head=None, antennas=None, duration=0.5,
  method=InterpolationTechnique.MIN_JERK, body_yaw=0.0)` — smooth interpolated
  move that **blocks** until complete. `duration` must be `> 0` (0 raises
  `ValueError` — use `set_target` instead). `body_yaw=None` keeps current yaw.
- `#ReachyMini.set_target_head_pose(pose)` — head only, 4x4, immediate.
- `#ReachyMini.set_target_antenna_joint_positions(antennas)` — `[right, left]`
  radians, immediate.
- `#ReachyMini.set_target_body_yaw(body_yaw)` — radians, immediate.
- `#ReachyMini.look_at_world(x, y, z, duration=1.0, perform_movement=True)` —
  meters, x fwd / y left / z up.
- `#ReachyMini.look_at_image(u, v, duration=1.0, perform_movement=True)` — pixels
  (needs camera; see `reachy-vision`).

**State reads**
- `#ReachyMini.get_current_head_pose()` → 4x4.
- `#ReachyMini.get_current_joint_positions()` → `(head[7], antennas[2])`. The
  head vector is `[body_yaw, stewart_platform x6]`.
- `#ReachyMini.get_present_antenna_joint_positions()` → `[right, left]`.

**Body-yaw mode** — `#ReachyMini.set_automatic_body_yaw(enabled)` (constructor
default `automatic_body_yaw=True`; IK modulates body yaw to respect limits).

**Motors / torque**
- `#ReachyMini.enable_motors(ids=None)`, `#ReachyMini.disable_motors(ids=None)`.
- `#ReachyMini.enable_gravity_compensation()`,
  `#ReachyMini.disable_gravity_compensation()`.
- Motor names: `body_rotation`, `stewart_1`…`stewart_6`, `right_antenna`,
  `left_antenna`.

**Behaviors** — `#ReachyMini.wake_up()` (plays `wake_up.wav`),
`#ReachyMini.goto_sleep()` (plays `go_sleep.wav`).

**Interpolation enum** —
`reachy_mini/utils/interpolation.py#InterpolationTechnique`:
`"linear"`, `"minjerk"` (default), `"ease_in_out"`, `"cartoon"` (strings or
enum).

## Joint safety limits

The SDK auto-clamps to the nearest valid value, but clamping silently changes
intent — validate ranges yourself. Full table in
[`reference/joint-limits.md`](reference/joint-limits.md).

| Axis | Range |
|------|-------|
| Head pitch | [-40°, +40°] |
| Head roll | [-40°, +40°] |
| Head yaw | [-180°, +180°] |
| Body yaw | [-160°, +160°] |
| Yaw delta (head − body) | ≤ 65° |

Source: `docs/source/SDK/core-concept.md:37-42`, `AGENTS.md:223-229`, enforced in
`kinematics/analytical_kinematics.py:85-89`
(`max_relative_yaw=deg2rad(65)`, `max_body_yaw=deg2rad(160)`).

## DO

- **Always** use the `with ReachyMini() as mini:` context manager so media and
  the client are released on exit.
- Build head poses with `create_head_pose`, never hand-rolled 4x4 matrices.
- Antennas are always `[right, left]` in **radians**.
- Call `enable_motors()` **before** `set_target` — `enable_motors` pins targets
  to the present pose (`set_target` docstring, `reachy_mini.py:539`).
- Use `goto_target` for discrete gestures ≥ ~0.5 s (it blocks); use `set_target`
  for real-time loops you time yourself (see `python-app-quality`).
- Keep `|head_yaw − body_yaw| ≤ 65°` — the most-missed limit.

## DON'T

- Don't call the underscore-prefixed direct joint setters
  (`_set_joint_positions`, `_goto_joint_positions`) — internal, not API.
- Don't assume degrees in the SDK primitives: `set_target`/`goto_target` take
  **radians** for antennas/body_yaw. Only `create_head_pose(degrees=True)` and
  the JS SDK are degrees-first.
- Don't rely on auto-clamp to "fix" bad math — it changes intent silently.
- Don't call `goto_target(..., duration=0)` — it raises `ValueError`.
- Don't block a high-rate `set_target` loop with `goto_target`/`play_move`/I/O.

## Copy-paste snippets

### Connect, wake up, one interpolated gesture

```python
import numpy as np
from reachy_mini import ReachyMini
from reachy_mini.utils import create_head_pose

with ReachyMini() as mini:          # connection_mode="auto" by default
    mini.enable_motors()            # BEFORE set_target — pins targets to present pose
    mini.wake_up()

    # Look up-and-right, smoothly (blocks ~0.8s). Angles in degrees here.
    pose = create_head_pose(pitch=-15, yaw=30, degrees=True)   # 4x4 ndarray
    mini.goto_target(head=pose, duration=0.8, method="minjerk")

    mini.goto_sleep()
```

### Immediate target (single frame — use inside a loop you time)

```python
import numpy as np
from reachy_mini import ReachyMini
from reachy_mini.utils import create_head_pose

with ReachyMini() as mini:
    mini.enable_motors()
    pose = create_head_pose(roll=10, degrees=True)
    # antennas [right, left] in radians; body_yaw in radians
    mini.set_target(head=pose, antennas=[0.3, -0.3], body_yaw=np.deg2rad(20))
```

### Read state

```python
with ReachyMini() as mini:
    head_pose = mini.get_current_head_pose()          # 4x4
    head_joints, antennas = mini.get_current_joint_positions()  # head[7], antennas[2]
    right, left = mini.get_present_antenna_joint_positions()
```

## Reference material

- `reachy_mini/reachy_mini.py` — core class.
- `reachy_mini/utils/__init__.py` — `create_head_pose`.
- `docs/source/SDK/core-concept.md` — frames + limits.
- `examples/minimal_demo.py` — runnable pattern.
- [`reference/joint-limits.md`](reference/joint-limits.md),
  [`reference/api-cheatsheet.md`](reference/api-cheatsheet.md).
