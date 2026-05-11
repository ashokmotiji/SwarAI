#!/usr/bin/env node
/**
 * Captures README screenshots from static /readme-preview/* routes.
 * Prereq: pnpm install && pnpm exec playwright install chromium
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const shotDir = path.join(root, "screenshots");
const PORT = "4173";
const base = `http://127.0.0.1:${PORT}`;

const shots = [
  { url: "/readme-preview/dashboard", file: "dashboard.png", fullPage: false },
  { url: "/readme-preview/agent-editor", file: "agent-editor.png", fullPage: false },
  { url: "/readme-preview/simulator", file: "simulator.png", fullPage: false },
  { url: "/readme-preview/settings", file: "settings.png", fullPage: true },
];

const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=8192",
  PORT,
  HOSTNAME: "127.0.0.1",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_readme_capture_placeholder",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "sk_test_readme_capture_placeholder",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`,
  NODE_ENV: "production",
};

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

async function waitForServer(url, maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (r.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server not ready: ${url}`);
}

async function main() {
  await mkdir(shotDir, { recursive: true });

  console.log("Building @swarsales/web…");
  await run("pnpm", ["--filter", "@swarsales/web", "build"], root);

  console.log(`Starting Next.js on ${base}…`);
  const server = spawn(
    "pnpm",
    ["--filter", "@swarsales/web", "exec", "next", "start", "-H", "127.0.0.1", "-p", PORT],
    {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  try {
    await waitForServer(`${base}/readme-preview/dashboard`);

    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    for (const s of shots) {
      const target = `${base}${s.url}`;
      console.log("Capturing", target);
      await page.goto(target, { waitUntil: "networkidle", timeout: 90000 });
      await page.screenshot({
        path: path.join(shotDir, s.file),
        type: "png",
        fullPage: s.fullPage,
      });
    }
    await browser.close();
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("Wrote PNGs to screenshots/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
