---
name: reachy-vision
description: >-
  Reachy Mini camera and vision — capture frames, feed them to local or cloud
  vision models, and use the built-in look-at / face-tracking helpers to make
  the head follow what it sees. Use this whenever the request involves Reachy's
  camera, seeing, tracking, or looking at something. Triggers: "make Reachy see /
  look at / follow / track", "camera frame", "get_frame", "face tracking",
  "look_at_image / look_at_world", "detect a face/object", "vision model",
  "camera specs", "IMU". Build on `reachy-sdk-core` for connection and motion.
---

# reachy-vision

Capture camera frames and drive the head toward what the robot sees. **Python-
only** (`import reachy_mini`). Pairs with `reachy-sdk-core` (look-at primitives)
and `reachy-audio-voice` (shared `media` handle).

## When to use

- Pulling camera frames for a numpy/OpenCV pipeline or a cloud vision API.
- Making the head look toward a detected pixel or 3D point.
- Daemon-side face tracking (follow a face without hand-rolling a loop).
- Reading the IMU (wireless unit only).

## Exact SDK APIs

**Frame capture** — `reachy_mini/media/media_manager.py` via
`reachy_mini/reachy_mini.py#ReachyMini.media`
- `#MediaManager.get_frame()` → `np.ndarray` shape `(H, W, 3)`, dtype `uint8`,
  or `None`.
- `#MediaManager.get_frame_jpeg()` → `bytes` or `None`.

**Look toward a detection** — `reachy_mini/reachy_mini.py`
- `#ReachyMini.look_at_image(u, v, duration=1.0, perform_movement=True)` — image
  pixel coordinates.
- `#ReachyMini.look_at_world(x, y, z, duration=1.0, perform_movement=True)` —
  meters; frame x forward, y left, z up.

**Daemon-side face tracking** — `reachy_mini/reachy_mini.py`
- `#ReachyMini.start_head_tracking(weight=1.0)`,
  `#ReachyMini.stop_head_tracking()`.
- `#ReachyMini.get_tracked_face(wait=True, timeout=5.0)` →
  `reachy_mini/io/protocol.py#FaceTarget` with fields
  `detected, x, y, roll, ts` (x, y in `[-1, 1]`).

**Camera specs (REST)** — `GET /api/camera/specs`
(`daemon/app/routers/camera.py`).

**IMU (wireless only)** — `#ReachyMini.imu` → dict with `accelerometer`,
`gyroscope`, `quaternion` `[w, x, y, z]`, `temperature`, or `None`.

## DO

- Pull frames with `get_frame()` for numpy pipelines (OpenCV, local models), or
  `get_frame_jpeg()` when POSTing to a cloud vision API.
- Prefer the built-in `start_head_tracking` for face-follow before hand-rolling
  a tracking loop.
- Guard against `None` frames (`get_frame`/`get_frame_jpeg` return `None` when no
  frame is available).
- Run heavy inference on a worker thread; feed only the result to `look_at_*` /
  `set_target`.

## DON'T

- Don't assume the camera is available if `media_backend="no_media"` was set and
  you released it — reacquire first (`acquire_media()`).
- Don't block the control loop doing per-frame inference inline — it kills loop
  cadence (see `python-app-quality`).
- Don't expect the IMU on the Lite/wired unit — it's wireless-only and may be
  `None`.
- Don't hardcode frame size — read `GET /api/camera/specs` or the frame's
  `.shape`.

## Copy-paste snippets

### Capture a frame (numpy) and a JPEG (for a cloud API)

```python
from reachy_mini import ReachyMini

with ReachyMini() as mini:
    frame = mini.media.get_frame()             # (H, W, 3) uint8 or None
    if frame is not None:
        h, w = frame.shape[:2]
        # ... run OpenCV / local model on `frame` ...

    jpeg = mini.media.get_frame_jpeg()         # bytes or None
    if jpeg is not None:
        # requests.post("https://vision.example/api", files={"image": jpeg})
        ...
```

### Look at a detected pixel (from your detector)

```python
from reachy_mini import ReachyMini

with ReachyMini() as mini:
    mini.enable_motors()
    frame = mini.media.get_frame()
    if frame is not None:
        u, v = run_detector(frame)             # your detector -> pixel coords
        mini.look_at_image(u, v, duration=1.0)  # head turns toward the pixel
```

### Built-in face tracking

```python
import time
from reachy_mini import ReachyMini

with ReachyMini() as mini:
    mini.enable_motors()
    mini.start_head_tracking(weight=1.0)
    try:
        for _ in range(100):
            face = mini.get_tracked_face(wait=True, timeout=5.0)
            if face.detected:
                print("face at", face.x, face.y, "roll", face.roll)  # x,y in [-1,1]
            time.sleep(0.05)
    finally:
        mini.stop_head_tracking()
```

## Reference material

- `reachy_mini/media/media_manager.py`, `reachy_mini/io/protocol.py`
  (`FaceTarget`).
- `examples/head_tracking.py`, `examples/take_picture.py`.
- `daemon/app/routers/camera.py`, `docs/source/SDK/python-sdk.md`.
