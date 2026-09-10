import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const origin = "http://localhost:5173";
const localVersion = `${version}-local`;
const manifest = {
  name: "Stage Manager (Local)",
  version: localVersion,
  manifest_version: 1,
  author: "ex Asperis",
  icon: `${origin}/icon-color.svg`,
  background_url: `${origin}/background.html`,
  description: "Set the stage. Create, link, and control virtual layers for multi-state rooms, multi-floor maps, and other advanced effects.",
  action: {
    title: "Stage Manager (Local)",
    icon: `${origin}/icon-bw.svg`,
    popover: `${origin}/extension.html?v=${localVersion}`,
    height: 129,
    width: 375,
  },
};

const target = resolve(root, "public", "manifest-local.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${target} for ${localVersion}`);
