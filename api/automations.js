import { endpoint, requireAdmin, requireOrigin, method, json, body } from '../server/http.js';
import { getStore } from '../server/store.js';
import { dispatch } from '../server/automation.js';
export default endpoint(async (req,res) => {
  method(req,res,['GET','POST']); requireAdmin(req);
  const store = await getStore();
  if (req.method === 'GET') return json(res,{ configured: Boolean(process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET), events: await store.rpc('queue') });
  requireOrigin(req);
  const input = await body(req);
  if (input?.retry === true) await store.rpc('retry');
  json(res, await dispatch(store));
});
