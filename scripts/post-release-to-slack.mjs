/**
 * Post the newest release's notes to the staff changelog channel in Slack
 *
 * Run by CI straight after semantic-release. Reads the top section of
 * CHANGELOG.md — the release just cut — and posts its Features, Improvements
 * (refine/style: visible polish) and Bug Fixes as plain sentences. Refactors,
 * docs and tests are left out: the channel is for staff, who want to know what changed for them, not how the code moved.
 *
 * Does nothing when no release was cut (the top version is the one passed in
 * as the version before), or when SLACK_CHANGELOG_WEBHOOK_URL is not set, so a
 * missing secret never fails a deploy.
 *
 * @example
 *   node scripts/post-release-to-slack.mjs 2.0.254
 */
import { readFileSync } from 'node:fs';

const previousVersion = process.argv[2] ?? '';
const webhook = process.env.SLACK_CHANGELOG_WEBHOOK_URL;
const appUrl = 'https://wine.craftculture.xyz';

/** Sections staff see, and what they are called in the channel */
const SECTIONS = {
  Features: ':sparkles: *New*',
  Improvements: ':art: *Improved*',
  'Bug Fixes': ':wrench: *Fixed*',
  'Performance Improvements': ':zap: *Faster*',
};

const changelog = readFileSync('CHANGELOG.md', 'utf8');

/* Sections begin "## [2.0.254](…) (2026-09-29)" or "# [2.1.0](…)" */
const releases = changelog.split(/^#{1,2} \[/m).slice(1);
const latest = releases[0];

if (!latest) {
  console.log('No release in CHANGELOG.md');
  process.exit(0);
}

const version = latest.slice(0, latest.indexOf(']'));
const date = /\((\d{4}-\d{2}-\d{2})\)/.exec(latest.split('\n')[0])?.[1] ?? '';

if (version === previousVersion) {
  console.log(`No new release (still ${version}), nothing to post`);
  process.exit(0);
}

if (!webhook) {
  console.log('SLACK_CHANGELOG_WEBHOOK_URL is not set; not posting');
  process.exit(0);
}

const lines = [];

for (const block of latest.split(/^### /m).slice(1)) {
  const [heading, ...body] = block.split('\n');
  const label = SECTIONS[heading.trim()];
  if (!label) continue;

  const items = body
    .filter((line) => line.startsWith('* '))
    .map((line) =>
      line
        .slice(2)
        /* Drop the "([925a892](https://github.com/…))" commit links */
        .replace(/\s*\(\[[0-9a-f]{7,}\]\([^)]*\)\)/g, '')
        /* "#tasks" in a subject comes back as an issue link: keep the text */
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        /* "**scope:** text" → "text"; the scope is a code module name */
        .replace(/^\*\*[^*]+:\*\*\s*/, '')
        .trim(),
    )
    .filter(Boolean)
    .map((text) => `• ${text.charAt(0).toUpperCase()}${text.slice(1)}`);

  if (items.length > 0) lines.push(label, ...items, '');
}

if (lines.length === 0) {
  console.log(`Release ${version} has no staff-facing changes; not posting`);
  process.exit(0);
}

const text = [
  `*Craft & Culture Index — v${version}*${date ? `  ·  ${date}` : ''}`,
  '',
  ...lines,
  `<${appUrl}|Open the Index>`,
].join('\n');

const response = await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, unfurl_links: false }),
});

if (!response.ok) {
  /* A changelog post is not worth failing a deploy over */
  console.log(`Slack refused the post (${response.status}): ${await response.text()}`);
  process.exit(0);
}

console.log(`Posted v${version} to Slack`);
