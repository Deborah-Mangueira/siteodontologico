import { endpoint, method, requireConfig, requireOrigin, requireAdmin, rate, body, equal, sessionCookie, json } from '../server/http.js';
import { HttpError } from '../server/domain.js';
export default endpoint(async (req, res) => {
  method(req,res,['GET','POST','DELETE']); requireConfig();
  if (req.method === 'GET') { requireAdmin(req); return json(res, { authenticated: true }); }
  requireOrigin(req);
  if (req.method === 'POST') {
    await rate(req,'login',10);
    const input = await body(req);
    if (typeof input?.password !== 'string' || !equal(input.password, process.env.ADMIN_PASSWORD)) throw new HttpError(401,'Senha incorreta.');
  }
  res.setHeader('Set-Cookie', sessionCookie(req.method === 'DELETE'));
  json(res, { authenticated: req.method === 'POST' });
});
