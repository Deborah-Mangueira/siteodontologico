import { endpoint, method, body, requireOrigin, requireAdmin, rate, hash, json } from '../server/http.js';
import { validateLead, HttpError, statuses } from '../server/domain.js';
import { getStore } from '../server/store.js';
import { tryDispatch } from '../server/automation.js';
export default endpoint(async (req, res) => {
  method(req, res, ['GET', 'POST', 'PATCH']);
  if (req.method === 'GET') {
    requireAdmin(req);
    const url = new URL(req.url, 'http://localhost');
    const offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new HttpError(400, 'Página inválida.');
    return json(res, { leads: await (await getStore()).rpc('list', { offset }) });
  }
  requireOrigin(req);
  if (req.method === 'PATCH') requireAdmin(req);
  await rate(req, req.method === 'POST' ? 'lead' : 'update', req.method === 'POST' ? 10 : 100);
  const input = await body(req);
  const store = await getStore();
  if (req.method === 'POST') {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(key)) throw new HttpError(400, 'Chave de envio inválida. Recarregue a página.');
    const lead = validateLead(input);
    const saved = await store.rpc('create', { key, lead, fingerprint: hash(JSON.stringify(lead)) });
    await tryDispatch();
    return json(res, { id: saved.id, status: saved.status, message: 'Solicitação salva. A data é uma preferência e depende da confirmação da equipe.' }, 201);
  }
  if (!input || typeof input.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) || !statuses.includes(input.status) || !Number.isInteger(input.version) || input.version < 1) throw new HttpError(400, 'Alteração inválida.');
  const saved = await store.rpc('update', input);
  await tryDispatch();
  return json(res, { lead: saved });
});
