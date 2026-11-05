import { $ } from "@david/dax";
import { exists } from "@std/fs/exists";
import { join } from "@std/path";
import type { Stats } from "./stats_store.ts";

export type PackageManager = "npm" | "yarn" | "pnpm" | "unknown";

/**
 * Return the gzipped size of a file in bytes.
 */
const gzipSize = async (file: Deno.FsFile): Promise<number> => {
  let size = 0;
  for await (const chunk of file.readable.pipeThrough(new CompressionStream("gzip"))) {
    size += chunk.byteLength;
  }
  return size;
};

export class Builder {
  #packageManager: PackageManager | null = null;

  /**
   * Build the Next.js project and return the build stats
   */
  async build(): Promise<Stats> {
    this.#packageManager ??= await this.#detectPackageManager();
    if (this.#packageManager === "unknown") {
      throw new Error("Cannot determine package manager");
    }

    await $`${this.#packageManager} build`;

    const nextDir = ".next";
    const { pages } = JSON.parse(
      await Deno.readTextFile(
        join(nextDir, "build-manifest.json"),
      ),
    ) as { pages: Record<string, string[]> };

    const pageSizes = new Map<string, Promise<number>>();
    const pageSizePromises = Object.entries(pages).map(async ([page, entries]) => {
      const sizes = await Promise.all(
        entries.filter((file) => file.endsWith(".js")).map((file) => {
          const cachedPageSize = pageSizes.get(file);
          if (cachedPageSize) {
            return cachedPageSize;
          }

          const pageSize = Deno.open(join(nextDir, file)).then(gzipSize);
          pageSizes.set(file, pageSize);
          return pageSize;
        }),
      );

      return [
        page,
        sizes.reduce((total: number, size: number) => total + size, 0),
      ] as const;
    });
    return Object.fromEntries(await Promise.all(pageSizePromises));
  }

  /**
   * Determine the project's package manager
   */
  async #detectPackageManager(): Promise<PackageManager> {
    if (await exists("package-lock.json")) {
      return "npm";
    } else if (await exists("yarn.lock")) {
      return "yarn";
    } else if (await exists("pnpm-lock.yaml")) {
      return "pnpm";
    } else {
      return "unknown";
    }
  }
}
