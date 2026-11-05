import { ensureDir } from "@std/fs";
import { join } from "@std/path";

export type Stats = Record<string, number>;

/**
 * Return the root directory for cached data.
 */
export const getCacheDir = (): string => {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    throw new Error("$HOME environment variable is not set");
  }
  return join(homeDir, ".cache", "bundle-blame");
};

export class StatsStore {
  #statsDir = join(getCacheDir(), "commits");

  /**
   * Read the stats file for a specific commit
   */
  async readStats(commit: string): Promise<Stats | null> {
    try {
      return JSON.parse(
        await Deno.readTextFile(join(this.#statsDir, `${commit}.json`)),
      );
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Write the stats file for a specific commit
   */
  async writeStats(commit: string, stats: Stats): Promise<void> {
    await ensureDir(this.#statsDir);
    await Deno.writeTextFile(
      join(this.#statsDir, `${commit}.json`),
      JSON.stringify(stats, null, 2),
    );
  }
}

/**
 * Find any differences between two sets of stats
 */
export const diffStats = (stats1: Stats, stats2: Stats): Array<{ file: string; change: number }> =>
  Array.from(new Set([...Object.keys(stats1), ...Object.keys(stats2)]))
    .map((file) => ({ file, change: (stats2[file] ?? 0) - (stats1[file] ?? 0) }))
    .filter(({ change }) => change !== 0);
