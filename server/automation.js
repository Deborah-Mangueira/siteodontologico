import { getStore } from './store.js';
export async function dispatch(store, fetcher = fetch) {
  if (!process.env.N8N_WEBHOOK_URL || !process.env.N8N_WEBHOOK_SECRET) return { configured: false, processed: 0 };
  const url = new URL(process.env.N8N_WEBHOOK_URL);
  if (url.protocol !== 'https:') throw new Error('Webhook requires HTTPS');
  const event = await store.rpc('claim');
  if (!event) return { configured: true, processed: 0 };
  let ok = false;
  try {
    const response = await fetcher(url, {
      method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET, 'Idempotency-Key': event.id },
      body: JSON.stringify({ event_id: event.id, lead_id: event.lead_id, type: event.type, status: event.status, created_at: event.created_at }),
      signal: AbortSignal.timeout(5000)
    });
    ok = response.ok;
  } catch { /* Keep the durable event pending. */ }
  await store.rpc('finish', { id: event.id, attempts: event.attempts, ok });
  return { configured: true, processed: 1, delivered: ok };
}
export async function tryDispatch() {
  try { return await dispatch(await getStore()); }
  catch { return { configured: true, processed: 0, pending: true }; }
}
