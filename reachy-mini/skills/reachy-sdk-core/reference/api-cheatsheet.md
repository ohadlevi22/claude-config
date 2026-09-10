# reachy-sdk-core API cheat-sheet

All symbols verified in the capability map. `file#symbol` paths are relative to
the SDK repo root.

## Imports

```python
from reachy_mini import ReachyMini, ReachyMiniApp
from reachy_mini.utils import create_head_pose
from reachy_mini.utils.interpolation import InterpolationTechnique
```

## Connection

| Call | Notes |
|------|-------|
| `ReachyMini(...)` | `reachy_mini.py#ReachyMini.__init__`; `connection_mode="auto"` default |
| `with ReachyMini() as mini:` | releases media + disconnects on exit |
| `ReachyMini(use_sim=True)` | simulated robot |
| `ReachyMini(spawn_daemon=True)` | spawn a daemon if none running |

## Motion

| Call | Blocking? | Units |
|------|-----------|-------|
| `set_target(head, antennas, body_yaw)` | no (one frame) | head 4x4; antennas/body_yaw rad |
| `goto_target(head, antennas, duration=0.5, method=..., body_yaw=0.0)` | **yes** | duration s; must be > 0 |
| `set_target_head_pose(pose)` | no | 4x4 |
| `set_target_antenna_joint_positions([r, l])` | no | rad |
| `set_target_body_yaw(v)` | no | rad |
| `look_at_world(x, y, z, duration=1.0)` | depends | meters |
| `look_at_image(u, v, duration=1.0)` | depends | pixels |

## State

| Call | Returns |
|------|---------|
| `get_current_head_pose()` | 4x4 |
| `get_current_joint_positions()` | `(head[7], antennas[2])` |
| `get_present_antenna_joint_positions()` | `[right, left]` |

## Motors / behaviors / mode

| Call | Notes |
|------|-------|
| `enable_motors(ids=None)` | call BEFORE `set_target` |
| `disable_motors(ids=None)` | |
| `enable_gravity_compensation()` / `disable_gravity_compensation()` | |
| `wake_up()` / `goto_sleep()` | play built-in sounds |
| `set_automatic_body_yaw(enabled)` | default True |

## Interpolation methods

`"linear"`, `"minjerk"` (default), `"ease_in_out"`, `"cartoon"`.

## Pose builder

`create_head_pose(x=0, y=0, z=0, roll=0, pitch=0, yaw=0, mm=False, degrees=True)`
→ 4x4 ndarray. Frame: x forward, y left, z up.
