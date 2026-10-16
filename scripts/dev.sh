#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/python ]]; then
  echo "Create the Python environment first: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM
npm run dev
