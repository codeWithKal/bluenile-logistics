import { initDb } from '../server/db.ts';
import { runSupabaseMigration } from '../server/supabaseMigration.ts';

async function main() {
  console.log('--- Starting SQLite to Supabase Migration ---');
  await initDb();
  const report = await runSupabaseMigration();

  for (const r of report.results) {
    if (r.success) {
      console.log(`[${r.table}] Successfully migrated ${r.migratedRows}/${r.sqliteRows} rows.`);
    } else {
      console.error(`[${r.table}] FAILED (${r.migratedRows}/${r.sqliteRows} rows migrated). Reason: ${r.error}`);
    }
  }

  console.log('Summary:', report.summary);
  if (!report.success) {
    console.log('\nTip: If any table failed on foreign key constraint, run /supabase/fix_foreign_keys.sql in Supabase SQL editor.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  });
