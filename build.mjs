import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rename, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const files = [
  "app.mjs",
  "collector.mjs",
  "index.html",
  "manifest.json",
  "read-page.mjs",
  "service-worker.mjs",
  "styles.css",
];
const source = fileURLToPath(new URL("./extension/", import.meta.url));
const output = fileURLToPath(new URL("./dist/", import.meta.url));
await mkdir(output, { recursive: true });

const work = await mkdtemp(join(output, ".canvas-synced-"));
try {
  const unpacked = join(work, "canvas-synced");
  await mkdir(unpacked);
  const timestamp = new Date("1980-01-01T00:00:00Z");
  for (const file of files) {
    const target = join(unpacked, file);
    await copyFile(join(source, file), target);
    await utimes(target, timestamp, timestamp);
  }
  const archive = join(work, "canvas-synced.zip");
  const zip = spawnSync("zip", ["-X", "-q", archive, ...files.map((file) => `canvas-synced/${file}`)], {
    cwd: work,
    env: { ...process.env, TZ: "UTC" },
    stdio: "inherit",
  });
  if (zip.error) throw zip.error;
  if (zip.status !== 0) throw new Error(`zip failed with exit code ${zip.status}`);
  await rename(archive, join(output, "canvas-synced.zip"));
  console.log("Built dist/canvas-synced.zip");
} finally {
  await rm(work, { recursive: true, force: true });
}
