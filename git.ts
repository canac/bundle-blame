import { $ } from "@david/dax";
import type { Revision } from "./revision.ts";

/**
 * Return the primary branch, either main or master
 */
export const getPrimaryBranch = async (): Promise<string> => {
  const { code } = await $`git show-ref --quiet refs/heads/main`;
  return code === 0 ? "main" : "master";
};

/**
 * Return all the revisions from the `start` commit to HEAD, inclusive
 */
export const getRevisions = async (start: string): Promise<Revision[]> => {
  const lines = await $`git log --oneline --no-abbrev-commit ${start}..HEAD ${start}`.lines();
  return lines.map((line): Revision => ({
    commit: line.slice(0, 40),
    message: line.slice(41),
  }));
};

type GitLocation = { type: "branch"; branch: string } | { type: "commit"; commit: string };

const getLocation = async (): Promise<GitLocation> => {
  const branch = await $`git branch --show-current`.text();
  if (branch) {
    return { type: "branch", branch } as const;
  }

  const commit = await $`git rev-parse HEAD`.text();
  return { type: "commit", commit } as const;
};

/**
 * Save the current git state, including the current branch or commit and any uncommitted files, execute a callback, and
 * restore the original state
 */
export const sandbox = async (work: () => Promise<unknown>) => {
  const location = await getLocation();
  const stashed = (await $`git diff --quiet || git diff --cached --quiet`.noThrow()).code !== 0;
  if (stashed) {
    await $`git stash --include-untracked`;
  }

  try {
    await work();
  } finally {
    if (location.type === "branch") {
      await $`git switch ${location.branch}`;
    } else {
      await $`git switch --detach ${location.commit}`;
    }

    if (stashed) {
      await $`git stash pop`;
    }
  }
};
