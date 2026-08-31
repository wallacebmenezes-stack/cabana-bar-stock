import { createClient } from '@supabase/supabase-js';

// Coloque sua URL e sua Chave Anon aqui
const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://irogbxinxxtnrkmhvqec.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_BsqnbspKeBiVgO0h7wQH8g_AX1WjNtE';

// Remove automaticamente /rest/v1 ou barras / do final caso existam na URL
const cleanUrl = RAW_URL
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');

export const supabase = createClient(cleanUrl, ANON_KEY);