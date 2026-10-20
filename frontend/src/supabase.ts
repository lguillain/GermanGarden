import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (Boolean(url) !== Boolean(key))
  throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
export const supabase =
  url && key ? createClient(url, key, { auth: { detectSessionInUrl: false } }) : null;
export const cloudApiUrl = url ? `${url.replace(/\/$/, '')}/functions/v1/garden` : '';
export const publishableKey = key || '';
