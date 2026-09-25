import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './domain.js';
import { getStore } from './store.js';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const equal = (a, b) => timingSafeEqual(Buffer.from(hash(String(a))), Buffer.from(hash(String(b))));
export function requireConfig() {
  if ((process.env.ADMIN_PASSWORD || '').length < 16 || (process.env.SESSION_SECRET || '').length < 32 || !process.env.APP_ORIGIN) throw new HttpError(503, 'Configure o acesso administrativo no servidor.');
}
function signature(value) { return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex'); }
export function sessionCookie(logout = false) {
  const expiry = String(Date.now() + 8 * 3600000);
  const token = `${expiry}.${signature(expiry)}`;
  return `clinic_session=${logout ? '' : token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${logout ? 0 : 28800}${process.env.VERCEL || process.env.APP_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`;
}
export function requireAdmin(req) {
  requireConfig();
  const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('clinic_session='))?.slice(15) || '';
  const [expiry, sig] = cookie.split('.');
  if (!/^\d{13}$/.test(expiry || '') || Number(expiry) <= Date.now() || !sig || !equal(sig, signature(expiry))) throw new HttpError(401, 'Entre no painel para continuar.');
}
export function requireOrigin(req) {
  if (!process.env.APP_ORIGIN || req.headers.origin !== process.env.APP_ORIGIN.replace(/\/$/, '')) throw new HttpError(403, 'Origem não autorizada.');
}
export async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Envie JSON.');
  let value = req.body;
  if (value === undefined) {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 4096) throw new HttpError(413, 'Dados muito grandes.');
      chunks.push(chunk);
    }
    value = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value)) > 4096) throw new HttpError(413, 'Dados muito grandes.');
  try { return typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw new HttpError(400, 'JSON inválido.'); }
}
export async function rate(req, scope, limit) {
  const store = await getStore();
  // Vercel overwrites this header; locally trust only the actual socket peer.
  const ip = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] || 'unknown' : req.socket?.remoteAddress || 'local';
  const key = hash(`${process.env.SESSION_SECRET || ''}:${scope}:${ip}`);
  if (!await store.rpc('rate', { key, limit, window_ms: 900000 })) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');
}
export function endpoint(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try { await handler(req, res); }
    catch (error) {
      res.statusCode = error.status || 500;
      if (res.statusCode === 429) res.setHeader('Retry-After', '900');
      if (!error.status) console.error('API error:', error.name); // Never log payloads or credentials.
      res.end(JSON.stringify({ error: error.status ? error.message : 'Erro interno. Tente novamente.' }));
    }
  };
}
export function json(res, data, status = 200) { res.statusCode = status; res.end(JSON.stringify(data)); }
export function method(req, res, allowed) {
  if (!allowed.includes(req.method)) { res.setHeader('Allow', allowed.join(', ')); throw new HttpError(405, 'Método não permitido.'); }
}
