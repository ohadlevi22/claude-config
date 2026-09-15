# Reachy Mini joint safety limits

The SDK **auto-clamps** every target to the nearest valid value
(`docs/source/SDK/core-concept.md:35`, `AGENTS.md:230`). Clamping silently
changes intent, so validate ranges before issuing a target.

## User-facing RPY / yaw limits

| Joint / Axis | Range | Units |
|--------------|-------|-------|
| Head Pitch | -40° … +40° | degrees |
| Head Roll | -40° … +40° | degrees |
| Head Yaw | -180° … +180° | degrees |
| Body Yaw | -160° … +160° | degrees |
| Yaw Delta (head − body) | ≤ 65° difference | degrees |

Sources: `docs/source/SDK/core-concept.md:37-42`, `AGENTS.md:223-229`.

## Enforcement in code

`kinematics/analytical_kinematics.py:85-89` (`inverse_kinematics_safe`):

```python
max_relative_yaw = np.deg2rad(65)    # yaw delta head-vs-body
max_body_yaw     = np.deg2rad(160)   # body yaw
```

Placo kinematics (`kinematics/placo_kinematics.py`):
- `yaw_body` joint hard limit `[-2.8, 2.8]` rad ≈ ±160.4° (`:226-227`).
- Max joint velocity `13.0 rad/s` (`:220`).

## Raw per-motor tick limits (hardware, not user API)

Live in `src/reachy_mini/assets/config/hardware_config.yaml`:
- Stewart motors: measured lower/upper roughly -48° … +80°.
- `body_rotation`: `lower_limit: 1138`, `upper_limit: 2844` ticks.

These are not a clean user-facing API. Use the RPY/body-yaw ranges above.
"Gentle collisions with body are safe" (`AGENTS.md:230`).

## The one everyone forgets

`|head_yaw − body_yaw| ≤ 65°`. You can command head yaw to ±180° and body yaw to
±160° individually, but their **difference** is capped at 65°. With
`automatic_body_yaw=True` (default) the IK moves the body to keep the delta
legal; with it disabled you own that constraint.
