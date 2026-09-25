export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const statuses = ['novo', 'em_contato', 'agendado', 'cancelado'];
export const transitions = {
  novo: ['em_contato', 'cancelado'],
  em_contato: ['agendado', 'cancelado'],
  agendado: ['cancelado'], cancelado: []
};
export function validateLead(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Dados inválidos.');
  const clean = (key, max) => {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!value || value.length > max) throw new HttpError(400, `Verifique o campo ${key}.`);
    return value;
  };
  if (input.website) throw new HttpError(400, 'Não foi possível enviar.');
  const name = clean('name', 100);
  if (name.length < 2) throw new HttpError(400, 'Informe um nome com pelo menos 2 caracteres.');
  const phone = clean('phone', 25).replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(phone)) throw new HttpError(400, 'Informe telefone com DDD (10 ou 11 dígitos).');
  const date = clean('preferred_date', 10);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
  const parsed = new Date(date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== date || date < today || +parsed > +now + 90 * 86400000 || parsed.getUTCDay() === 0) {
    throw new HttpError(400, 'Escolha uma data entre hoje e 90 dias, de segunda a sábado.');
  }
  const period = clean('period', 10);
  if (!['manha', 'tarde'].includes(period) || (parsed.getUTCDay() === 6 && period === 'tarde')) throw new HttpError(400, 'Sábado tem atendimento apenas pela manhã.');
  if (input.consent !== true) throw new HttpError(400, 'Confirme a autorização de uso dos dados.');
  return { name, phone, preferred_date: date, period, consent: true };
}
