#!/usr/bin/env node
/**
 * Public tunnel for the TRACE demo.
 *
 * Exposes the local server (default port 3000) on a public HTTPS address so teammates on other
 * networks can open it. Uses an SSH tunnel over port 443, because campus and venue firewalls
 * commonly block the ports cloudflared and ngrok need.
 *
 * The free tier expires after 60 minutes, so this restarts automatically and prints the new
 * address. Run:  npm run tunnel
 */
import { spawn } from "node:child_process";

const PORT = process.env.PORT || 3000;
const HOST = "a.pinggy.io";
const URL_RE = /https:\/\/[a-z0-9.-]+\.(?:pinggy-free\.link|free\.pinggy\.net|pinggy\.link)/gi;

let current = new Set();
let restarts = 0;

function banner(url) {
  const line = "-".repeat(64);
  console.log(`\n${line}`);
  console.log("  TRACE is now reachable from anywhere\n");
  console.log(`  Stage      ${url}/stage`);
  console.log(`  Presenter  ${url}/presenter`);
  console.log(`  Phone      ${url}/phone`);
  console.log(`  Guardian   ${url}/guardian\n`);
  console.log("  On the same wifi as this laptop? The local address is faster:");
  console.log(`  http://<this-laptop-ip>:${PORT}/phone`);
  console.log("\n  If a phone cannot open the link, set its DNS to 8.8.8.8 or use mobile data.");
  console.log(`${line}\n`);
}

function start() {
  const args = [
    "-p",
    "443",
    `-R0:localhost:${PORT}`,
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=/dev/null",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=3",
    "-n",
    HOST,
  ];
  console.log(`[tunnel] connecting to ${HOST} on port 443${restarts ? ` (restart ${restarts})` : ""}...`);
  const ssh = spawn("ssh", args, { stdio: ["ignore", "pipe", "pipe"] });

  const scan = (buf) => {
    const found = buf.toString().match(URL_RE);
    if (!found) return;
    for (const u of found) {
      if (current.has(u)) continue;
      current.add(u);
      if (current.size === 1) banner(u); // first address only; the rest are aliases
    }
  };

  ssh.stdout.on("data", scan);
  ssh.stderr.on("data", (b) => {
    scan(b);
    const t = b.toString();
    if (/permission denied|could not resolve|connection refused/i.test(t)) process.stderr.write(`[tunnel] ${t}`);
  });

  ssh.on("exit", (code) => {
    current = new Set();
    restarts += 1;
    console.log(`[tunnel] connection closed (code ${code}). Reconnecting in 3s; the address will change.`);
    setTimeout(start, 3000);
  });

  ssh.on("error", (e) => {
    console.error(`[tunnel] could not run ssh: ${e.message}`);
    console.error("[tunnel] ssh ships with Git for Windows and with Windows OpenSSH.");
    process.exit(1);
  });
}

process.on("SIGINT", () => {
  console.log("\n[tunnel] stopped.");
  process.exit(0);
});

start();
