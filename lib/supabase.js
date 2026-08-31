import { createClient } from '@supabase/supabase-js';

// Cole os dados do seu projeto Supabase direto entre as aspas:
const SUPABASE_URL = 'https://irogbxinxxtnrkmhvqec.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_BsqnbspKeBiVgO0h7wQH8g_AX1WjNtE';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY
);