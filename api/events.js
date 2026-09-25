import { endpoint, requireAdmin, method, json } from '../server/http.js';
import { getStore } from '../server/store.js';
import { HttpError } from '../server/domain.js';
export default endpoint(async (req,res) => {
  method(req,res,['GET']); requireAdmin(req);
  const id = new URL(req.url,'http://localhost').searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400,'Protocolo inválido.');
  json(res,{ events: await (await getStore()).rpc('events',{id}) });
});
