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

/**
 * The JS files that each route loads, relative to `outDir`
 */
export interface BuildOutput {
  outDir: string;
  routes: Record<string, string[]>;
}

export abstract class Builder {
  protected readonly dir: string;
  #packageManager: PackageManager | null = null;

  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Install dependencies, build the project, and return the build stats
   */
  async build(): Promise<Stats> {
    this.#packageManager ??= await this.#detectPackageManager();
    if (this.#packageManager === "unknown") {
      throw new Error("Cannot determine package manager");
    }

    await $`${this.#packageManager} install`.cwd(this.dir);
    const { outDir, routes } = await this.buildProject(this.#packageManager);

    const fileSizes = new Map<string, Promise<number>>();
    const routeSizePromises = Object.entries(routes).map(async ([route, files]) => {
      const sizes = await Promise.all(
        files.filter((file) => file.endsWith(".js")).map((file) => {
          const cachedFileSize = fileSizes.get(file);
          if (cachedFileSize) {
            return cachedFileSize;
          }

          const fileSize = Deno.open(join(outDir, file)).then(gzipSize);
          fileSizes.set(file, fileSize);
          return fileSize;
        }),
      );

      return [
        route,
        sizes.reduce((total: number, size: number) => total + size, 0),
      ] as const;
    });
    return Object.fromEntries(await Promise.all(routeSizePromises));
  }

  /**
   * Build the project with its dependencies already installed
   */
  protected abstract buildProject(packageManager: PackageManager): Promise<BuildOutput>;

  /**
   * Determine the project's package manager
   */
  async #detectPackageManager(): Promise<PackageManager> {
    if (await exists(join(this.dir, "package-lock.json"))) {
      return "npm";
    } else if (await exists(join(this.dir, "yarn.lock"))) {
      return "yarn";
    } else if (await exists(join(this.dir, "pnpm-lock.yaml"))) {
      return "pnpm";
    } else {
      return "unknown";
    }
  }
}
