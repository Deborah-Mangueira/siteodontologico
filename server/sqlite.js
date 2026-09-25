import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError, transitions } from './domain.js';
export class SQLiteStore {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, request_key TEXT UNIQUE, fingerprint TEXT, data TEXT);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, lead_id TEXT, data TEXT);
      CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, data TEXT, attempts INTEGER DEFAULT 0, delivered INTEGER DEFAULT 0, next_at INTEGER DEFAULT 0, lease_until INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER, expires INTEGER);`);
  }
  event(lead, type) {
    const event = { id: randomUUID(), lead_id: lead.id, type, status: lead.status, created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO events VALUES (?,?,?)').run(event.id, lead.id, JSON.stringify(event));
    this.db.prepare('INSERT INTO outbox (id,data) VALUES (?,?)').run(event.id, JSON.stringify(event));
  }
  async rpc(action, p = {}) {
    const db = this.db;
    if (action === 'health') return { ok: true };
    if (action === 'rate') {
      const now = Date.now();
      db.prepare('DELETE FROM limits WHERE expires < ?').run(now);
      const row = db.prepare('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(p.key, now + p.window_ms);
      return row.count <= p.limit;
    }
    if (action === 'list') return db.prepare('SELECT data FROM leads ORDER BY rowid DESC LIMIT 100 OFFSET ?').all(p.offset || 0).map(r => JSON.parse(r.data));
    if (action === 'events') return db.prepare('SELECT data FROM events WHERE lead_id=? ORDER BY rowid').all(p.id).map(r => JSON.parse(r.data));
    if (action === 'queue') return db.prepare('SELECT id, attempts, delivered, next_at FROM outbox ORDER BY rowid DESC LIMIT 100').all();
    if (action === 'claim') {
      const row = db.prepare('UPDATE outbox SET lease_until=?, attempts=attempts+1 WHERE id=(SELECT id FROM outbox WHERE delivered=0 AND next_at<=? AND lease_until<=? AND attempts<5 ORDER BY rowid LIMIT 1) RETURNING *').get(Date.now()+60000,Date.now(),Date.now());
      return row ? { ...JSON.parse(row.data), attempts: row.attempts } : null;
    }
    if (action === 'finish') {
      db.prepare('UPDATE outbox SET delivered=?, next_at=?, lease_until=0 WHERE id=?').run(p.ok ? 1 : 0, Date.now() + 60000 * 2 ** p.attempts, p.id);
      return { ok: true };
    }
    if (action === 'retry') {
      db.prepare('UPDATE outbox SET attempts=0,next_at=0 WHERE delivered=0 AND lease_until<=?').run(Date.now());
      return { ok: true };
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      let lead;
      if (action === 'create') {
        const existing = db.prepare('SELECT * FROM leads WHERE request_key=?').get(p.key);
        if (existing) {
          if (existing.fingerprint !== p.fingerprint) throw new HttpError(409, 'Chave de envio já utilizada com outros dados.');
          lead = JSON.parse(existing.data);
        } else {
          lead = { ...p.lead, id: randomUUID(), status: 'novo', version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          db.prepare('INSERT INTO leads VALUES (?,?,?,?)').run(lead.id,p.key,p.fingerprint,JSON.stringify(lead));
          this.event(lead, 'solicitacao.criada');
        }
      } else if (action === 'update') {
        const row = db.prepare('SELECT data FROM leads WHERE id=?').get(p.id);
        if (!row) throw new HttpError(404, 'Solicitação não encontrada.');
        lead = JSON.parse(row.data);
        if (lead.version !== p.version) throw new HttpError(409, 'Registro alterado. Atualize o painel antes de continuar.');
        if (!transitions[lead.status].includes(p.status)) throw new HttpError(409, 'Mudança de status não permitida.');
        lead = { ...lead, status: p.status, version: lead.version + 1, updated_at: new Date().toISOString() };
        db.prepare('UPDATE leads SET data=? WHERE id=?').run(JSON.stringify(lead),p.id);
        this.event(lead, 'solicitacao.atualizada');
      } else throw new Error('Unknown action');
      db.exec('COMMIT'); return lead;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
