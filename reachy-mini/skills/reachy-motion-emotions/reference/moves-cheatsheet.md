# Recorded moves & emotions cheat-sheet

Module: `reachy_mini/motion/recorded_move.py` and `reachy_mini/motion/move.py`.

## Load a library

```python
from reachy_mini.motion.recorded_move import RecordedMoves
emotions = RecordedMoves("pollen-robotics/reachy-mini-emotions-library")
dances   = RecordedMoves("pollen-robotics/reachy-mini-dances-library")
```

Default datasets (`recorded_move.py:23-26`) are the two above. You can pass any
HuggingFace dataset name.

## RecordedMoves API

| Call | Returns | Notes |
|------|---------|-------|
| `RecordedMoves(hf_dataset_name)` | instance | local cache first, network fallback |
| `.list_moves()` | `List[str]` | the ONLY way to know valid names |
| `.get(name)` | `RecordedMove` | raises `ValueError` if missing |

## RecordedMove API

| Member | Type | Notes |
|--------|------|-------|
| `.description` | str | |
| `.duration` | float (property) | seconds |
| `.sound_path` | str or None | auto-played when `sound=True` |
| `.evaluate(t)` | `(head 4x4, antennas rad, body_yaw rad)` | sample at time t |

## Playback

`ReachyMini.play_move(move, play_frequency=100.0, initial_goto_duration=0.0,
sound=True)`

- `play_frequency` — evaluation/push rate in Hz.
- `initial_goto_duration > 0` — `goto_target`s into the t=0 frame first.
- `sound=True` + `move.sound_path` set — audio auto-syncs at loop start.
- Blocks the calling thread until the move finishes; run on a worker thread if
  you must stay responsive.

`ReachyMini.cancel_move()` — stops at the next loop iteration, stops audio.

## Custom move contract

Subclass `reachy_mini/motion/move.py#Move`:

```python
class MyMove(Move):
    @property
    def duration(self): ...            # seconds
    def evaluate(self, t):             # 0 <= t <= duration
        return head_4x4, antennas_rad, body_yaw_rad
```

Keep every sampled pose within the joint limits (pitch/roll ±40°, head yaw
±180°, body yaw ±160°, |head_yaw − body_yaw| ≤ 65°).

## Names are runtime-only

There is NO static list of emotion/dance names in the repo. `"happy"`, etc. come
from the dataset contents. Always `list_moves()` and guard against `ValueError`.
