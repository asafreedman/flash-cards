# GitHub Workflows and Infra Cost Analysis Tutorial

This guide explains how GitHub Actions is used in this repo, how the infrastructure cost guard works, and how to avoid CI failures when making infra changes.

## What workflow exists today

Current workflow file:

- `.github/workflows/infra-cost-guard.yml`

Workflow name:

- `Infra Cost Guard`

It runs on:

- `pull_request` when files under `infra/**`, `scripts/verify-infra-cost-readme.mjs`, or the workflow file itself change
- `push` to `main` for the same paths

Job:

- `verify-infra-cost-readme`

What the job does:

1. Checks out the repo.
2. Sets up Node.js 20.
3. Runs `node scripts/verify-infra-cost-readme.mjs`.

## Why this workflow exists

Infra code changes can silently alter monthly AWS costs. This workflow enforces a small but useful policy:

- If Terraform-related infra code changes, the cost estimate section in `infra/README.md` must be reviewed and updated.

That gives reviewers a clear signal that cost impact was considered.

## How cost analysis enforcement works

The guard script is:

- `scripts/verify-infra-cost-readme.mjs`

The script checks changed files from three sources:

- `git diff --name-only` (unstaged changes)
- `git diff --name-only --cached` (staged changes)
- `git diff --name-only <base>...HEAD` (PR or comparison range)

Base ref selection:

- In GitHub PRs, it uses `GITHUB_BASE_REF` (for example `main`), translated to `origin/<base>`.
- Locally, you can set `COST_CHECK_BASE_REF` manually.

Infra code is considered changed when:

- A file path starts with `infra/`
- The file is not `infra/README.md`
- The file is not any other markdown file (`*.md`)

If infra code changed, the script requires:

1. `infra/README.md` is part of the change set.
2. `infra/README.md` contains a date marker line in this format:
   - `Cost estimate last reviewed: YYYY-MM-DD`
3. If a base ref is available, the date marker must be different from the base branch marker.

If these checks pass, CI passes.

## Fast local workflow before opening a PR

Use this checklist when you touch `infra/*.tf` or other infra code files.

1. Update cost docs in `infra/README.md`.
2. Bump the review marker date.
3. Run the local guard.

```bash
npm run infra:check-cost
```

To simulate PR-style comparison against `main` locally:

```bash
COST_CHECK_BASE_REF=origin/main npm run infra:check-cost
```

If your local `origin/main` is stale, refresh first:

```bash
git fetch origin
```

## Common failure messages and fixes

`Infrastructure files changed but infra/README.md was not updated.`

- Fix: Edit `infra/README.md` and include cost-impact updates.

`Missing review marker in infra/README.md.`

- Fix: Add a line exactly like:
  - `Cost estimate last reviewed: 2026-08-09`

`Infrastructure changed but cost review marker date was not updated.`

- Fix: Change the marker date to today after reviewing estimates.

## What counts as a meaningful cost update

When infra code changes, update one or more of:

- Baseline monthly estimate range
- Autoscaling cost impact notes
- Major cost multipliers (for example Multi-AZ, data transfer, log volume)
- Assumptions (region, hours/month, traffic profile)

Keep estimates approximate but explicit.

## Suggested PR template snippet

You can paste this into your PR description when infra is touched:

```md
## Infra Cost Review
- [ ] I updated `infra/README.md` cost estimates and assumptions.
- [ ] I updated `Cost estimate last reviewed: YYYY-MM-DD`.
- [ ] I ran `npm run infra:check-cost` locally.
```

## Adding future workflows

When you add a new workflow under `.github/workflows/`:

1. Keep workflow names and job names descriptive.
2. Scope `on.paths` filters narrowly to reduce unnecessary runs.
3. Reuse repo scripts from `scripts/` for logic-heavy checks.
4. Ensure workflow behavior can be replicated locally with an npm script.
5. Document policy intent in a README so contributors understand failures quickly.

## Related files

- `.github/workflows/infra-cost-guard.yml`
- `scripts/verify-infra-cost-readme.mjs`
- `infra/README.md`
- `package.json` (`infra:check-cost` script)
