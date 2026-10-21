#!/usr/bin/env bash
# Builds the code knowledge graph in graphify-out/ (git-ignored) with graphify.
# Code-only: local tree-sitter parsing, no LLM calls and no code leaves the machine.
# Runs at session start (.claude/settings.json) and via `npm run graph` after code changes.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install --quiet "graphifyy[sql]" >/dev/null 2>&1 || true
  else
    pip install --quiet "graphifyy[sql]" >/dev/null 2>&1 || true
  fi
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v graphify >/dev/null 2>&1; then
  echo "graphify: not installed (no network?); skipping the code graph. Install with: uv tool install \"graphifyy[sql]\""
  exit 0
fi

export GRAPHIFY_BACKEND=none
graphify extract . --code-only >/dev/null 2>&1
node scripts/graph-labels.mjs >/dev/null
graphify cluster-only . --no-label --no-viz >/dev/null 2>&1
echo "graphify: code graph ready in graphify-out/ ($(grep -m1 -o '[0-9]* nodes · [0-9]* edges' graphify-out/GRAPH_REPORT.md || echo 'built'))"
