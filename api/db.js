const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.POSTGRES_URL);

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      user_uuid UUID NOT NULL,
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_uuid, team_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usage (
      user_uuid UUID NOT NULL,
      month TEXT NOT NULL,
      aiu NUMERIC(14, 4),
      input_tokens BIGINT,
      output_tokens BIGINT,
      budget NUMERIC(14, 4),
      script_version TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_uuid, month)
    )
  `;
}

module.exports = { sql, ensureSchema };
