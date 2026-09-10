"""MockReachyMini — hardware-free test double for Reachy Mini apps.

Mirrors the *public* ReachyMini signatures used by apps so tests exercise the
same call surface, and enforces the documented joint limits so unsafe-motion
tests fail fast. This is a test double authored for CI — it is NOT part of the
Reachy SDK. Copy it into `src/<your_app>/mock_reachy.py`.

Joint limits (auto-clamped by the real SDK/IK):
  pitch [-40, 40] deg, roll [-40, 40] deg, head yaw [-180, 180] deg,
  body yaw [-160, 160] deg, |head_yaw - body_yaw| <= 65 deg.
Sources: docs/source/SDK/core-concept.md:37-42, AGENTS.md:223-229,
kinematics/analytical_kinematics.py:85-89.
"""

from __future__ import annotations

import numpy as np

PITCH_LIMIT = np.deg2rad(40.0)
ROLL_LIMIT = np.deg2rad(40.0)
HEAD_YAW_LIMIT = np.deg2rad(180.0)
BODY_YAW_LIMIT = np.deg2rad(160.0)
YAW_DELTA_LIMIT = np.deg2rad(65.0)


def _rpy_from_pose(pose: np.ndarray) -> tuple[float, float, float]:
    """Extract (roll, pitch, yaw) in radians from a 4x4 homogeneous pose.

    Matches the ZYX (yaw, pitch, roll) convention create_head_pose builds with.
    """
    r = np.asarray(pose)[:3, :3]
    pitch = np.arcsin(-np.clip(r[2, 0], -1.0, 1.0))
    roll = np.arctan2(r[2, 1], r[2, 2])
    yaw = np.arctan2(r[1, 0], r[0, 0])
    return float(roll), float(pitch), float(yaw)


def _clamp(value: float, limit: float) -> float:
    return float(np.clip(value, -limit, limit))


class OutOfRangeError(ValueError):
    """Raised in strict mode when a target exceeds a joint limit."""


class _MockMedia:
    """Minimal media stub mirroring the MediaManager surface apps use."""

    def get_frame(self):
        return np.zeros((480, 640, 3), dtype=np.uint8)

    def get_frame_jpeg(self):
        return b""

    def get_audio_sample(self):
        return np.zeros((160, 2), dtype=np.float32)  # 10 ms @16kHz, 2ch

    def push_audio_sample(self, data):
        return None

    def play_sound(self, sound_file):
        return None

    def start_recording(self):
        return None

    def stop_recording(self):
        return None

    def start_playing(self):
        return None

    def stop_playing(self):
        return None


class MockReachyMini:
    """Drop-in double for ReachyMini in unit tests.

    Args:
        strict: if True, out-of-range targets raise OutOfRangeError; if False,
            they are clamped to the nearest valid value (mirrors the real SDK).
    """

    def __init__(self, strict: bool = False, **_kwargs):
        self.strict = strict
        self.calls: list[tuple[str, dict]] = []          # (method, kwargs) in order
        self.targets: list[dict] = []                    # requested vs clamped
        self.motors_enabled = False
        self.media = _MockMedia()
        self._head_pose = np.eye(4)
        self._body_yaw = 0.0
        self._antennas = np.zeros(2)

    # --- context manager -------------------------------------------------
    def __enter__(self) -> "MockReachyMini":
        self.calls.append(("__enter__", {}))
        return self

    def __exit__(self, *exc) -> bool:
        self.calls.append(("__exit__", {}))
        return False

    # --- helpers ---------------------------------------------------------
    def _record_target(self, head, antennas, body_yaw, blocking: bool) -> dict:
        roll = pitch = yaw = 0.0
        if head is not None:
            roll, pitch, yaw = _rpy_from_pose(head)
        req = {"roll": roll, "pitch": pitch, "head_yaw": yaw,
               "body_yaw": 0.0 if body_yaw is None else float(body_yaw),
               "blocking": blocking}

        if self.strict:
            if abs(pitch) > PITCH_LIMIT + 1e-9:
                raise OutOfRangeError(f"pitch {np.degrees(pitch):.1f} > 40")
            if abs(roll) > ROLL_LIMIT + 1e-9:
                raise OutOfRangeError(f"roll {np.degrees(roll):.1f} > 40")
            if abs(yaw) > HEAD_YAW_LIMIT + 1e-9:
                raise OutOfRangeError(f"head_yaw {np.degrees(yaw):.1f} > 180")
            if abs(req["body_yaw"]) > BODY_YAW_LIMIT + 1e-9:
                raise OutOfRangeError("body_yaw > 160")
            if abs(yaw - req["body_yaw"]) > YAW_DELTA_LIMIT + 1e-9:
                raise OutOfRangeError("|head_yaw - body_yaw| > 65")

        clamped = {"roll": _clamp(roll, ROLL_LIMIT),
                   "pitch": _clamp(pitch, PITCH_LIMIT),
                   "head_yaw": _clamp(yaw, HEAD_YAW_LIMIT),
                   "body_yaw": _clamp(req["body_yaw"], BODY_YAW_LIMIT)}
        delta = clamped["head_yaw"] - clamped["body_yaw"]
        if abs(delta) > YAW_DELTA_LIMIT:
            clamped["head_yaw"] = clamped["body_yaw"] + np.sign(delta) * YAW_DELTA_LIMIT

        entry = {"requested": req, **clamped}
        self.targets.append(entry)
        return entry

    @property
    def last_target(self) -> dict:
        return self.targets[-1]

    # --- motion surface --------------------------------------------------
    def set_target(self, head=None, antennas=None, body_yaw=None) -> None:
        if head is None and antennas is None and body_yaw is None:
            raise ValueError("set_target requires at least one argument")
        self.calls.append(("set_target", {"body_yaw": body_yaw}))
        self._record_target(head, antennas, body_yaw, blocking=False)

    def goto_target(self, head=None, antennas=None, duration=0.5,
                    method="minjerk", body_yaw=0.0) -> None:
        if duration <= 0:
            raise ValueError("duration must be > 0; use set_target for immediate")
        self.calls.append(("goto_target", {"duration": duration, "method": method}))
        self._record_target(head, antennas, body_yaw, blocking=True)

    def set_target_head_pose(self, pose) -> None:
        self.calls.append(("set_target_head_pose", {}))
        self._record_target(pose, None, None, blocking=False)

    def set_target_antenna_joint_positions(self, antennas) -> None:
        self.calls.append(("set_target_antenna_joint_positions", {}))
        self._antennas = np.asarray(antennas, dtype=float)

    def set_target_body_yaw(self, body_yaw) -> None:
        self.calls.append(("set_target_body_yaw", {"body_yaw": body_yaw}))
        self._record_target(None, None, body_yaw, blocking=False)

    # --- state reads -----------------------------------------------------
    def get_current_head_pose(self):
        return self._head_pose

    def get_current_joint_positions(self):
        return np.zeros(7), self._antennas

    def get_present_antenna_joint_positions(self):
        return self._antennas

    # --- motors / behaviors ---------------------------------------------
    def enable_motors(self, ids=None) -> None:
        self.motors_enabled = True
        self.calls.append(("enable_motors", {}))

    def disable_motors(self, ids=None) -> None:
        self.motors_enabled = False
        self.calls.append(("disable_motors", {}))

    def wake_up(self) -> None:
        self.calls.append(("wake_up", {}))

    def goto_sleep(self) -> None:
        self.calls.append(("goto_sleep", {}))

    def play_move(self, move, play_frequency=100.0, initial_goto_duration=0.0,
                  sound=True) -> None:
        self.calls.append(("play_move", {"blocking": True}))

    def cancel_move(self) -> None:
        self.calls.append(("cancel_move", {}))
