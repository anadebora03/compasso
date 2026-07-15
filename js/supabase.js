/* ============================================================
   COMPASSO · Supabase — cliente e teste de conexão
   Sprint Supabase 1 — apenas preparação de infraestrutura.
   Nenhuma tabela, login ou cadastro é criado aqui.
   Carregado via CDN (sem build step) — projeto continua estático.
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export let supabase = null;

try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('[Supabase] erro ao criar o cliente:', e);
}

/* Verifica apenas se o cliente foi inicializado corretamente — não faz nenhuma chamada de rede. */
export function testarConexaoSupabase() {
  const ok = !!(supabase && supabase.auth && supabase.from);
  if (ok) console.log('[Supabase] cliente inicializado com sucesso.');
  else console.error('[Supabase] cliente não foi inicializado corretamente.');
  return ok;
}

testarConexaoSupabase();

/* Libera o app.js (script clássico) para prosseguir, com o cliente pronto (ou null, se falhou). */
if (window.__resolveSupabaseReady) window.__resolveSupabaseReady(supabase);
else window.__supabaseReady = Promise.resolve(supabase);
