import { ensureDir } from "@std/fs";
import { join } from "@std/path";

export type Stats = Record<string, number>;

export class StatsStore {
  #cacheDir: string;

  constructor() {
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) {
      throw new Error("$HOME environment variable is not set");
    }
    this.#cacheDir = join(homeDir, ".cache", "bundle-blame");
  }

  /**
   * Read the stats file for a specific commit
   */
  async readStats(commit: string): Promise<Stats | null> {
    try {
      return JSON.parse(
        await Deno.readTextFile(join(this.#cacheDir, `${commit}.json`)),
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
    await ensureDir(this.#cacheDir);
    await Deno.writeTextFile(
      join(this.#cacheDir, `${commit}.json`),
      JSON.stringify(stats, null, 2),
    );
  }
}

/**
 * Find any differences between two sets of stats
 */
export const diffStats = (stats1: Stats, stats2: Stats): Array<{ file: string; change: number }> =>
  Object.entries(stats1).map(([file, size1]) => {
    const size2 = stats2[file] ?? 0;
    return { file, change: size2 - size1 };
  }).filter(({ change }) => Math.abs(change) > 0);
