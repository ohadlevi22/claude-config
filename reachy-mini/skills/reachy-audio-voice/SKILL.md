---
name: reachy-audio-voice
description: >-
  Reachy Mini audio I/O and the conversational seam — read the microphone, play
  and push audio to the speaker, play sound files, query rates/channels/DoA, set
  volume (via REST, not Python), and wire a DIY STT→LLM→TTS voice loop. Use this
  whenever the request touches Reachy's mic, speaker, sound, volume, or
  conversation/voice. Triggers: "make Reachy talk / listen / speak", "voice",
  "conversation", "STT / TTS / LLM loop", "record audio", "play a sound", "push
  audio", "microphone", "direction of arrival / DoA", "set volume / mute",
  "no_media backend". Build on `reachy-sdk-core` for connection.
---

# reachy-audio-voice

Microphone/speaker I/O, sound playback, volume/mute, and the STT→LLM→TTS
conversational seam. **Python-only** (`import reachy_mini`). Two important gaps
are called out explicitly below — do not paper over them with invented APIs.

## When to use

- Capturing mic audio or playing/pushing audio to the speaker.
- Playing a sound file on the robot.
- Setting/reading volume or mic volume (must go through REST from Python).
- Building a voice/conversation loop (DIY STT/LLM/TTS).

## Exact SDK APIs

Access audio via `reachy_mini/reachy_mini.py#ReachyMini.media` →
`reachy_mini/media/media_manager.py#MediaManager`.

**Record / read mic**
- `#MediaManager.start_recording()` / `#MediaManager.stop_recording()`.
- `#MediaManager.get_audio_sample()` → `np.ndarray` shape `(samples, 2)`,
  `float32`, 16 kHz, or `None`.

**Play / push audio**
- `#MediaManager.start_playing()` / `#MediaManager.stop_playing()`.
- `#MediaManager.push_audio_sample(data)` — expects `(samples, 1|2)` `float32`
  @16 kHz; **non-blocking** (fire-and-forget, pace it yourself).
- `#MediaManager.play_sound(sound_file)`.

**Rates / channels**
- `#MediaManager.get_input_audio_samplerate()`,
  `#MediaManager.get_output_audio_samplerate()`,
  `#MediaManager.get_input_channels()`, `#MediaManager.get_output_channels()`.

**Direction of arrival**
- `#MediaManager.get_DoA()` → `(float, bool)` or `None`. Radians:
  `0 = left`, `π/2 = front/back`, `π = right`.

**Media backend selection** — constructor `media_backend=` +
`reachy_mini/media/media_manager.py#MediaBackend`:
`"default"` (auto: local if same machine, else webrtc), `"local"`, `"webrtc"`,
`"no_media"` (releases the daemon's camera/mic for direct OpenCV/sounddevice
access). Runtime toggles: `#ReachyMini.release_media`, `#ReachyMini.acquire_media`,
`media_released` property.

## SDK GAP 1 — no Python volume/mute method

There is **no** `ReachyMini.set_volume()` / `set_mic_muted()` in Python (NOT
FOUND in `reachy_mini.py`). From Python, go through **REST**:
`POST /api/volume/set`, `GET /api/volume/current`,
`POST /api/volume/microphone/set`, `GET /api/volume/microphone/current`
(`daemon/app/routers/volume.py`, values 0–100), or send the underlying protocol
command (`io/protocol.py#SetVolumeCmd`, etc.). The JS SDK has first-class
`setVolume` / `setMicMuted` — Python does not. See
[`reference/volume-and-audio.md`](reference/volume-and-audio.md).

## SDK GAP 2 — no verified `/v1/realtime` STT/LLM/TTS Python client

The capability map documents **no** `/v1/realtime` route and **no** built-in
STT/LLM/TTS Python client. The `--template conversation` app scaffold (see
`reachy-app-template`) is the intended entry point, but the realtime speech/LLM
loop is an app/JS-layer concern, not a verified Python SDK symbol. From Python,
the verified path is DIY:

> **capture mic with `get_audio_sample` → call your own STT / LLM / TTS service →
> play the reply with `push_audio_sample`.**

Do not assume a `/v1/realtime` Python client exists.

## DO

- Use `media_backend="no_media"` when you want direct OpenCV/sounddevice access
  to the mic/speaker (releases the daemon's grip).
- Treat `push_audio_sample` as fire-and-forget (non-blocking) and pace it
  yourself.
- Query samplerate/channels at runtime rather than assuming (format is
  documented as `(samples, 2)` float32 @16 kHz in prose, not a typed signature).
- Convert your STT/TTS audio to `float32` @16 kHz, shape `(samples, 1|2)` before
  `push_audio_sample`.

## DON'T

- Don't call `set_volume()` on `ReachyMini` — it does not exist; use REST.
- Don't assume a `/v1/realtime` Python client — it is not in the verified map.
- Don't hold two media consumers (daemon + direct OpenCV/sounddevice) on the same
  device at once — release first.
- Don't block a motion control loop on synchronous STT/LLM/TTS calls; run the
  voice pipeline on its own thread.

## Copy-paste snippets

### Capture a few seconds of mic audio

```python
import time, numpy as np
from reachy_mini import ReachyMini

with ReachyMini() as mini:
    media = mini.media
    print("mic rate:", media.get_input_audio_samplerate(),
          "channels:", media.get_input_channels())
    media.start_recording()
    chunks = []
    t_end = time.time() + 3.0
    while time.time() < t_end:
        sample = media.get_audio_sample()      # (samples, 2) float32 @16kHz or None
        if sample is not None:
            chunks.append(sample)
        time.sleep(0.01)
    media.stop_recording()
    audio = np.concatenate(chunks) if chunks else np.zeros((0, 2), dtype=np.float32)
```

### Play a sound file and push generated audio

```python
import numpy as np
from reachy_mini import ReachyMini

with ReachyMini() as mini:
    media = mini.media
    media.play_sound("/path/on/robot/chime.wav")

    media.start_playing()
    # tts_pcm: float32 @16kHz, shape (samples, 1) — from your own TTS service
    tts_pcm = np.zeros((16000, 1), dtype=np.float32)
    media.push_audio_sample(tts_pcm)           # non-blocking; pace chunks yourself
    media.stop_playing()
```

### DIY voice loop skeleton (STT → LLM → TTS)

```python
import time, numpy as np
from reachy_mini import ReachyMini

def transcribe(audio_2ch): ...   # your STT service -> str
def respond(text): ...           # your LLM service -> str
def synthesize(text): ...        # your TTS service -> float32 (samples, 1) @16kHz

with ReachyMini() as mini:
    media = mini.media
    media.start_recording(); media.start_playing()
    try:
        while True:
            frames = []
            for _ in range(300):                       # ~3s of capture
                s = media.get_audio_sample()
                if s is not None:
                    frames.append(s)
                time.sleep(0.01)
            if not frames:
                continue
            text = transcribe(np.concatenate(frames))
            reply_audio = synthesize(respond(text))    # off the motion loop
            media.push_audio_sample(reply_audio)       # fire-and-forget
    finally:
        media.stop_recording(); media.stop_playing()
```

### Set volume from Python (REST — no SDK method)

```python
import requests   # daemon base: http://{daemon-ip}:8000/api
BASE = "http://localhost:8000/api"
requests.post(f"{BASE}/volume/set", json={"volume": 60})          # 0-100
print(requests.get(f"{BASE}/volume/current").json())
requests.post(f"{BASE}/volume/microphone/set", json={"volume": 80})
```

(Confirm the exact request body against `http://{daemon-ip}:8000/docs` —
`daemon/app/routers/volume.py`.)

## Reference material

- `reachy_mini/media/media_manager.py`, `docs/source/SDK/python-sdk.md`.
- `daemon/app/routers/volume.py`, `examples/sound_*.py`,
  `examples/take_picture.py`.
- [`reference/volume-and-audio.md`](reference/volume-and-audio.md).
