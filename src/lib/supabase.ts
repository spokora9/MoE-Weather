import { createClient } from '@supabase/supabase-js';
import { createLogger } from './logger.js';
const logger = createLogger('lib:supabase');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

export const supabase = url && anonKey
  ? createClient(url, anonKey)
  : null;

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export function isSupabaseConfigured(): boolean {
  return !!(url && anonKey);
}
