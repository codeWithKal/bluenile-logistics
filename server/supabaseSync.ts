import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  : null;

export const SUPABASE_TABLES = [
  'users',
  'trucks',
  'construction_companies',
  'locations',
  'projects',
  'route_tariffs',
  'trips',
  'trip_status_history',
  'audit_logs',
] as const;

export type SupabaseTableName = typeof SUPABASE_TABLES[number];

/**
 * Fetch all rows for a table from Supabase PostgreSQL in pages of 1000
 */
export async function fetchAllFromSupabase(tableName: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + step - 1);

      if (error) {
        console.warn(`[Supabase PostgreSQL] Error fetching ${tableName}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < step) break;
      from += step;
    }
    return allRows;
  } catch (err: any) {
    console.warn(`[Supabase PostgreSQL] Exception fetching ${tableName}:`, err.message || err);
    return [];
  }
}

/**
 * Direct real-time write-through to Supabase PostgreSQL
 */
export async function syncInsert(table: SupabaseTableName | string, record: any): Promise<void> {
  if (!supabase) return;
  try {
    const sanitized = sanitizeForSupabase(record);
    const { error } = await supabase.from(table).insert(sanitized);
    if (error) {
      console.error(`[Supabase PostgreSQL] INSERT ${table} error:`, error.message);
    }
  } catch (err: any) {
    console.error(`[Supabase PostgreSQL] INSERT ${table} exception:`, err.message || err);
  }
}

export async function syncUpsert(table: SupabaseTableName | string, record: any, onConflict = 'id'): Promise<void> {
  if (!supabase) return;
  try {
    const sanitized = sanitizeForSupabase(record);
    const { error } = await supabase.from(table).upsert(sanitized, { onConflict });
    if (error) {
      console.error(`[Supabase PostgreSQL] UPSERT ${table} error:`, error.message);
    }
  } catch (err: any) {
    console.error(`[Supabase PostgreSQL] UPSERT ${table} exception:`, err.message || err);
  }
}

export async function syncUpdate(table: SupabaseTableName | string, updates: any, matchColumn: string, matchValue: any): Promise<void> {
  if (!supabase) return;
  try {
    const sanitized = sanitizeForSupabase(updates);
    const { error } = await supabase.from(table).update(sanitized).eq(matchColumn, matchValue);
    if (error) {
      console.error(`[Supabase PostgreSQL] UPDATE ${table} error:`, error.message);
    }
  } catch (err: any) {
    console.error(`[Supabase PostgreSQL] UPDATE ${table} exception:`, err.message || err);
  }
}

export async function syncDelete(table: SupabaseTableName | string, matchColumn: string, matchValue: any): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from(table).delete().eq(matchColumn, matchValue);
    if (error) {
      console.error(`[Supabase PostgreSQL] DELETE ${table} error:`, error.message);
    }
  } catch (err: any) {
    console.error(`[Supabase PostgreSQL] DELETE ${table} exception:`, err.message || err);
  }
}

export async function syncDeleteIn(table: SupabaseTableName | string, matchColumn: string, matchValues: any[]): Promise<void> {
  if (!supabase || matchValues.length === 0) return;
  try {
    const { error } = await supabase.from(table).delete().in(matchColumn, matchValues);
    if (error) {
      console.error(`[Supabase PostgreSQL] DELETE IN ${table} error:`, error.message);
    }
  } catch (err: any) {
    console.error(`[Supabase PostgreSQL] DELETE IN ${table} exception:`, err.message || err);
  }
}

function sanitizeForSupabase(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  if ('is_active' in clone && typeof clone.is_active === 'number') {
    clone.is_active = Boolean(clone.is_active);
  }
  if ('capacity_warning_acknowledged' in clone) {
    clone.capacity_warning_acknowledged = Number(clone.capacity_warning_acknowledged) || 0;
  }
  return clone;
}
