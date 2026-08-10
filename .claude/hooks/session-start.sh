#!/bin/bash
#
# Install the Claude Code plugins this repo declares in .claude/settings.json.
#
# Remote containers (Claude Code on the web) start with an empty plugin cache.
# `enabledPlugins` and `extraKnownMarketplaces` in project settings say what we
# want, but nothing fetches it there, so every plugin-provided skill is silently
# missing — no jira-housekeeping, no superpowers. This hook does the fetching.
#
# Local machines install plugins interactively and keep them in ~/.claude, so
# this no-ops off the web rather than mutating a developer's own setup.
#
# Runs synchronously on purpose: plugins are enumerated as the session starts,
# so an async fetch would usually lose the race and land too late to be used.
#
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

# Anchored on this script's own location, not CLAUDE_PROJECT_DIR: in a
# multi-repo session that variable can point at the session root rather than
# this repo, and we would read the wrong settings file (or none).
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SETTINGS="$REPO_DIR/.claude/settings.json"

# Seconds of wall clock after which we stop retrying. A failed step is a
# degraded session; a hook that keeps retrying is no session at all, so the
# budget is a hard stop rather than a per-step allowance.
RETRY_BUDGET=${PLUGIN_BOOTSTRAP_RETRY_BUDGET:-20}

failures=()

log() { echo "plugin-bootstrap: $*" >&2; }

# Run a step, retrying with backoff while the budget lasts.
#
# The retry is not superstition: marketplaces on private repos (foxden-plugins
# lives in Foxquilt/foxden-workspace) clone only through the container's
# authenticated proxy, and that authorization is not always in place the
# instant SessionStart fires. Public marketplaces succeed, the private one
# does not, and the session comes up looking fine while missing exactly the
# plugins this repo defines.
attempt() {
  local label=$1
  shift
  local out delay=2 i
  for i in 1 2 3; do
    if out=$("$@" 2>&1); then
      [ "$i" -eq 1 ] || log "$label succeeded on attempt $i"
      return 0
    fi
    [ "$i" -lt 3 ] && [ "$SECONDS" -lt "$RETRY_BUDGET" ] || break
    sleep "$delay"
    delay=$((delay * 2))
  done
  log "$label failed: $(printf '%s' "$out" | tail -n 1)"
  failures+=("$label")
  return 1
}

[ -f "$SETTINGS" ] || exit 0
command -v jq >/dev/null 2>&1 || { log "jq not found, skipping"; exit 0; }
command -v claude >/dev/null 2>&1 || { log "claude CLI not found, skipping"; exit 0; }

# Marketplaces first — an install only resolves a plugin whose marketplace is
# already known.
while IFS= read -r repo; do
  [ -n "$repo" ] || continue
  attempt "marketplace $repo" claude plugin marketplace add "$repo"
done < <(jq -r '.extraKnownMarketplaces // {} | .[] | .source.repo // .source.url // empty' "$SETTINGS")

# claude-plugins-official is a built-in, so it is not in extraKnownMarketplaces —
# but the container registers it in the background while this hook is already
# running, so an install naming it loses that race and fails to resolve. Adding
# it here is idempotent when it has landed and unblocks us when it has not.
attempt "marketplace anthropics/claude-plugins-official" \
  claude plugin marketplace add anthropics/claude-plugins-official

while IFS= read -r plugin; do
  [ -n "$plugin" ] || continue
  attempt "plugin $plugin" claude plugin install "$plugin"
done < <(jq -r '.enabledPlugins // {} | to_entries[] | select(.value) | .key' "$SETTINGS")

# Say so when something did not land. Stderr alone is not enough — nobody reads
# it, and a missing plugin is indistinguishable from a plugin that ran and had
# nothing to say. The additionalContext exists so the agent does not assume a
# skill or hook is active when it is not.
if [ "${#failures[@]}" -gt 0 ]; then
  list=$(printf '%s, ' "${failures[@]}")
  jq -n --arg list "${list%, }" --arg repo "$(basename "$REPO_DIR")" '{
    systemMessage: ("plugin bootstrap (\($repo)): could not install \($list). Skills and hooks from those plugins are inactive this session — retry with `claude plugin install <name>`, or start a new session."),
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ("Plugin bootstrap failed in \($repo) for: \($list). Any skill or hook those plugins provide is NOT loaded in this session — do not assume it ran.")
    }
  }'
fi

# Never fail the session over a plugin that would not fetch — a missing skill is
# a degraded session, an aborted hook is no session at all.
exit 0
