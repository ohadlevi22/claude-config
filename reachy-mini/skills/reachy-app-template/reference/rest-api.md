# Daemon REST / WebSocket API surface

Base URL: `http://{daemon-ip}:8000/api` (`AGENTS.md:195`). All REST routers are
mounted under `/api`; `sdk_ws` and dev routers are at root
(`daemon/app/main.py:295-316`).

- **Lite**: `localhost:8000`. **Wireless**: `reachy-mini.local:8000` or robot IP.
- Interactive docs: `http://{daemon-ip}:8000/docs`.
- REST and the JS WebRTC data channel are sibling transports into the same
  `process_command()` backend.

Verified in `src/reachy_mini/daemon/app/routers/*.py`. Add `/api` prefix except
where noted.

## Motion — `routers/move.py` (prefix `/move`)
- `GET  /move/running`
- `POST /move/goto`
- `POST /move/play/wake_up`, `POST /move/play/goto_sleep`
- `GET  /move/recorded-move-datasets/list/{dataset_name}`
- `POST /move/play/recorded-move-dataset/{dataset_name}/{move_name}`
- `POST /move/stop`
- `POST /move/set_target`
- `WS   /move/ws/updates`, `WS /move/ws/set_target`, `WS /move/ws/raw/write`

## State — `routers/state.py` (prefix `/state`)
- `GET /state/present_head_pose`, `/state/present_body_yaw`,
  `/state/present_antenna_joint_positions`, `/state/doa`, `/state/full`
- `WS /state/ws/full`

## Motors — `routers/motors.py`
- `GET /motors/status`, `POST /motors/set_mode/{mode}`

## Media — `routers/media.py`
- `POST /media/release`, `/media/acquire`, `GET /media/status`
- `POST /media/play_sound`, `/media/stop_sound`, `/media/clear_incoming_audio`
- `POST /media/wobbling/enable|disable`, `/media/tracking/enable|disable`
- `GET /media/tracking/face`
- `POST /media/sounds/upload`, `GET /media/sounds`,
  `DELETE /media/sounds/{filename}`

## Camera — `routers/camera.py`
- `GET /camera/specs`

## Volume — `routers/volume.py`
- `GET /volume/current`, `POST /volume/set`, `POST /volume/test-sound`
- `GET /volume/microphone/current`, `POST /volume/microphone/set`

## Kinematics — `routers/kinematics.py`
- `GET /kinematics/info`, `/kinematics/urdf`, `/kinematics/stl/{filename}`

## Daemon — `routers/daemon.py`
- `POST /daemon/start`, `/daemon/stop`, `/daemon/restart`
- `GET /daemon/status`, `/daemon/hardware-id`, `/daemon/robot-app-lock-status`

## Apps — `routers/apps.py`
- list / install / remove / start / stop / status / update
- `WS /apps/ws/apps-manager/{job_id}`

## Audio config (XVF3800) — `routers/audio_config.py`
- `POST /audio/config/apply`, `GET /audio/config/parameter/{name}`

## SDK transport — `routers/sdk_ws.py`
- `WS /ws/sdk` (root) — the primary WebSocket the Python `WSClient` uses.
- `WS /logs/ws/daemon` (`routers/logs.py`).

Protocol envelope + command list: `src/reachy_mini/io/protocol.py` (module
docstring `:5-22`). Detailed usage guide: `skills/rest-api.md`.
