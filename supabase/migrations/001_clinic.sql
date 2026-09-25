-- Run once in the SQL Editor of a dedicated Supabase project.
begin;
create table public.clinic_leads (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  fingerprint text not null,
  name text not null check (length(name) between 2 and 100),
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  preferred_date date not null,
  period text not null check (period in ('manha','tarde')),
  consent boolean not null check (consent),
  status text not null default 'novo' check (status in ('novo','em_contato','agendado','cancelado')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clinic_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.clinic_leads(id) on delete cascade,
  type text not null,
  status text not null,
  created_at timestamptz not null default now()
);
create table public.clinic_outbox (
  id uuid primary key references public.clinic_events(id) on delete cascade,
  attempts integer not null default 0,
  delivered boolean not null default false,
  next_at timestamptz not null default now(),
  lease_until timestamptz not null default now()
);
create table public.clinic_limits (key text primary key, count integer not null, expires timestamptz not null);
create index on public.clinic_leads (created_at desc);
create index on public.clinic_events (lead_id, created_at);
create index on public.clinic_outbox (next_at) where delivered = false;
alter table public.clinic_leads enable row level security;
alter table public.clinic_events enable row level security;
alter table public.clinic_outbox enable row level security;
alter table public.clinic_limits enable row level security;
revoke all on public.clinic_leads, public.clinic_events, public.clinic_outbox, public.clinic_limits from anon, authenticated;

create function public.clinic_action(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.clinic_leads; e public.clinic_events; o public.clinic_outbox;
  result jsonb; n integer; allowed boolean;
begin
  if action = 'health' then return '{"ok":true}'::jsonb;
  elsif action = 'rate' then
    delete from public.clinic_limits where expires < now();
    insert into public.clinic_limits values (payload->>'key',1,now() + ((payload->>'window_ms')::integer * interval '1 millisecond'))
    on conflict (key) do update set count = clinic_limits.count + 1 returning count into n;
    return to_jsonb(n <= (payload->>'limit')::integer);
  elsif action = 'create' then
    -- Serialize matching idempotency keys, including simultaneous first requests.
    perform pg_advisory_xact_lock(hashtextextended(payload->>'key',0));
    select * into l from public.clinic_leads where request_key = payload->>'key';
    if found then
      if l.fingerprint <> payload->>'fingerprint' then return '{"error":"Chave de envio já utilizada com outros dados.","status":409}'::jsonb; end if;
      return to_jsonb(l) - 'fingerprint' - 'request_key';
    end if;
    insert into public.clinic_leads (request_key,fingerprint,name,phone,preferred_date,period,consent)
    values (payload->>'key',payload->>'fingerprint',payload->'lead'->>'name',payload->'lead'->>'phone',
      (payload->'lead'->>'preferred_date')::date,payload->'lead'->>'period',(payload->'lead'->>'consent')::boolean) returning * into l;
    insert into public.clinic_events (lead_id,type,status) values (l.id,'solicitacao.criada',l.status) returning * into e;
    insert into public.clinic_outbox (id) values (e.id);
    return to_jsonb(l) - 'fingerprint' - 'request_key';
  elsif action = 'update' then
    select * into l from public.clinic_leads where id = (payload->>'id')::uuid for update;
    if not found then return '{"error":"Solicitação não encontrada.","status":404}'::jsonb; end if;
    if l.version <> (payload->>'version')::integer then return '{"error":"Registro alterado. Atualize o painel.","status":409}'::jsonb; end if;
    allowed := (l.status='novo' and payload->>'status' in ('em_contato','cancelado'))
      or (l.status='em_contato' and payload->>'status' in ('agendado','cancelado'))
      or (l.status='agendado' and payload->>'status'='cancelado');
    if not allowed then return '{"error":"Mudança de status não permitida.","status":409}'::jsonb; end if;
    update public.clinic_leads set status=payload->>'status',version=version+1,updated_at=now() where id=l.id returning * into l;
    insert into public.clinic_events (lead_id,type,status) values (l.id,'solicitacao.atualizada',l.status) returning * into e;
    insert into public.clinic_outbox (id) values (e.id);
    return to_jsonb(l) - 'fingerprint' - 'request_key';
  elsif action = 'list' then
    select coalesce(jsonb_agg(to_jsonb(t) - 'fingerprint' - 'request_key'),'[]') into result
    from (select * from public.clinic_leads order by created_at desc, id limit 100 offset coalesce((payload->>'offset')::integer,0)) t;
    return result;
  elsif action = 'events' then
    select coalesce(jsonb_agg(to_jsonb(t) order by created_at),'[]') into result from public.clinic_events t where lead_id=(payload->>'id')::uuid;
    return result;
  elsif action = 'queue' then
    select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (select id,attempts,delivered,next_at from public.clinic_outbox order by next_at desc limit 100) t;
    return result;
  elsif action = 'claim' then
    select * into o from public.clinic_outbox where not delivered and next_at<=now() and lease_until<=now() and attempts<5 order by next_at for update skip locked limit 1;
    if not found then return 'null'::jsonb; end if;
    update public.clinic_outbox set lease_until=now()+interval '60 seconds',attempts=attempts+1 where id=o.id;
    select * into e from public.clinic_events where id=o.id;
    return to_jsonb(e) || jsonb_build_object('attempts',o.attempts+1);
  elsif action = 'finish' then
    update public.clinic_outbox set delivered=(payload->>'ok')::boolean,lease_until=now(),
      next_at=now()+((60000 * power(2,(payload->>'attempts')::integer)) * interval '1 millisecond') where id=(payload->>'id')::uuid;
    return '{"ok":true}'::jsonb;
  elsif action = 'retry' then
    update public.clinic_outbox set attempts=0,next_at=now() where not delivered and lease_until<=now();
    return '{"ok":true}'::jsonb;
  end if;
  raise exception 'Invalid action';
end;
$$;
revoke all on function public.clinic_action(text,jsonb) from public, anon, authenticated;
grant execute on function public.clinic_action(text,jsonb) to service_role;
commit;
