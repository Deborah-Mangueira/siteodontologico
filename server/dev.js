import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('.');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.svg':'image/svg+xml' };
const routes = Object.fromEntries(await Promise.all(['leads','session','events','automations','health'].map(async name => [`/api/${name}`, (await import(`../api/${name}.js`)).default])));
createServer(async (req,res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (routes[path]) return routes[path](req,res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let file;
  try {
    const decoded = decodeURIComponent(path);
    if (decoded === '/') file = 'index.html';
    else if (/^\/(app|site)\/[a-zA-Z0-9/_\-.]+$/.test(decoded) && !decoded.split('/').includes('..')) file = decoded.slice(1);
    else throw new Error('not public');
    if (file.endsWith('/')) file += 'index.html';
    const content = await readFile(resolve(root,file));
    res.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Não encontrado'); }
}).listen(Number(process.env.PORT || 3000),'127.0.0.1',() => console.log('Site: http://localhost:3000 | Painel: http://localhost:3000/app/admin.html'));
