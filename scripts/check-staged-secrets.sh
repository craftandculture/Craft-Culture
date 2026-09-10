#!/bin/sh
# Refuse a commit that carries a credential.
#
# A production Neon password reached GitHub through CLAUDE.md and AGENTS.md —
# tracked files, so the secret went in with an ordinary commit and then into
# history, which cannot be cleaned without a force-push everyone has to
# cooperate with. Nothing mechanical was in the way; only care, and care failed.
#
# This looks at the staged diff, not the working tree, so it catches the moment
# a secret would become permanent.

added=$(git diff --cached --no-color -U0 | grep '^+' | grep -v '^+++')

[ -z "$added" ] && exit 0

# A connection string with a password in it, in any of the usual forms.
live_dsn=$(printf '%s' "$added" | grep -nE '(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp)://[^:/@[:space:]]+:[^@[:space:]]+@' | grep -viE '<[a-z_]+>|\$\{|example|placeholder|user:password|redacted|\*\*\*')

# Provider tokens that are unmistakable on sight.
tokens=$(printf '%s' "$added" | grep -nE '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})')

if [ -n "$live_dsn" ] || [ -n "$tokens" ]; then
  echo ""
  echo "BLOCKED: the staged changes contain what looks like a live credential."
  echo ""
  [ -n "$live_dsn" ] && echo "$live_dsn" | sed -E 's#(://[^:]+:)[^@]+(@)#\1********\2#g' | head -5
  [ -n "$tokens" ] && echo "$tokens" | cut -c1-60 | head -5
  echo ""
  echo "Secrets belong in apps/web/.env.local, which is gitignored and untracked."
  echo "If this is genuinely a placeholder, write it as <user>:<password>@<host>."
  echo "To override deliberately: git commit --no-verify"
  echo ""
  exit 1
fi

exit 0
