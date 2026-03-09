import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'db.yskhuojnrrmsmxodkamc.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'qmBj@6y4g6hQSE4@aHxq3T',
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('Connected to Supabase Postgres');
  await client.query("ALTER TABLE listings ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb");
  console.log('SUCCESS: photos column added');
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'listings' ORDER BY ordinal_position");
  console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
  await client.end();
} catch(e) {
  console.error('Error:', e.message);
  process.exit(1);
}
