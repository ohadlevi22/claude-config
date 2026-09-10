# Audio format, DoA, and volume reference

## Audio sample format (prose docs, not typed API)

These live in `docs/source/SDK/python-sdk.md`, not in signatures — easy to get
wrong, so pin them:

| Direction | Method | Shape | dtype | Rate |
|-----------|--------|-------|-------|------|
| Mic in | `media.get_audio_sample()` | `(samples, 2)` | float32 | 16 kHz |
| Speaker out | `media.push_audio_sample(data)` | `(samples, 1\|2)` | float32 | 16 kHz |

`push_audio_sample` is **non-blocking** — pace chunks yourself. Query actual
values at runtime: `get_input_audio_samplerate()`,
`get_output_audio_samplerate()`, `get_input_channels()`,
`get_output_channels()`.

## Direction of arrival (DoA)

`media.get_DoA()` → `(float, bool)` or `None`. Angle in **radians**:

| Value | Direction |
|-------|-----------|
| `0` | left |
| `π/2` | front / back |
| `π` | right |

## Volume / mute — REST only from Python

No `ReachyMini.set_volume()` / `set_mic_muted()` exists in Python. Options:

### REST (`daemon/app/routers/volume.py`, base `http://{daemon-ip}:8000/api`)

| Endpoint | Purpose |
|----------|---------|
| `GET  /volume/current` | read speaker volume |
| `POST /volume/set` | set speaker volume (0–100) |
| `POST /volume/test-sound` | play a test tone |
| `GET  /volume/microphone/current` | read mic volume |
| `POST /volume/microphone/set` | set mic volume (0–100) |

Confirm exact request bodies at `http://{daemon-ip}:8000/docs`.

### Protocol commands (advanced)

`io/protocol.py`: `SetVolumeCmd`, `GetVolumeCmd`, `SetMicrophoneVolumeCmd`,
`GetMicrophoneVolumeCmd` (0–100). Sent via the client's WebSocket transport
(`WS /ws/sdk`).

### JS (for contrast — not available in Python)

JS SDK exposes first-class `setVolume`, `setAudioMuted`, `setMicMuted`
(`AGENTS.md:171`).

## Media backends (`media_backend=` constructor arg)

`MediaBackend` (`media/media_manager.py:38-67`):

| Value | Behavior |
|-------|----------|
| `"default"` | auto: local if same machine, else webrtc |
| `"local"` | local capture/playback |
| `"webrtc"` | webrtc transport |
| `"no_media"` | release daemon camera/mic for direct OpenCV/sounddevice |

Runtime toggles: `release_media()`, `acquire_media()`, `media_released`
property. Never hold daemon + direct consumers on the same device at once.

## SDK gaps (reminder)

1. No Python volume/mute convenience — REST/protocol only.
2. No verified `/v1/realtime` STT/LLM/TTS Python client — DIY the loop
   (`get_audio_sample` → your STT/LLM/TTS → `push_audio_sample`).
