# plan.md template

Copy this into `plan.md` in the app dir, fill it in, and **wait for user
approval before writing any code** (`AGENTS.md:65-73`).

```markdown
# Plan: <app name>

## Understanding
<what the app should do, in my own words>

## Hardware & flavor
- Unit: Lite | wireless
- Flavor: Python (discoverable / on-robot compute) | JS (shareable / zero-install)

## Technical approach
- Motion: goto_target gestures | set_target loop @ N Hz | recorded moves
- Audio/Vision: <if any — mic/speaker, camera, DoA, tracking>
- App structure: ReachyMiniApp.run outline (loop + stop_event handling)

## Clarifying questions
1. <question>  — Answer:
2. <question>  — Answer:

## Safety checklist
- [ ] Stays within joint limits (pitch/roll ±40°, head yaw ±180°, body ±160°, |head_yaw − body_yaw| ≤ 65°)
- [ ] No blocking calls (goto_target / play_move / network I/O) inside a real-time set_target loop
- [ ] Honors stop_event for clean shutdown
- [ ] enable_motors() called before set_target
- [ ] Uses `with ReachyMini()` (or the app-provided reachy_mini) — media released on exit
```

## Why plan.md first

- It is a hard precondition in the SDK's own agent conventions
  (`AGENTS.md:65-73`, `:159`).
- It surfaces the flavor decision (Python vs JS) and hardware before code.
- The safety checklist forces the joint-limit and control-loop rules to the
  front, where they are cheap to satisfy.
