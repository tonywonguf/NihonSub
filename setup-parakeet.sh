#!/usr/bin/env bash
set -euo pipefail

uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python torch --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv/bin/python -r requirements-parakeet.txt
