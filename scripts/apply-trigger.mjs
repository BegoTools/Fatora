import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

async function applyTrigger() {
  const sqlPath = path.resolve(process.cwd(), 'supabase_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Connecting to Supabase database...');
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.xlbunuzlvnbzmfuhuuna',
    password: 'Ahmed2882008SAK@',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected! Executing updated SQL schema with signup trigger...');
    await client.query(sql);
    console.log('✅ Trigger and RLS policies created successfully!');
  } catch (err) {
    console.error('Error applying trigger:', err.message);
  } finally {
    await client.end();
  }
}

applyTrigger();
