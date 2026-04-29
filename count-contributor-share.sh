#!/usr/bin/env bash
set -euo pipefail

ROOT="."
INCLUDE_MERGES=0

usage() {
  cat <<'EOF'
Usage: ./count-contributor-share.sh [repo_path] [--include-merges]

Calculates per-contributor edited lines from git history using:
edited = added + deleted

Percent share is based on total edited lines across all contributors.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --include-merges)
      INCLUDE_MERGES=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ROOT="$arg"
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required."
  exit 1
fi

if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: '$ROOT' is not a git repository."
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

log_args=(log --numstat --format='__AUTHOR__%aN')
if [ "$INCLUDE_MERGES" -eq 0 ]; then
  log_args+=(--no-merges)
fi

git -C "$ROOT" "${log_args[@]}" > "$tmp_file"

summary="$(
  awk '
    BEGIN {
      author = ""
      total = 0
    }
    substr($0, 1, 10) == "__AUTHOR__" {
      author = substr($0, 11)
      if (author == "") {
        author = "(unknown)"
      }
      next
    }
    NF == 3 {
      added = $1
      deleted = $2
      if (added == "-" || deleted == "-") {
        next
      }
      added += 0
      deleted += 0
      edited = added + deleted

      adds[author] += added
      dels[author] += deleted
      edits[author] += edited
      total += edited
    }
    END {
      if (total == 0) {
        exit 0
      }
      for (name in edits) {
        pct = (edits[name] / total) * 100
        printf "%d\t%d\t%d\t%.2f\t%s\n", edits[name], adds[name], dels[name], pct, name
      }
    }
  ' "$tmp_file" | sort -nr -k1,1
)"

if [ -z "$summary" ]; then
  echo "No editable git numstat data found."
  exit 0
fi

printf "%-30s %12s %12s %12s %10s\n" "Contributor" "Added" "Deleted" "Edited" "Percent"
printf "%-30s %12s %12s %12s %10s\n" "-----------" "-----" "-------" "------" "-------"

while IFS=$'\t' read -r edited added deleted pct contributor; do
  printf "%-30s %12d %12d %12d %9.2f%%\n" "$contributor" "$added" "$deleted" "$edited" "$pct"
done <<< "$summary"

total_edited="$(printf "%s\n" "$summary" | awk -F'\t' '{sum += $1} END {print sum + 0}')"
echo
echo "Total edited lines: $total_edited"
if [ "$INCLUDE_MERGES" -eq 0 ]; then
  echo "Mode: merge commits excluded (default)."
else
  echo "Mode: merge commits included."
fi
