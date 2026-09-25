import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson("manifest.json");
const pkg = await readJson("package.json");
const versions = await readJson("versions.json");
if (pkg.version !== manifest.version || versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error("Keep package.json, manifest.json, and versions.json in sync.");
}

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2022",
  platform: "browser",
  outfile: "main.js",
  banner: {
    js: `/* Underleaf ${manifest.version} | MIT | ${manifest.author} */`,
  },
});
