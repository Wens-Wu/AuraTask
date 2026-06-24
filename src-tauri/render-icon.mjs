import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, "icon-source.svg"));
await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(join(here, "icon-source.png"));
console.log("Wrote icon-source.png (1024x1024)");
