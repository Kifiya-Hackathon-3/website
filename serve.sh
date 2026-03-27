#!/usr/bin/env bash
# Local preview for IDE browser (http:// only — file:// is blocked there).
set -e
cd "$(dirname "$0")"
exec python3 -m http.server "${PORT:-8766}"
