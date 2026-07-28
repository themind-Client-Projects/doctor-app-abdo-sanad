/**
 * Fails the build if any API route handler is not wrapped in `withAuth`.
 *
 *   npm run check:auth
 *
 * All 68 routes were once publicly callable — including patient medical
 * records. This guard is what stops that from silently coming back: a new
 * route.ts is unguarded by default, and this check turns that into a build
 * failure rather than a breach.
 */
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "src", "app", "api");

/**
 * Routes that are legitimately public — each one IS part of the sign-in
 * surface, so requiring a session would make sign-in impossible.
 *
 * Listed individually rather than by prefix: `api/auth/**` would have silently
 * exempted any future route dropped into that folder.
 */
const PUBLIC_ROUTES = [
  path.join("api", "auth", "[...nextauth]"), // NextAuth's own handler
  path.join("api", "auth", "otp", "send"), // request an OTP (rate limited)
  path.join("api", "auth", "token", "route"), // credentials -> bearer pair
  path.join("api", "auth", "token", "refresh"), // rotate an expired pair
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full);
  }
  return out;
}

function isPublic(file: string): boolean {
  const rel = path.relative(process.cwd(), file);
  return PUBLIC_ROUTES.some((p) => rel.includes(p));
}

type Problem = { file: string; message: string };

function checkFile(file: string): Problem[] {
  const rel = path.relative(process.cwd(), file);
  const src = fs.readFileSync(file, "utf8");
  const problems: Problem[] = [];

  // A bare `export async function GET(...)` cannot be wrapped, by definition.
  for (const method of HTTP_METHODS) {
    const bare = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    if (bare.test(src)) {
      problems.push({
        file: rel,
        message: `${method} is declared as a bare function — wrap it with withAuth() from @/lib/api-auth`,
      });
    }
  }

  // `export const GET = ...` must be assigned from withAuth(...)
  for (const method of HTTP_METHODS) {
    const assigned = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*([\\s\\S]{0,40})`);
    const match = src.match(assigned);
    if (match && !match[1].includes("withAuth")) {
      problems.push({
        file: rel,
        message: `${method} is exported but not wrapped in withAuth()`,
      });
    }
  }

  const exportsAnyMethod = HTTP_METHODS.some((m) =>
    new RegExp(`export\\s+(const|async\\s+function|function)\\s+${m}\\b`).test(src)
  );
  if (exportsAnyMethod && !src.includes("@/lib/api-auth")) {
    problems.push({ file: rel, message: "does not import from @/lib/api-auth" });
  }

  return problems;
}

function main() {
  if (!fs.existsSync(API_DIR)) {
    console.error(`No API directory at ${API_DIR}`);
    process.exit(1);
  }

  const files = walk(API_DIR);
  const guarded: string[] = [];
  const skipped: string[] = [];
  const problems: Problem[] = [];

  for (const file of files) {
    if (isPublic(file)) {
      skipped.push(path.relative(process.cwd(), file));
      continue;
    }
    const found = checkFile(file);
    if (found.length) problems.push(...found);
    else guarded.push(path.relative(process.cwd(), file));
  }

  console.log(`Checked ${files.length} route files`);
  console.log(`  guarded: ${guarded.length}`);
  console.log(`  public (allow-listed): ${skipped.length}`);

  if (problems.length) {
    console.error(`\n✖ ${problems.length} unguarded route handler(s):\n`);
    for (const p of problems) console.error(`  ${p.file}\n    → ${p.message}`);
    console.error(
      "\nEvery API route must be wrapped in withAuth() from @/lib/api-auth.\n" +
        "If a route is genuinely public, add it to PUBLIC_ROUTES in this script\n" +
        "with a comment explaining why.\n"
    );
    process.exit(1);
  }

  console.log("\n✓ All API routes are guarded.");
}

main();
