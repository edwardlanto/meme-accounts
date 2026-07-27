#!/usr/bin/env bash
# Install pyautoflip into a project venv (Python 3.10–3.13; 3.14+ unsupported).
# Usage: ./scripts/install-pyautoflip.sh
# Or:    npm run pyautoflip:install

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VENV="${PYAUTOFLIP_VENV:-$ROOT/.venv-pyautoflip}"

pick_python() {
  if [[ -n "${PYTHON:-}" ]]; then
    echo "$PYTHON"
    return
  fi
  for c in python3.12 python3.13 python3.11 python3.10; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "$c"
      return
    fi
  done
  echo ""
}

PYTHON_BIN="$(pick_python)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "Error: need Python 3.10–3.13 (not 3.14+)."
  echo "Install one, e.g.: brew install python@3.12"
  exit 1
fi

VER="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
MAJOR="${VER%%.*}"
MINOR="${VER#*.}"
if [[ "$MAJOR" -ne 3 ]] || [[ "$MINOR" -lt 10 ]] || [[ "$MINOR" -ge 14 ]]; then
  echo "Error: pyautoflip needs Python 3.10–3.13 (found $VER via $PYTHON_BIN)"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Warning: ffmpeg not found on PATH. Install with: brew install ffmpeg"
fi

echo "Using $PYTHON_BIN ($VER)"
echo "Venv: $VENV"

"$PYTHON_BIN" -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install pyautoflip

echo ""
echo "✓ pyautoflip ready: $VENV/bin/pyautoflip"
"$VENV/bin/pyautoflip" --version || true
echo ""
echo "Optional: set in .env"
echo "PYAUTOFLIP_PATH=$VENV/bin/pyautoflip"
