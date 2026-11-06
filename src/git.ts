import { $ } from "@david/dax";
import { encodeHex } from "@std/encoding/hex";
import { ensureDir, exists } from "@std/fs";
import { basename, dirname, join } from "@std/path";
import type { Revision } from "./revision.ts";
import { getCacheDir } from "./stats_store.ts";

/**
 * Return the primary branch, either main or master
 */
export const getPrimaryBranch = async (): Promise<string> => {
  const { code } = await $`git show-ref --quiet refs/heads/main`;
  return code === 0 ? "main" : "master";
};

/**
 * Return all the revisions from the `start` commit to HEAD, inclusive. If `start` and HEAD are on different branches,
 * it returns the commits from the merge base to HEAD, inclusive.
 */
export const getRevisions = async (start: string): Promise<Revision[]> => {
  const mergeBase = await $`git merge-base ${start} HEAD`.text();
  const lines =
    await $`git log --format=${"%H %s"} --first-parent --reverse HEAD --not ${mergeBase}^@`
      .lines();
  return lines.map((line): Revision => ({
    commit: line.slice(0, 40),
    message: line.slice(41),
  }));
};

/**
 * Return the path to this repo's dedicated build worktree.
 */
export const getWorktree = async (): Promise<string> => {
  const repoRoot = dirname(await $`git rev-parse --path-format=absolute --git-common-dir`.text());
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(repoRoot));
  const name = `${basename(repoRoot)}-${encodeHex(digest).slice(0, 6)}`;
  const worktree = join(getCacheDir(), "worktrees", name);

  if (!await exists(worktree)) {
    await ensureDir(dirname(worktree));
    await $`git worktree add --force --detach ${worktree}`;
  }
  return worktree;
};

/**
 * Check out a commit in the worktree.
 */
export const checkout = async (worktree: string, commit: string): Promise<void> => {
  await $`git switch --detach --discard-changes ${commit}`.cwd(worktree);
};
