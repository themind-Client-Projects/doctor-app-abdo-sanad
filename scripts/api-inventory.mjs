#!/usr/bin/env node
/**
 * Print every API route, its methods, and the role group each one requires.
 *
 * Written by reading `src/app/api`, not by hand: a hand-kept endpoint list in a
 * document is wrong the day after it is written, and the mobile team would have
 * no way to tell. Regenerate the table in docs/api/README.md with:
 *
 *   node scripts/api-inventory.mjs --markdown
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_DIR = "src/app/api";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) routeFiles(path, found);
    else if (entry === "route.ts") found.push(path);
  }
  return found;
}

/**
 * The role group guarding a handler.
 *
 * Read from the `withAuth({ roles: ... })` call that wraps it. A handler
 * exported as a bare `export async function` has no wrapper and is therefore
 * public — which is a fact worth surfacing, not hiding.
 */
function handlersIn(source) {
  const out = [];
  for (const method of METHODS) {
    const assigned = source.search(new RegExp(`export const ${method}\\s*=`));
    const bare = new RegExp(`export async function ${method}\\s*\\(`).test(source);
    if (assigned < 0 && !bare) continue;

    let roles = "PUBLIC";
    if (assigned >= 0) {
      const head = source.slice(assigned, assigned + 400);
      const named = head.match(/roles:\s*ROLES\.(\w+)/);
      const local = head.match(/roles:\s*([A-Z_]+)\b/);
      roles = named
        ? `ROLES.${named[1]}`
        : local
          ? local[1]
          : /withAuth/.test(head)
            ? "AUTHENTICATED"
            : "PUBLIC";
    }
    out.push({ method, roles });
  }
  return out;
}

const routes = routeFiles(API_DIR)
  .sort()
  .map((file) => ({
    url:
      "/" +
      relative("src/app", file)
        .replace(/\/route\.ts$/, "")
        .replace(/\(([^)]+)\)\//g, ""),
    handlers: handlersIn(readFileSync(file, "utf8")),
  }))
  .filter((r) => r.handlers.length > 0);

if (process.argv.includes("--markdown")) {
  console.log("| Endpoint | Methods |");
  console.log("| --- | --- |");
  for (const route of routes) {
    const cells = route.handlers.map((h) => `\`${h.method}\` ${h.roles}`).join("<br>");
    console.log(`| \`${route.url}\` | ${cells} |`);
  }
} else {
  const handlerCount = routes.reduce((sum, r) => sum + r.handlers.length, 0);
  console.log(`${routes.length} routes, ${handlerCount} handlers\n`);
  for (const route of routes) {
    console.log(`${route.url}`);
    for (const h of route.handlers) console.log(`    ${h.method.padEnd(7)} ${h.roles}`);
  }
}
