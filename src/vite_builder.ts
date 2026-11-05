import { $ } from "@david/dax";
import { exists } from "@std/fs/exists";
import { join } from "@std/path";
import { Builder, type BuildOutput, type PackageManager } from "./builder.ts";

export interface ViteManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}

export type ViteManifest = Record<string, ViteManifestChunk>;

const normalizeKey = (key: string): string =>
  // pnpm store directories embed version hashes that change whenever dependencies change
  key.replace(/node_modules\/\.pnpm\/[^/]+\/node_modules\//, "node_modules/");

/**
 * Collect the keys of a chunk and its transitive static imports
 */
const collectStatic = (
  manifest: ViteManifest,
  key: string,
  visited = new Set<string>(),
): Set<string> => {
  if (!visited.has(key)) {
    visited.add(key);
    manifest[key]?.imports?.forEach((imported) => collectStatic(manifest, imported, visited));
  }
  return visited;
};

/** Detect TanStackStart routes */
const isRoute = (key: string): boolean => key.includes("?tsr-split=");

/**
 * Map each route and lazy import to the JS files it loads.
 */
export const getViteRoutes = (manifest: ViteManifest): Record<string, string[]> => {
  const toFiles = (keys: Iterable<string>) =>
    Array.from(keys)
      .map((key) => manifest[key]?.file)
      .filter((file): file is string => file?.endsWith(".js") ?? false);

  const routes = new Map<string, Set<string>>();
  const addRoute = (route: string, keys: Iterable<string>) => {
    const existing = routes.get(route) ?? new Set();
    routes.set(route, existing.union(new Set(keys)));
  };

  for (const [entry] of Object.entries(manifest).filter(([, chunk]) => chunk.isEntry)) {
    const entryKeys = collectStatic(manifest, entry);

    const lazyImports = new Set<string>();
    const queue = [...entryKeys];
    for (const key of queue) {
      for (const lazy of manifest[key]?.dynamicImports ?? []) {
        if (manifest[lazy]?.isDynamicEntry && !lazyImports.has(lazy)) {
          lazyImports.add(lazy);
          queue.push(...collectStatic(manifest, lazy));
        }
      }
    }

    if (!lazyImports.values().some(isRoute)) {
      addRoute(entry, entryKeys);
    }
    for (const lazy of lazyImports) {
      const lazyKeys = collectStatic(manifest, lazy);
      addRoute(lazy, isRoute(lazy) ? entryKeys.union(lazyKeys) : lazyKeys.difference(entryKeys));
    }
  }

  return Object.fromEntries(
    Array.from(routes, ([route, keys]) => [normalizeKey(route), toFiles(keys)]),
  );
};

// Framework-dependent build directory
const BUILD_DIRS = [
  // TanStack Start
  join("dist", "client"),
  // React Router and Remix
  join("build", "client"),
  // SvelteKit
  join(".svelte-kit", "output", "client"),
  // Vite
  "dist",
];

export class ViteBuilder extends Builder {
  protected async buildProject(packageManager: PackageManager): Promise<BuildOutput> {
    if (packageManager === "npm") {
      await $`npm run build -- --manifest`.cwd(this.dir);
    } else {
      await $`${packageManager} run build --manifest`.cwd(this.dir);
    }

    for (const buildDir of BUILD_DIRS) {
      const outDir = join(this.dir, buildDir);
      const manifestPath = join(outDir, ".vite", "manifest.json");
      if (await exists(manifestPath)) {
        const manifest = JSON.parse(await Deno.readTextFile(manifestPath)) as ViteManifest;
        return { outDir, routes: getViteRoutes(manifest) };
      }
    }
    throw new Error(
      `Cannot find Vite manifest in ${BUILD_DIRS.map((dir) => join(dir, ".vite")).join(" or ")}`,
    );
  }
}
