#!/usr/bin/env node
/**
 * Ratchet gate for TypeScript errors.
 *
 * `next.config.ts` sets `typescript.ignoreBuildErrors: true`, so nothing has
 * ever stopped a type error reaching production. That is how two admin reports
 * shipped returning HTTP 500 on every request — the errors were sitting in
 * `tsc` output the whole time, unread.
 *
 * Clearing the whole backlog in one go is not realistic, so this compares the
 * current errors against a committed baseline and fails only on NEW ones. The
 * backlog can then be burned down at whatever pace suits, and it can only ever
 * shrink.
 *
 * Errors are keyed on `file|TScode`, not line numbers, so unrelated edits that
 * shift lines around do not read as new failures. Counts per key are compared,
 * so adding a second instance of an existing error in the same file is still
 * caught.
 *
 * Usage:
 *   node scripts/check-types.mjs            # verify against the baseline
 *   node scripts/check-types.mjs --update   # re-record the baseline
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, 'typecheck-baseline.json');
const appRoot = join(here, '..');

/**
 * Resolve tsc through Node's resolver rather than a hardcoded path — pnpm's
 * node_modules layout differs between a local install and CI.
 */
const resolveTsc = () => {
  try {
    return createRequire(import.meta.url).resolve('typescript/bin/tsc');
  } catch {
    const fallback = join(appRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    if (existsSync(fallback)) return fallback;
    console.error('❌ Could not resolve the typescript compiler.');
    process.exit(1);
  }
};

/** `src/foo.ts(12,3): error TS2345: …` -> `src/foo.ts|TS2345` */
const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;

const collect = () => {
  const result = spawnSync(
    'node',
    [resolveTsc(), '--noEmit', '-p', 'tsconfig.json'],
    { cwd: appRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (!output.trim() && result.status !== 0) {
    console.error('tsc produced no output but exited non-zero:\n', result.error ?? '');
    process.exit(1);
  }

  const counts = {};
  const samples = {};

  for (const line of output.split('\n')) {
    const match = ERROR_LINE.exec(line.trim());
    if (!match) continue;
    // generated Next.js type files are a build artefact, not source to fix
    if (match[1].startsWith('.next/')) continue;
    const key = `${match[1]}|${match[4]}`;
    counts[key] = (counts[key] ?? 0) + 1;
    samples[key] ??= line.trim();
  }

  return { counts, samples };
};

const { counts, samples } = collect();
const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`✅ baseline recorded: ${total} errors across ${Object.keys(sorted).length} file/code pairs`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error('❌ No baseline found. Run: pnpm typecheck:update');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const baselineTotal = Object.values(baseline).reduce((sum, n) => sum + n, 0);

const introduced = [];
const worsened = [];
const fixed = [];

for (const [key, count] of Object.entries(counts)) {
  const before = baseline[key] ?? 0;
  if (before === 0) introduced.push({ key, count });
  else if (count > before) worsened.push({ key, before, count });
}

for (const [key, before] of Object.entries(baseline)) {
  const now = counts[key] ?? 0;
  if (now < before) fixed.push({ key, before, now });
}

if (introduced.length || worsened.length) {
  console.error('❌ New TypeScript errors introduced.\n');

  for (const { key, count } of introduced) {
    console.error(`  NEW  ${key}${count > 1 ? ` (×${count})` : ''}`);
    console.error(`       ${samples[key]}`);
  }

  for (const { key, before, count } of worsened) {
    console.error(`  MORE ${key}: ${before} -> ${count}`);
    console.error(`       ${samples[key]}`);
  }

  console.error(
    `\nTotal ${baselineTotal} -> ${total}. Fix these, or if an error moved to a` +
      ' different file, re-record with: pnpm typecheck:update',
  );
  process.exit(1);
}

console.log(`✅ No new TypeScript errors (${total} known, baseline ${baselineTotal}).`);

if (fixed.length) {
  const cleared = fixed.reduce((sum, f) => sum + (f.before - f.now), 0);
  console.log(`\n🎉 ${cleared} error(s) fixed since the baseline:`);
  for (const { key, before, now } of fixed) console.log(`  ${key}: ${before} -> ${now}`);
  console.log('\nLock the win in with: pnpm typecheck:update');
}
