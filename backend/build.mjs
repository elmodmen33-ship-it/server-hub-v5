import { rmSync, existsSync } from "fs";
import { build } from "esbuild";
import { esbuildPluginPino } from "esbuild-plugin-pino";

if (existsSync("dist")) rmSync("dist", { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  external: [
    "bcryptjs",
    "node-pty",
    "sharp",
    "ssh2",
    "fsevents",
  ],
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
  },
});
