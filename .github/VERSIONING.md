# Automated Versioning

This project uses [semantic-release](https://semantic-release.gitbook.io/) to automatically manage version numbers and releases.

## How It Works

Every push to `main` triggers automated versioning based on your commit messages:

### Commit Types → Version Bumps

- `feat:` New features → **Minor** version bump (1.32.0 → 1.33.0)
- `fix:` Bug fixes → **Patch** version bump (1.32.0 → 1.32.1)
- `refactor:` Code refactoring → **Patch** version bump
- `perf:` Performance improvements → **Patch** version bump
- `docs:` Documentation → **Patch** version bump
- `style:` Formatting → **Patch** version bump
- `test:` Tests → **Patch** version bump
- `build:` Build changes → **Patch** version bump
- `chore:` Maintenance → **No** version bump

### What Happens Automatically

1. **Analyzes commits** since the last release
2. **Determines version bump** based on commit types
3. **Creates git tag** (e.g., `v1.33.0`)
4. **Generates CHANGELOG.md** with release notes
5. **Creates GitHub release** with notes
6. **Commits** the changelog with `chore(release): X.X.X [skip ci]`

## Commit Message Format

Use conventional commits format:

```
type: description

Optional body explaining the change
```

### Examples

```bash
feat: add product filtering by region
fix: resolve price calculation error
refactor: simplify quote generation logic
docs: update README with deployment instructions
```

## Viewing Releases

- **Git tags**: `git tag --list`
- **GitHub releases**: Check the Releases tab on GitHub
- **App version**: Displayed in the footer (sourced from latest git tag)

## Manual Override

If you need to create a release manually:

```bash
pnpm run semantic-release
```
