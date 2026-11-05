import { $ } from "@david/dax";
import { join } from "@std/path";
import { Builder, type BuildOutput, type PackageManager } from "./builder.ts";

export class NextBuilder extends Builder {
  protected async buildProject(packageManager: PackageManager): Promise<BuildOutput> {
    await $`${packageManager} run build`.cwd(this.dir);

    const outDir = join(this.dir, ".next");
    const { pages } = JSON.parse(
      await Deno.readTextFile(join(outDir, "build-manifest.json")),
    ) as { pages: Record<string, string[]> };
    return { outDir, routes: pages };
  }
}
