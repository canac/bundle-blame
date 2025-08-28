import { $ } from "@david/dax";
import { assert } from "@std/assert";
import { slidingWindows } from "@std/collections";
import { format } from "@std/fmt/bytes";
import { blue, green, red, yellow } from "@std/fmt/colors";
import { Builder } from "./builder.ts";
import { getPrimaryBranch, getRevisions } from "./git.ts";
import type { Revision } from "./revision.ts";
import { diffStats, StatsStore } from "./stats_store.ts";

$.setPrintCommand(true);

const builder = new Builder();
const statsStore = new StatsStore();

const revisions = await getRevisions(Deno.args[0] ?? await getPrimaryBranch());
for (const { sha: revision } of revisions) {
  if (await statsStore.readStats(revision) === null) {
    await $`git switch ${revision} --detach`;
    await statsStore.writeStats(revision, await builder.build());
  }
}

const formatRevision = (revision: Revision): string =>
  `"${green(revision.message)}" (${yellow(revision.sha)})`;

for (const [revision1, revision2] of slidingWindows(revisions, 2)) {
  assert(revision1 !== undefined);
  assert(revision2 !== undefined);

  const stats1 = await statsStore.readStats(revision1.sha);
  const stats2 = await statsStore.readStats(revision2.sha);
  assert(stats1 !== null);
  assert(stats2 !== null);

  const differences = diffStats(stats1, stats2);
  if (differences.length > 0) {
    const header = `${formatRevision(revision1)} vs ${formatRevision(revision2)}:`;
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
