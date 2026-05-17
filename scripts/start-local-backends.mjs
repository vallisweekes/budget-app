#!/usr/bin/env node
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_REPO_ROOT = path.resolve(__dirname, "..");
const NEXT_JS_ROOT = path.join(APP_REPO_ROOT, "web-client");
const DOTNET_REPO_ROOT = path.resolve(APP_REPO_ROOT, "..", "budgetin-check-api");

const NEXT_JS_URL = "http://localhost:5537";
const DOTNET_URL = "http://localhost:5262";
const LOCAL_HOST = "127.0.0.1";
const NEXT_JS_PORT = 5537;
const DOTNET_PORT = 5262;

const VALID_FLAGS = new Set(["--help", "--print-only"]);
const flags = process.argv.slice(2);
const unknownFlags = flags.filter((flag) => !VALID_FLAGS.has(flag));

if (unknownFlags.length > 0) {
  console.error(`Unknown flag(s): ${unknownFlags.join(", ")}`);
  printUsage(1);
}

if (flags.includes("--help")) {
  printUsage(0);
}

const printOnly = flags.includes("--print-only");

function printUsage(exitCode) {
  console.log("Usage: node scripts/start-local-backends.mjs [--print-only]");
  console.log("");
  console.log("Starts the local Next.js BFF and the staged .NET API together.");
  console.log("");
  console.log("Options:");
  console.log("  --print-only   Print the exact EXPO_PUBLIC_API_BASE_URL values and exit.");
  console.log("  --help         Show this message.");
  process.exit(exitCode);
}

function printEnvironmentHints() {
  console.log("Local backend URLs:");
  console.log(`- Next.js BFF: ${NEXT_JS_URL}`);
  console.log(`- .NET API:    ${DOTNET_URL}`);
  console.log("");
  console.log("Use one of these exact mobile env values:");
  console.log(`EXPO_PUBLIC_API_BASE_URL=${NEXT_JS_URL}`);
  console.log(`EXPO_PUBLIC_API_BASE_URL=${DOTNET_URL}`);
  console.log("");
  console.log("The .NET API still proxies unmigrated /api/bff routes to Next.js, so keep both backends running when testing against .NET.");
}

async function resolveDotnetCommand() {
  const configuredPath = (process.env.DOTNET_PATH ?? "").trim();
  const candidates = [configuredPath, path.join(os.homedir(), ".dotnet", "dotnet")].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep checking fallbacks.
    }
  }

  return "dotnet";
}

function spawnProcess(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (error) => {
    console.error(`${label} failed to start:`, error.message);
  });

  return child;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: LOCAL_HOST, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.setTimeout(400);
  });
}

async function main() {
  printEnvironmentHints();

  if (printOnly) {
    return;
  }

  const dotnetCommand = await resolveDotnetCommand();
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  console.log("");
  console.log("Starting local backends...");
  console.log(`- Next.js command: ${npmCommand} run dev`);
  console.log(`- .NET command: ${dotnetCommand} run --project src/BudgetinCheck.Api --launch-profile http`);

  const nextJsRunning = await isPortOpen(NEXT_JS_PORT);
  const dotnetRunning = await isPortOpen(DOTNET_PORT);
  const processes = [];

  if (nextJsRunning) {
    console.log(`- Next.js BFF already appears to be running on ${NEXT_JS_URL}; skipping duplicate start.`);
  } else {
    processes.push({
      label: "Next.js BFF",
      child: spawnProcess("Next.js BFF", npmCommand, ["run", "dev"], NEXT_JS_ROOT),
    });
  }

  if (dotnetRunning) {
    console.log(`- .NET API already appears to be running on ${DOTNET_URL}; skipping duplicate start.`);
  } else {
    processes.push({
      label: ".NET API",
      child: spawnProcess(
        ".NET API",
        dotnetCommand,
        ["run", "--project", "src/BudgetinCheck.Api", "--launch-profile", "http"],
        DOTNET_REPO_ROOT
      ),
    });
  }

  if (processes.length === 0) {
    console.log("Both local backend ports are already in use. Leaving the running servers untouched.");
    return;
  }

  let shuttingDown = false;

  const shutdown = (exitCode = 0) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const { child } of processes) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }

    setTimeout(() => {
      process.exit(exitCode);
    }, 250);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  for (const { label, child } of processes) {
    child.on("exit", (code, signal) => {
      if (shuttingDown) {
        return;
      }

      const exitCode = typeof code === "number" ? code : 1;
      const details = signal ? `signal ${signal}` : `code ${exitCode}`;
      console.error(`${label} exited with ${details}. Stopping the other backend.`);
      shutdown(exitCode);
    });
  }
}

main().catch((error) => {
  console.error("start-local-backends failed:", error);
  process.exit(1);
});