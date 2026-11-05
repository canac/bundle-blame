import { $ } from "@david/dax";
import { argument, integer, message, object, option, optional, string } from "@optique/core";
import { path, run } from "@optique/run";
import { assert } from "@std/assert";
import { slidingWindows } from "@std/collections";
import { format } from "@std/fmt/bytes";
import { blue, green, red, yellow } from "@std/fmt/colors";
import { join } from "@std/path";
import type { Builder } from "./builder.ts";
import { checkout, getPrimaryBranch, getRevisions, getWorktree } from "./git.ts";
import { NextBuilder } from "./next_builder.ts";
import type { Revision } from "./revision.ts";
import { diffStats, StatsStore } from "./stats_store.ts";
import { ViteBuilder } from "./vite_builder.ts";

/**
 * Create a project builder based on its package.json dependencies
 */
const createBuilder = async (dir: string): Promise<Builder> => {
  const { dependencies = {}, devDependencies = {} } = JSON.parse(
    await Deno.readTextFile(join(dir, "package.json")),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = { ...dependencies, ...devDependencies };
  if ("next" in deps) {
    return new NextBuilder(dir);
  } else if ("vite" in deps) {
    return new ViteBuilder(dir);
  }
  throw new Error("Cannot determine framework, expected next or vite in package.json");
};

const config = run(
  object({
    start: optional(argument(string({ metavar: "REF" }), {
      description: message`Commit to start from, defaults to main or master`,
    })),
    change: optional(
      option("-C", "--change", path({ metavar: "DIR", type: "directory", mustExist: true }), {
        description: message`Run as if started in DIR`,
      }),
    ),
    delta: option("-d", "--delta", integer({ min: 0, metavar: "BYTES" }), {
      description: message`Only report size changes larger than BYTES`,
    }).withDefault(128),
  }),
  {
    programName: "bundle-blame",
    description: message`Track changes bundle sizes across commits`,
    help: "both",
    completion: "option",
    termWidth: "auto",
  },
);
if (config.change !== undefined) {
  Deno.chdir(config.change);
}

$.setPrintCommand(true);

const statsStore = new StatsStore();

const revisions = await getRevisions(config.start ?? await getPrimaryBranch());
const worktree = await getWorktree();
let builder: Builder | null = null;
for (const { commit } of revisions) {
  if (await statsStore.readStats(commit) === null) {
    await checkout(worktree, commit);
    builder ??= await createBuilder(worktree);
    await statsStore.writeStats(commit, await builder.build());
  }
}

const formatRevision = (revision: Revision): string =>
  `"${green(revision.message)}" (${yellow(revision.commit.slice(0, 7))})`;

for (const [revision1, revision2] of slidingWindows(revisions, 2)) {
  assert(revision1 !== undefined);
  assert(revision2 !== undefined);

  const stats1 = await statsStore.readStats(revision1.commit);
  const stats2 = await statsStore.readStats(revision2.commit);
  assert(stats1 !== null);
  assert(stats2 !== null);

  const differences = diffStats(stats1, stats2, config.delta);
  if (differences.length > 0) {
    const header = `${formatRevision(revision2)} vs ${formatRevision(revision1)}:`;
    const body = differences.map(({ file, change }) =>
      `${blue(file)}: ${change > 0 ? red("increased") : green("decreased")} by ${
        format(Math.abs(change))
      }`
    ).join("\n");
    console.log(
      `${header}\n${body}\n\n`,
    );
  }
}
