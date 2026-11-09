/**
 * Local-only test harness. Never deployed (it lives outside api/ and src/).
 *
 *   cd dev && npm install && npm start
 *
 * - bundles every api/ handler with esbuild, swapping the Neon driver for an
 *   in-memory PGlite database (see neon-shim.cjs) — the real handler code runs
 * - seeds the database in the OLD schema (before accounts existed), so the
 *   first request exercises the real migration and shadow-account backfill
 * - serves the built frontend (../dist) with the SPA fallback Vercel applies
 * - adds a dev-only login at /dev/login?as=<name> instead of GitHub OAuth
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const apiDir = path.join(root, "api");
const buildDir = path.join(here, ".build");
const require = createRequire(import.meta.url);
const PORT = Number(process.env.PORT ?? 3000);

process.env.DATABASE_URL = "postgres://local:local@localhost/local";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "local-dev-secret-local-dev-secret-0123456789";
process.env.GITHUB_CLIENT_ID = "local-dev"; // /api/me/login would redirect to GitHub; use /dev/login instead

// ── 1. bundle the API ─────────────────────────────────────────────

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const allFiles = walk(apiDir).filter((f) => f.endsWith(".ts"));
const routeFiles = allFiles.filter((f) => {
  const base = path.basename(f);
  return !base.startsWith("_") && base !== "db.ts" && base !== "http.ts" && base !== "tsconfig.json";
});

fs.rmSync(buildDir, { recursive: true, force: true });
await build({
  entryPoints: [...routeFiles, path.join(apiDir, "_auth.ts")],
  outdir: path.join(buildDir, "api"),
  outbase: apiDir,
  bundle: true,
  platform: "node",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  logLevel: "error",
  plugins: [
    {
      name: "neon-shim",
      setup(b) {
        b.onResolve({ filter: /^@neondatabase\/serverless$/ }, () => ({
          path: path.join(here, "neon-shim.cjs"),
          external: true,
        }));
      },
    },
  ],
});

// Same module instance as the one the bundles require, so we can seed it.
const { db } = require("./neon-shim.cjs");
const auth = require(path.join(buildDir, "api", "_auth.cjs"));

// ── 2. routes ─────────────────────────────────────────────────────

const routes = routeFiles.map((f) => {
  const rel = path.relative(apiDir, f).replace(/\.ts$/, "");
  const segs = rel.split(path.sep);
  if (segs[segs.length - 1] === "index") segs.pop();
  return {
    segs: segs.map((s) => (s.startsWith("[") ? { param: s.slice(1, -1) } : { lit: s })),
    file: path.join(buildDir, "api", `${rel}.cjs`),
  };
});

function matchRoute(pathname) {
  const parts = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  for (const r of routes) {
    if (r.segs.length !== parts.length) continue;
    const params = {};
    let ok = true;
    r.segs.forEach((s, i) => {
      if (s.lit !== undefined) ok = ok && s.lit === parts[i];
      else params[s.param] = decodeURIComponent(parts[i]);
    });
    if (ok) return { file: r.file, params };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      if ((req.headers["content-type"] ?? "").includes("json")) {
        try {
          return resolve(JSON.parse(raw));
        } catch {
          return resolve(raw);
        }
      }
      resolve(raw);
    });
  });
}

function decorate(res) {
  res.status = (n) => {
    res.statusCode = n;
    return res;
  };
  res.json = (obj) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    res.end(typeof body === "string" ? body : JSON.stringify(body));
    return res;
  };
  res.redirect = (a, b) => {
    const [code, url] = typeof a === "number" ? [a, b] : [302, a];
    res.statusCode = code;
    res.setHeader("Location", url);
    res.end();
    return res;
  };
  return res;
}

// ── 3. seed: the database as it looked BEFORE accounts existed ────

await db.exec(`
CREATE TABLE teams (id UUID PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE team_members (user_uuid UUID NOT NULL, team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE, display_name TEXT NOT NULL, joined_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (user_uuid, team_id));
CREATE TABLE usage (user_uuid UUID NOT NULL, month TEXT NOT NULL, aiu NUMERIC(14,4), input_tokens BIGINT, output_tokens BIGINT, budget NUMERIC(14,4), script_version TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (user_uuid, month));
CREATE TABLE sync_meta (user_uuid UUID PRIMARY KEY, script_version TEXT NOT NULL, last_ping_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE usage_daily (user_uuid UUID NOT NULL, date DATE NOT NULL, aiu NUMERIC(14,4), input_tokens BIGINT, output_tokens BIGINT, project TEXT, synced_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (user_uuid, date));
`);

export const SEED = {
  alice: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  bob: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
  team: "cccccccc-3333-4333-8333-cccccccccccc",
};
const month = new Date().toISOString().slice(0, 7);
await db.exec(`
INSERT INTO teams (id, name) VALUES ('${SEED.team}', 'Crew');
INSERT INTO team_members (user_uuid, team_id, display_name) VALUES ('${SEED.alice}','${SEED.team}','Alice'), ('${SEED.bob}','${SEED.team}','Bob');
INSERT INTO usage (user_uuid, month, aiu, input_tokens, output_tokens, budget, script_version) VALUES
  ('${SEED.alice}','${month}',120,5000,900,500,'1.4.1'), ('${SEED.bob}','${month}',80,3000,500,400,'1.4.1');
INSERT INTO sync_meta (user_uuid, script_version) VALUES ('${SEED.alice}','1.4.1'), ('${SEED.bob}','1.4.1');
INSERT INTO usage_daily (user_uuid, date, aiu, input_tokens, output_tokens)
  SELECT '${SEED.alice}', CURRENT_DATE - g, 10 + g, 100, 20 FROM generate_series(0, 3) g;
INSERT INTO usage_daily (user_uuid, date, aiu, input_tokens, output_tokens)
  SELECT '${SEED.bob}', CURRENT_DATE - g, 7 + g, 100, 20 FROM generate_series(0, 3) g;
`);

// ── 4. frontend ───────────────────────────────────────────────────

console.log("building frontend…");
execSync("npx vite build", { cwd: root, stdio: "ignore" });
const dist = path.join(root, "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

function serveStatic(res, pathname) {
  const file = path.join(dist, pathname);
  const target = file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, "index.html");
  res.setHeader("Content-Type", MIME[path.extname(target)] ?? "application/octet-stream");
  res.end(fs.readFileSync(target));
}

// ── 5. server ─────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  decorate(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/dev/login") {
      // Dev-only stand-in for GitHub: signs you in as a fake GitHub account.
      const name = url.searchParams.get("as") ?? "dev";
      const ghId = 9_000_000 + [...name].reduce((a, c) => a + c.charCodeAt(0) * 31, 0);
      await fetch(`http://127.0.0.1:${PORT}/api/me/session`); // make sure the schema/migration has run
      const rows = (
        await db.query(
          `INSERT INTO accounts (id, github_id, display_name) VALUES (gen_random_uuid(), $1, $2)
           ON CONFLICT (github_id) DO UPDATE SET display_name = accounts.display_name RETURNING id`,
          [String(ghId), name],
        )
      ).rows;
      auth.startSession(req, res, rows[0].id);
      return res.redirect(302, url.searchParams.get("next") ?? "/");
    }

    if (url.pathname.startsWith("/api/")) {
      const match = matchRoute(url.pathname);
      if (!match) return res.status(404).json({ error: "no such route" });
      req.query = { ...Object.fromEntries(url.searchParams), ...match.params };
      req.body = await readBody(req);
      const handler = require(match.file).default;
      return await handler(req, res);
    }

    serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: String(err?.message ?? err) });
  }
});

server.listen(PORT, async () => {
  console.log(`\nlocal harness on http://localhost:${PORT}`);
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${PORT}/api/me/session`);
  } catch (err) {
    console.error("first request failed:", err);
    return;
  }
  console.log("first request ran the migration:", r.status, await r.text());
  const q = async (s) => (await db.query(s)).rows;
  console.log("accounts:", (await q("SELECT shadow, count(*) n FROM accounts GROUP BY shadow")).map((x) => `${x.shadow ? "shadow" : "real"}=${x.n}`).join(" "));
  console.log("team_members with account_id:", (await q("SELECT count(*) n FROM team_members WHERE account_id IS NOT NULL"))[0].n);
  console.log(`\nSign in as a fake GitHub user:  http://localhost:${PORT}/dev/login?as=alice`);
  console.log(`Seeded legacy keys (paste at /auto):  alice ${SEED.alice}\n                                       bob   ${SEED.bob}`);
  console.log(`Seeded team:  http://localhost:${PORT}/team/${SEED.team}`);
});
