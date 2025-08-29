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
