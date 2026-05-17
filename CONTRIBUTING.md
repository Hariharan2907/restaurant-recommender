# Contributing

This guide covers how to work on this repo — branching, commits, PRs, and how to collaborate with Claude Code effectively. It applies to humans and AI agents alike.

## Quick start

```bash
git checkout main
git pull
git checkout -b feat/your-feature-name
# ...make changes, commit often...
git push -u origin feat/your-feature-name
# Open a PR on GitHub
```

## Branching strategy

### `main` is sacred
- Always deployable
- Protected: no direct pushes, no force-pushes
- All changes land via pull request
- Must pass CI before merge

### Feature branches
Every change happens on a branch off `main`. One branch = one logical chunk of work = one PR.

**Naming conventions:**
- `feat/short-description` — new features (e.g. `feat/visit-logging`)
- `fix/short-description` — bug fixes (e.g. `fix/redis-pool-leak`)
- `chore/short-description` — tooling, deps, config (e.g. `chore/upgrade-fastapi`)
- `refactor/short-description` — code restructuring with no behavior change
- `docs/short-description` — documentation only
- `phase-N-description` — multi-feature phase work (e.g. `phase-2-search-mvp`)

**Rules:**
- Keep branches short-lived (2–3 days max). Long-lived branches get painful to merge.
- One concern per branch. Don't mix a refactor with a feature.
- Rebase on `main` before opening a PR if your branch is behind.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `chore` — tooling, deps, config
- `refactor` — code change that doesn't add features or fix bugs
- `docs` — documentation
- `test` — adding or fixing tests
- `perf` — performance improvement

**Examples:**
```
feat(backend): add POST /recommendations endpoint
fix(mobile): handle empty search results in UI
chore: bump anthropic SDK to 0.40.0
refactor(backend): extract Claude client into lib/anthropic.py
docs: update PLAN.md with Phase 3 progress
```

**Rules:**
- Commit often — after each meaningful step, not just at the end of a session
- Keep messages descriptive but under 72 chars in the subject line
- If the change needs explanation, put it in the commit body
- Don't commit `wip`, `fix typo`, `again` — squash before pushing

## Pull request workflow

1. Push your branch to GitHub
2. Open a PR against `main`
3. Fill out the PR description (template below)
4. Wait for CI to pass
5. Get review (self-review counts for solo work, but actually read the diff)
6. **Squash and merge** — this keeps `main` history clean

### PR description template
```markdown
## What
Brief description of the change.

## Why
Context — what problem does this solve, what does it unblock?

## How
Key implementation decisions worth calling out.

## Testing
How you verified this works. Include commands run, edge cases checked.

## Checklist
- [ ] Tests added/updated
- [ ] PLAN.md updated if this completes a checkbox
- [ ] No secrets committed
- [ ] Migrations are reversible (if applicable)
```

### Branch protection on `main`
The repo enforces:
- PR required before merge
- Status checks must pass (tests, lint, typecheck)
- Branches must be up to date with `main` before merge
- No force pushes
- No deletions

## Working with Claude Code

This repo is set up for AI-assisted development. Follow these conventions to keep sessions productive and the code consistent.

### Before starting a session
1. Make sure you're on a feature branch, not `main`
2. Pull latest `main` and rebase your branch if needed
3. Have `PLAN.md` and `CLAUDE.md` in the repo root (Claude Code reads them automatically)

### During a session
- Use **plan mode** (Shift+Tab) before any significant change to preview what Claude will do
- For multi-step work, ask Claude Code to use **subagents** in parallel — but only when the tasks are genuinely independent
- Have Claude Code **commit after each meaningful step**, not just at the end
- Watch for context drift — if Claude starts deviating from PLAN.md or CLAUDE.md conventions, redirect early

### Subagent rules
- Each subagent should own a disjoint set of files (e.g. one owns `/backend`, another `/mobile`) to avoid merge conflicts
- All subagents in a session work on the **same branch** unless explicitly creating new branches
- Orchestrator agent verifies integration after subagents finish — don't trust "done" without proof

### Recovery from bad sessions
If Claude Code goes off the rails:
```bash
# See what it did
git status
git diff

# Discard uncommitted changes
git restore .

# Or roll back to last good commit
git reset --hard HEAD~1
```
This is why we commit often.

### What goes in `PLAN.md` vs `CLAUDE.md`
- **PLAN.md** — what we're building, architecture, roadmap, open questions
- **CLAUDE.md** — how we write code: conventions, style, "always/never" rules

Update both as the project evolves. Stale docs mislead future sessions.

## Code quality standards

### Backend (Python / FastAPI)
- Python 3.11+
- Type hints required on all function signatures
- Pydantic v2 for all request/response schemas
- Async SQLAlchemy — never use the sync API
- All Anthropic SDK calls go through `lib/anthropic.py` wrapper (retry, logging, cost tracking)
- All external API calls (Google Places, Yelp) go through their respective wrapper modules
- Format with `ruff format`, lint with `ruff check`
- Test with `pytest` — every endpoint needs at least one happy-path test

### Mobile (React Native / Expo)
- TypeScript strict mode, no `any` without a comment explaining why
- Expo Router for navigation (file-based)
- API calls go through `lib/api.ts` client — never call `fetch` directly in components
- Format with Prettier, lint with ESLint
- Use functional components and hooks; no class components

### Database
- All schema changes via Alembic migrations
- Migrations must be reversible (`downgrade()` implemented)
- Never edit a migration after it's been merged to `main` — write a new one
- Run migrations locally before opening a PR

### Secrets
- Never commit `.env`, API keys, or credentials
- Update `.env.example` when adding new env vars
- Use the host's secret manager (Railway, Supabase) in production

## Testing

### Backend
```bash
cd backend
pytest                    # run all tests
pytest -k recommendations # run a subset
pytest --cov              # with coverage
```

### Mobile
```bash
cd mobile
pnpm test                 # run all tests
pnpm typecheck            # TypeScript check
pnpm lint                 # ESLint
```

### Before opening a PR
Run all of:
```bash
# backend
cd backend && ruff check && ruff format --check && pytest

# mobile
cd mobile && pnpm typecheck && pnpm lint && pnpm test
```

CI runs the same checks. Save yourself a round trip.

## Releases

After merging to `main`, tag releases for meaningful milestones:
```bash
git checkout main
git pull
git tag v0.2-search-mvp -m "Phase 2 complete: working search endpoint"
git push origin v0.2-search-mvp
```

Tags give you clean rollback points if a later change breaks something.

## Questions or stuck?

- Architecture questions → check `PLAN.md` first
- Convention questions → check `CLAUDE.md` first
- Still stuck → open a draft PR and ask in the description

## TL;DR for every change

1. Branch off `main`
2. Make changes, commit often with conventional commits
3. Run tests locally
4. Push, open PR with description
5. Pass CI
6. Squash and merge
7. Delete the branch