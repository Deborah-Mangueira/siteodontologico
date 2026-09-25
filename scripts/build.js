import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('app', 'dist/app', { recursive: true });
await cp('site', 'dist/site', { recursive: true });
console.log('Site e painel preparados em dist/. APIs são publicadas pela Vercel.');
