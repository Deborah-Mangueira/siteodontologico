import { endpoint, method, json } from '../server/http.js';
import { getStore } from '../server/store.js';
export default endpoint(async (req,res) => {
  method(req,res,['GET']); await (await getStore()).rpc('health');
  json(res,{ ok:true, database: 'connected', automation: Boolean(process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET) ? 'configured' : 'not_configured' });
});
