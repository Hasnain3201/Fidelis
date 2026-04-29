#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

if command -v cloc >/dev/null 2>&1; then
  # Preferred mode: language-aware code/comment/blank breakdown.
  cloc "$ROOT" \
    --vcs=git \
    --exclude-dir=.git,node_modules,dist,build,coverage,.next,out,vendor,target,.venv,venv,__pycache__
  exit 0
fi

# Fallback mode: raw total line count for common source file extensions.
total=0
files=0
while IFS= read -r -d '' f; do
  lines=$(wc -l < "$f")
  total=$((total + lines))
  files=$((files + 1))
done < <(
  find "$ROOT" \
    \( -name .git -o -name node_modules -o -name dist -o -name build -o -name coverage -o -name .next -o -name out -o -name vendor -o -name target -o -name .venv -o -name venv -o -name __pycache__ \) -type d -prune -o \
    -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.py' -o -name '*.go' -o -name '*.java' -o -name '*.kt' -o -name '*.rb' -o -name '*.rs' -o -name '*.c' -o -name '*.cc' -o -name '*.cpp' -o -name '*.h' -o -name '*.hpp' -o -name '*.cs' -o -name '*.php' -o -name '*.swift' -o -name '*.scala' -o -name '*.sh' -o -name '*.zsh' -o -name '*.bash' -o -name '*.html' -o -name '*.css' -o -name '*.scss' -o -name '*.sass' -o -name '*.vue' -o -name '*.svelte' -o -name '*.sql' -o -name '*.yaml' -o -name '*.yml' \) \
    -print0
)

echo "Files counted: $files"
echo "Total lines:   $total"
echo "(Fallback mode includes blank lines/comments.)"
