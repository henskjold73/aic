/**
 * Stand-in for `@neondatabase/serverless`, backed by an in-memory PGlite
 * database. The real api/ code (including db.ts) runs unmodified on top of it.
 *
 * Mimics the parts of Neon's driver the app uses: `neon()` returning a tagged
 * template function that is also callable as `sql(strings, ...params)`, plus
 * `sql.transaction([...])`. Parameters are sent as text and BIGINT comes back
 * as a string, like Neon's HTTP driver.
 */
const { PGlite } = require("@electric-sql/pglite");

const db = new PGlite();

const textParams = (params) => params.map((v) => (typeof v === "number" ? String(v) : v));

function build(strings, params) {
  const text = strings.reduce((acc, s, i) => acc + s + (i < params.length ? `$${i + 1}` : ""), "");
  return { text, params: textParams(params) };
}

function fixRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === "bigint" ? v.toString() : v;
  return out;
}

async function exec({ text, params }) {
  const result = await db.query(text, params);
  return result.rows.map(fixRow);
}

function neon() {
  function sql(strings, ...params) {
    const q = build(strings, params);
    return { q, then: (resolve, reject) => exec(q).then(resolve, reject) };
  }
  sql.transaction = async (queries) => {
    const out = [];
    await db.exec("BEGIN");
    try {
      for (const item of queries) out.push(await exec(item.q));
      await db.exec("COMMIT");
    } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
    }
    return out;
  };
  return sql;
}

module.exports = { neon, db };
