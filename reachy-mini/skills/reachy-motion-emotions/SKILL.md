---
name: reachy-motion-emotions
description: >-
  Play Reachy Mini library emotions and dances, sync sound to motion, and author
  custom procedural moves — all without blocking the control loop. Use this
  whenever the request is about Reachy expressing an emotion or playing a
  named/recorded move. Triggers: "make Reachy happy / sad / dance / nod / wave",
  "play an emotion", "play a move", "recorded moves", "emotions library",
  "list_moves", "play_move", "cancel_move", "custom move / gesture", "wobble to
  music", "sync sound to motion". Build on `reachy-sdk-core` for connection and
  the goto/set_target motion primitives.
---

# reachy-motion-emotions

Play library emotions/dances, sync their audio, and blend custom motion — the
expressive layer on top of `reachy-sdk-core`. **Python-only** (`import
reachy_mini`); the JS SDK's `playMove` is a separate flavor.

## When to use

- "Make Reachy do <emotion/dance>" using the shipped move libraries.
- Playing a recorded move with synced sound.
- Authoring a procedural/symbolic move by subclassing `Move`.
- Interrupting a running move cleanly.

## Exact SDK APIs

Cited `file#symbol` (paths relative to the SDK repo root).

**Move library** — `reachy_mini/motion/recorded_move.py#RecordedMoves`
- `RecordedMoves(hf_dataset_name)` — loads a HuggingFace **dataset** of moves
  (local cache first, network fallback).
- `#RecordedMoves.get(move_name)` → `RecordedMove`; raises `ValueError` if the
  name is missing.
- `#RecordedMoves.list_moves()` → `List[str]`.
- Default datasets (`recorded_move.py:23-26`):
  `pollen-robotics/reachy-mini-emotions-library`,
  `pollen-robotics/reachy-mini-dances-library`.

**Move object** — `reachy_mini/motion/recorded_move.py#RecordedMove`
- Fields/props: `.description`, `.duration`, `.sound_path`,
  `.evaluate(t)` → `(head 4x4, antennas rad, body_yaw rad)`.

**Abstract base for custom moves** — `reachy_mini/motion/move.py#Move`
- Implement `.duration` and `.evaluate(t) -> (head 4x4, antennas rad,
  body_yaw rad)`.

**Playback** — `reachy_mini/reachy_mini.py`
- `#ReachyMini.play_move(move, play_frequency=100.0, initial_goto_duration=0.0,
  sound=True)`. When `move.sound_path` is set and `sound=True`, audio auto-syncs
  at loop start. The loop evaluates the move at `play_frequency` Hz and pushes
  per-frame `set_target_head_pose` / `set_target_body_yaw` /
  `set_target_antenna_joint_positions`. `initial_goto_duration > 0` first
  `goto_target`s into the move's t=0 frame.
- `#ReachyMini.cancel_move()` — stops the running move at the next loop
  iteration and stops audio.

**Custom recording** — `#ReachyMini.start_recording`,
`#ReachyMini.stop_recording` (returns recorded data list).

**Audio-reactive wobble** — `#ReachyMini.enable_wobbling`,
`#ReachyMini.disable_wobbling`.

## Emotion / dance names are runtime-only

Names like `"happy"` live in the HF dataset, **not** in the repo — there is no
static list to validate against at authoring time. Always enumerate with
`moves.list_moves()` and fall back gracefully. `.get()` raises `ValueError` on a
missing name.

## DO

- Enumerate names at runtime with `moves.list_moves()`; guard `.get()` against
  `ValueError`.
- Use `initial_goto_duration > 0` to glide smoothly into the move's first frame.
- Author custom motion by subclassing `Move` and returning
  `(head 4x4, antennas rad, body_yaw rad)` from `.evaluate(t)` — stay within the
  joint limits from `reachy-sdk-core`.
- Use `cancel_move()` to interrupt.

## DON'T

- Don't hardcode a move name without a `list_moves()` fallback.
- Don't run `play_move` on a thread that must stay responsive — it runs a
  playback loop until the move finishes (or `cancel_move`).
- Don't double-drive the robot: while a move plays it is already pushing
  per-frame `set_target_*`; don't issue competing targets simultaneously.
- Don't assume degrees — `evaluate(t)` returns antennas/body_yaw in **radians**
  and head as a 4x4 pose (build it with `create_head_pose`).

## Copy-paste snippets

### Play a library emotion, safely

```python
from reachy_mini import ReachyMini
from reachy_mini.motion.recorded_move import RecordedMoves

moves = RecordedMoves("pollen-robotics/reachy-mini-emotions-library")

with ReachyMini() as mini:
    mini.enable_motors()
    print("available:", moves.list_moves())   # names come from the dataset
    name = "happy"
    if name in moves.list_moves():
        mini.play_move(moves.get(name), initial_goto_duration=1.0)  # glides in, syncs sound
```

### Play a dance, interrupt after a while

```python
import threading, time
from reachy_mini import ReachyMini
from reachy_mini.motion.recorded_move import RecordedMoves

dances = RecordedMoves("pollen-robotics/reachy-mini-dances-library")

with ReachyMini() as mini:
    mini.enable_motors()
    move = dances.get(dances.list_moves()[0])
    t = threading.Thread(target=mini.play_move, args=(move,), daemon=True)
    t.start()
    time.sleep(3.0)
    mini.cancel_move()      # stops at next loop iteration + stops audio
    t.join()
```

### Custom procedural move (subclass `Move`)

```python
import numpy as np
from reachy_mini import ReachyMini
from reachy_mini.motion.move import Move
from reachy_mini.utils import create_head_pose

class SlowNod(Move):
    def __init__(self, period=2.0, amplitude_deg=15.0):
        self._period = period
        self._amp = amplitude_deg

    @property
    def duration(self):
        return self._period

    def evaluate(self, t):
        pitch = self._amp * np.sin(2 * np.pi * t / self._period)   # within ±40°
        head = create_head_pose(pitch=pitch, degrees=True)          # 4x4
        antennas = np.array([0.0, 0.0])                             # [right, left] rad
        body_yaw = 0.0                                              # rad
        return head, antennas, body_yaw

with ReachyMini() as mini:
    mini.enable_motors()
    mini.play_move(SlowNod(), play_frequency=100.0)
```

## Reference material

- `reachy_mini/motion/recorded_move.py`, `reachy_mini/motion/move.py`.
- `examples/recorded_moves.py`, `AGENTS.md:302-305`.
- [`reference/moves-cheatsheet.md`](reference/moves-cheatsheet.md).
