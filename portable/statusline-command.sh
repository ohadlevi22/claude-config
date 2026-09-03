#!/usr/bin/env bash
# Claude Code statusLine script
# Mirrors Powerlevel10k p10k-classic style: dir | git | user@host | model | context

input=$(cat)

# Extract fields from JSON input
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Shorten the working directory (replace $HOME with ~)
if [ -n "$cwd" ]; then
  short_dir="${cwd/#$HOME/~}"
else
  short_dir="$(pwd | sed "s|$HOME|~|")"
fi

# Git branch (skip lock to avoid blocking)
git_branch=""
if git -C "$cwd" rev-parse --is-inside-work-tree --no-optional-locks >/dev/null 2>&1; then
  branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  if [ -n "$branch" ]; then
    git_branch=" \033[0;33m[$branch]\033[0m"
  fi
fi

# User and hostname
user=$(whoami)
host=$(hostname -s)

# Context usage indicator
ctx_str=""
if [ -n "$used_pct" ]; then
  used_int=${used_pct%.*}
  if [ "$used_int" -ge 80 ] 2>/dev/null; then
    ctx_str=" \033[0;31m[ctx:${used_int}%]\033[0m"
  elif [ "$used_int" -ge 50 ] 2>/dev/null; then
    ctx_str=" \033[0;33m[ctx:${used_int}%]\033[0m"
  else
    ctx_str=" \033[0;32m[ctx:${used_int}%]\033[0m"
  fi
fi

# Model short name
model_str=""
if [ -n "$model" ]; then
  model_str=" \033[0;36m${model}\033[0m"
fi

printf "\033[0;34m%s\033[0m%s  \033[0;32m%s@%s\033[0m%s%s\n" \
  "$short_dir" \
  "$git_branch" \
  "$user" "$host" \
  "$model_str" \
  "$ctx_str"
