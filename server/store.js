import { HttpError } from './domain.js';
let store;
export async function getStore() {
  if (store) return store;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    store = new SupabaseStore();
  } else if (!process.env.VERCEL && process.env.STORAGE_DRIVER === 'sqlite') {
    const { SQLiteStore } = await import('./sqlite.js');
    store = new SQLiteStore(process.env.SQLITE_PATH || 'work/atendimento.sqlite');
  } else throw new HttpError(503, 'Backend aguardando configuração do banco de dados. Nenhuma solicitação foi salva.');
  return store;
}
export class SupabaseStore {
  async rpc(action, payload = {}) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = { 'Content-Type': 'application/json', apikey: key };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/clinic_action`, {
      method: 'POST', headers, body: JSON.stringify({ action, payload }), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new HttpError(503, 'Banco de dados indisponível. Tente novamente.');
    const result = await response.json();
    if (result?.error) throw new HttpError(result.status || 409, result.error);
    return result;
  }
}
