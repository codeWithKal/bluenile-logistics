import { createClient } from '@supabase/supabase-js';
import { query } from './db.ts';

export interface TableMigrationResult {
  table: string;
  sqliteRows: number;
  migratedRows: number;
  success: boolean;
  error?: string;
}

export async function runSupabaseMigration(): Promise<{
  success: boolean;
  results: TableMigrationResult[];
  summary: string;
}> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment credentials (SUPABASE_URL, SUPABASE_KEY) are missing.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const migrationTables = [
    { name: 'users', conflict: 'id' },
    { name: 'trucks', conflict: 'id' },
    { name: 'construction_companies', conflict: 'id' },
    { name: 'locations', conflict: 'id' },
    { name: 'projects', conflict: 'id' },
    { name: 'route_tariffs', conflict: 'id' },
    { name: 'trips', conflict: 'id' },
    { name: 'trip_status_history', conflict: 'id' },
    { name: 'audit_logs', conflict: 'id' },
  ];

  const results: TableMigrationResult[] = [];
  let allSuccessful = true;

  for (const { name, conflict } of migrationTables) {
    let rows: any[] = [];
    try {
      rows = query(`SELECT * FROM ${name}`);
    } catch (e: any) {
      results.push({
        table: name,
        sqliteRows: 0,
        migratedRows: 0,
        success: false,
        error: `SQLite read error: ${e.message}`,
      });
      allSuccessful = false;
      continue;
    }

    if (!rows || rows.length === 0) {
      results.push({
        table: name,
        sqliteRows: 0,
        migratedRows: 0,
        success: true,
      });
      continue;
    }

    // Normalize rows for Supabase PostgreSQL
    const sanitizedRows = rows.map((r) => {
      const sanitized: any = { ...r };

      if ('is_active' in sanitized) {
        sanitized.is_active = Boolean(sanitized.is_active);
      }
      if ('capacity_warning_acknowledged' in sanitized) {
        sanitized.capacity_warning_acknowledged = Number(sanitized.capacity_warning_acknowledged) || 0;
      }
      if (name === 'projects' && !sanitized.location_address && sanitized.address) {
        sanitized.location_address = sanitized.address;
      }

      return sanitized;
    });

    const chunkSize = 50;
    let migratedCount = 0;
    let tableError: string | undefined;

    for (let i = 0; i < sanitizedRows.length; i += chunkSize) {
      const chunk = sanitizedRows.slice(i, i + chunkSize);
      const { error } = await supabase.from(name).upsert(chunk, { onConflict: conflict });

      if (error) {
        tableError = error.message;
        break;
      } else {
        migratedCount += chunk.length;
      }
    }

    const tableSuccess = migratedCount === rows.length;
    if (!tableSuccess) allSuccessful = false;

    results.push({
      table: name,
      sqliteRows: rows.length,
      migratedRows: migratedCount,
      success: tableSuccess,
      error: tableError,
    });
  }

  const successCount = results.filter((r) => r.success).length;
  const summary = `${successCount}/${results.length} tables fully synchronized with Supabase PostgreSQL.`;

  return {
    success: allSuccessful,
    results,
    summary,
  };
}
