// Runs the production server from the standalone build output.
// Copies static assets into the standalone layout (mirrors the Dockerfile),
// then starts node .next/standalone/server.js.
import { cpSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
  force: true,
});
cpSync(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
  force: true,
});

const server = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  cwd: standalone,
});

server.on("exit", (code) => process.exit(code ?? 0));
