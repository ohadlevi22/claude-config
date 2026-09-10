# pyproject.toml shape for a Reachy Mini app

PEP 621 layout with `reachy_mini` pinned and `ruff` / `pytest` as dev deps.
Use an isolated `.venv`.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "my_reachy_app"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "reachy_mini",          # pin to the SDK version you build against
    "numpy",
]

[project.optional-dependencies]
dev = [
    "ruff",
    "pytest",
]

[project.scripts]
my-reachy-app = "my_reachy_app.app:main"

[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## Workflow

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
ruff check . && ruff format --check .
pytest
```

## Notes

- Pin `reachy_mini` to the exact SDK version the app was written against —
  signature drift is the classic breakage.
- Keep `ruff` clean in CI; type-hint every public function, especially the
  control-loop surface.
- Tests run against `MockReachyMini` (see `mock_reachy.py`) — no hardware in CI.
- The real app scaffolding comes from `reachy-mini-app-assistant create`
  (see the `reachy-app-template` skill); this file describes the tooling you add
  on top.
