import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureManifest } from "./fixture-manifest";

const root = join(dirname(fileURLToPath(import.meta.url)), "generated");
mkdirSync(root, { recursive: true });

for (const fixture of fixtureManifest) {
  const bytes = fixture.bytes?.() ?? new TextEncoder().encode(fixture.text ?? "");
  writeFileSync(join(root, fixture.file), bytes);
}

console.log(`wrote ${fixtureManifest.length} fixtures to ${root}`);
