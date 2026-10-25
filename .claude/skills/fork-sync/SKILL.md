---
name: fork-sync
description: Git and GitHub workflow for this repo only (the DinoSourcesRex/Image-to-Pixel fork of Tezumie/Image-to-Pixel). Use it for anything that branches, pushes, merges, syncs or opens a PR here, even when the words are casual, such as "pull in their updates", "sync with upstream", "sync my fork", "merge their changes", "open a PR for this", "get this into glamour", or "contribute this back to Tezumie". It keeps the user's work on glamour, keeps main a clean mirror, and stops PRs landing on Tezumie's repo by accident.
---

# fork-sync

Two remotes, two long-lived branches:

| | remote | branch | what it is |
|---|---|---|---|
| Tezumie's original | `upstream` (push URL `NO_PUSH_TO_UPSTREAM`, on purpose) | `upstream/main` | the only source of `main` |
| The user's fork | `origin` | `main` | clean mirror of Tezumie's `main`; nothing of the user's, ever |
| | | `glamour` | the user's version, the fork's default branch; ruleset requires a PR, blocks force-push and deletion |

Everything the user builds goes: feature branch -> PR -> `glamour`. Updates from Tezumie go: `upstream/main` -> `main` (fast-forward) -> merge into a sync branch -> PR -> `glamour`.

## Hard rules

- Never commit to `main`. Never push to `main` except a pure fast-forward from upstream.
- Never push straight to `glamour`; GitHub rejects it anyway. Always a PR.
- Never force-push, never rebase `glamour` or anything already pushed. Merge, so shared history stays put.
- Never change the `upstream` push URL. It is broken on purpose.
- Never open a PR against `Tezumie/Image-to-Pixel` unless the user explicitly asked to contribute upstream. **`gh` has no default repo set here, so a bare `gh pr create` prompts for the base repo with Tezumie's in the list.** Always pass `--repo` and `--base` explicitly so there is no prompt and no wrong pick.
- Before anything that pushes, run `git remote -v` and confirm `origin` is `DinoSourcesRex/Image-to-Pixel` and the `upstream` push URL is still `NO_PUSH_TO_UPSTREAM`.
- Pushing, opening and merging PRs are actions: get the user's go-ahead first, and only merge when they ask.

## 1. New change (feature or fix)

```bash
git remote -v
git fetch origin
git switch -c feat/<name> origin/glamour
# ...edit, commit...
git push -u origin HEAD
gh pr create --repo DinoSourcesRex/Image-to-Pixel --base glamour --fill    # head = current branch
```

When the user asks to merge:

```bash
gh pr merge <number> --repo DinoSourcesRex/Image-to-Pixel --merge --delete-branch
```

`--squash` is fine for feature PRs too. Sync PRs (below) must use `--merge`, otherwise `main`'s commits never enter `glamour`'s history and the next sync re-conflicts on the same files.

## 2. Pull in Tezumie's updates ("sync with upstream")

Step A: fast-forward `main`. Both commands refuse non-fast-forwards ("diverging changes" / "non-fast-forward"); if you see either, `main` has diverged, so stop and tell the user and never use `--force`. "refusing to fetch into branch ... checked out" only means `main` is checked out: switch away and retry.

```bash
git remote -v
gh repo sync DinoSourcesRex/Image-to-Pixel --branch main       # GitHub: fork main <- Tezumie main
git fetch origin main:main                                     # local main <- fork main
git fetch upstream && git log --oneline main...upstream/main   # must print nothing: main and upstream/main are identical
```

Step B: merge `main` into a sync branch and PR it into `glamour`.

```bash
git fetch origin
git switch -c sync/upstream-$(date +%F) origin/glamour
git merge main
# resolve conflicts (see below), then:
npm test
git push -u origin HEAD
gh pr create --repo DinoSourcesRex/Image-to-Pixel --base glamour --fill    # head = current branch
```

Merge with `--merge` when the user asks (section 1).

## 3. Contribute something back to Tezumie

Only when the user explicitly asks. Branch off `main`, not `glamour`, so none of their other changes ride along. It is public and goes to someone else's repo, so show the user the diff, title and body and get their approval of the exact text before opening it.

```bash
git remote -v
git fetch upstream && git fetch origin main:main
git switch -c contrib/<name> main
git cherry-pick <sha>            # or re-apply just that change by hand
npm test
git push -u origin HEAD
gh pr create --repo Tezumie/Image-to-Pixel --base main --head DinoSourcesRex:contrib/<name> \
  --title "<title the user approved>" --body "<body the user approved>"
```

## Conflicts when syncing

The user's changes live in a few files, so those are where Tezumie's edits collide. Get the current list from the diff, not from memory:

```bash
git diff main..glamour --stat
```

Resolve by keeping the user's intent and Tezumie's new behaviour. Two things to know going in: in `package.json` the `bin` entry and the `pngjs` devDependency are the user's; in `scripts/serve.mjs` and `site/docs/contributing.md` the dev port is 5246 (Tezumie's is 8080; keep 5246).

For `package-lock.json`, do not hand-merge. Resolve `package.json` first (keep `bin` and `pngjs`), then regenerate the lock from Tezumie's side:

```bash
git checkout --theirs package-lock.json && npm install && git add package-lock.json
```

(`--theirs` is `main` here, the branch being merged in. `npm install` fails on conflict markers in `package.json`, or silently drops `pngjs` if it is not back in yet, which is why `package.json` goes first.) The `resolving-merge-conflicts` skill helps with the rest. Run `npm test` before pushing; it builds the site and runs the node tests, so it catches most bad merges.
