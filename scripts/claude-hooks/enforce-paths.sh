#!/bin/bash
# enforce-paths.sh — directory ownership boundary for Bastion agents.
#
# Usage (from a subagent PreToolUse hook):
#   command: "./scripts/claude-hooks/enforce-paths.sh <allowed-prefix> [<allowed-prefix> ...]"
#
# Reads the Claude Code hook JSON from stdin, extracts the path a Write/Edit
# tool is targeting (or paths referenced by a Bash command), and blocks the
# operation (exit 2) if it falls outside the allowed prefixes.
#
# Universal rules, applied regardless of arguments:
#   - Writes anywhere under old/ are ALWAYS blocked (C# / LESS / TS ground truth
#     is immutable).
#   - Writes to docs/decisions.md are ALWAYS allowed (shared cross-cutting log).
#
# Every writer agent passes its own directory plus its agent-memory dir, e.g.
#   astro-builder:        web .claude/agent-memory/astro-builder
#   migration-engineer:   scripts .claude/agent-memory/migration-engineer
#   content-architect:    cms docs .claude/agent-memory/content-architect
#   parity-qa:            qa .claude/agent-memory/parity-qa
#   a11y-auditor:         .claude/agent-memory/a11y-auditor
#
# Requires: jq

set -uo pipefail

# Fail closed: if jq is unavailable we cannot parse the tool input safely, so
# block rather than risk letting an out-of-bounds write through.
if ! command -v jq >/dev/null 2>&1; then
  echo "Blocked: path-enforcement hook requires 'jq', which is not installed. Install jq and retry." >&2
  exit 2
fi

ALLOWED_PREFIXES=("$@")
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Collect candidate target paths depending on the tool.
declare -a TARGETS=()

case "$TOOL_NAME" in
  Write|Edit|MultiEdit|NotebookEdit)
    P=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
    [ -n "$P" ] && TARGETS+=("$P")
    ;;
  Bash)
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
    # Heuristic: pull out tokens that look like writes into tracked dirs.
    # We block obvious mutation of protected areas; read-only bash is allowed.
    if echo "$CMD" | grep -qiE '(\bold/|>[[:space:]]*old/|rm[[:space:]].*\bold/|mv[[:space:]].*\bold/)'; then
      echo "Blocked: Bash command appears to modify old/ (immutable legacy source)." >&2
      exit 2
    fi
    # Nothing else to inspect for Bash — allow it (migration-engineer runs on
    # default permission mode, so destructive bash still prompts the human).
    exit 0
    ;;
  *)
    exit 0
    ;;
esac

normalize() {
  # Strip a leading ./ and collapse to a repo-relative-ish form for matching.
  echo "$1" | sed -e 's#^\./##' -e 's#^/##'
}

for RAW in "${TARGETS[@]}"; do
  PATH_REL=$(normalize "$RAW")

  # Universal block: anything under old/
  if echo "$PATH_REL" | grep -qE '(^|/)old/'; then
    echo "Blocked: writes to old/ are not permitted. old/ is the immutable legacy source of truth (C#, LESS, TS). Report the issue instead of editing it." >&2
    exit 2
  fi

  # Universal allow: the shared decisions log
  if echo "$PATH_REL" | grep -qE '(^|/)docs/decisions\.md$'; then
    continue
  fi

  # Allowed-prefix check
  ALLOWED=0
  for PREFIX in "${ALLOWED_PREFIXES[@]}"; do
    PREFIX_NORM=$(normalize "$PREFIX")
    if echo "$PATH_REL" | grep -qE "(^|/)${PREFIX_NORM}(/|$)"; then
      ALLOWED=1
      break
    fi
  done

  if [ "$ALLOWED" -eq 0 ]; then
    echo "Blocked: '$RAW' is outside this agent's allowed directories (${ALLOWED_PREFIXES[*]}). If this work genuinely belongs to another agent's area, stop and report it — do not work around the boundary. Cross-cutting notes may go in docs/decisions.md." >&2
    exit 2
  fi
done

exit 0
