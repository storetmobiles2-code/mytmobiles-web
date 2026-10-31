#!/usr/bin/env bash
# Builds the code knowledge graph in graphify-out/ (git-ignored) with graphify.
# Code-only: local tree-sitter parsing, no LLM calls and no code leaves the machine.
# Runs at session start (.claude/settings.json) and via `npm run graph` after code changes.
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.local/bin:$PATH"
# graphifyy needs Python 3.10+; macOS ships 3.9, so install through uv with its own Python.
if ! command -v graphify >/dev/null 2>&1; then
  if ! command -v uv >/dev/null 2>&1; then
    echo "graphify: not installed, and installing it needs uv (Python 3.10+). Run: brew install uv  (or see https://docs.astral.sh/uv/)"
    exit 0
  fi
  uv tool install --quiet --python 3.12 "graphifyy[sql,mcp]" >/dev/null 2>&1 || true
fi
if ! command -v graphify >/dev/null 2>&1; then
  echo "graphify: install failed (no network?); skipping the code graph. Try: uv tool install --python 3.12 \"graphifyy[sql,mcp]\""
  exit 0
fi

export GRAPHIFY_BACKEND=none
graphify extract . --code-only >/dev/null 2>&1
node scripts/graph-labels.mjs >/dev/null
graphify cluster-only . --no-label --no-viz >/dev/null 2>&1
echo "graphify: code graph ready in graphify-out/ ($(grep -m1 -o '[0-9]* nodes · [0-9]* edges' graphify-out/GRAPH_REPORT.md || echo 'built'))"
