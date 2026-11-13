-- Private durable sessions for the Vercel adapter. No game-state access through
-- tables, and no service-role key is required by the runtime.
create schema parallaxe_web;
revoke all on schema parallaxe_web from public, anon, authenticated;

create table parallaxe_web.runtime_credentials (
  id boolean primary key default true check (id),
  token_hash bytea not null check (octet_length(token_hash) = 32)
);
create table parallaxe_web.sessions (
  code text primary key check (code ~ '^[A-Z2-9]{6}$'),
  version bigint not null check (version >= 0 and version <= 9007199254740991),
  data text not null check (octet_length(data) <= 1048576),
  updated_at bigint not null,
  expires_at bigint not null check (expires_at > updated_at and expires_at <= updated_at + 43200000)
);
create index parallaxe_sessions_expiry_idx on parallaxe_web.sessions (expires_at);
alter table parallaxe_web.runtime_credentials enable row level security;
alter table parallaxe_web.sessions enable row level security;
revoke all on all tables in schema parallaxe_web from public, anon, authenticated;

create function parallaxe_web.assert_runtime(p_store_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_store_token is null or length(p_store_token) <> 64 or not exists (
    select 1 from parallaxe_web.runtime_credentials
    where id and token_hash = extensions.digest(p_store_token, 'sha256')
  ) then
    raise exception using errcode = '42501', message = 'Session store access denied';
  end if;
end;
$$;
revoke all on function parallaxe_web.assert_runtime(text) from public, anon, authenticated;

create function public.parallaxe_web_read(p_store_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform parallaxe_web.assert_runtime(p_store_token);
  select to_jsonb(s) into result from parallaxe_web.sessions s
  where s.code = p_code and s.expires_at > floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  return result;
end;
$$;

create function public.parallaxe_web_insert(p_store_token text, p_code text, p_version bigint, p_data text, p_updated_at bigint, p_expires_at bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer; server_now bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  perform parallaxe_web.assert_runtime(p_store_token);
  if p_version is distinct from 0 or p_updated_at is null or p_expires_at is null or
     p_expires_at <= server_now or p_updated_at > server_now + 5000 or
     p_expires_at > server_now + 43205000 then
    raise exception using errcode = '22023', message = 'Invalid session lifetime or revision';
  end if;
  if p_data is null or octet_length(p_data) > 1048576 then
    raise exception using errcode = '22023', message = 'Invalid session payload size';
  end if;
  perform p_data::jsonb;
  delete from parallaxe_web.sessions where code in (
    select code from parallaxe_web.sessions where expires_at <= server_now order by expires_at limit 25
  );
  insert into parallaxe_web.sessions(code, version, data, updated_at, expires_at)
  values (p_code, p_version, p_data, p_updated_at, p_expires_at)
  on conflict (code) do nothing;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create function public.parallaxe_web_cas(p_store_token text, p_code text, p_version bigint, p_data text, p_updated_at bigint, p_expires_at bigint, p_expected_version bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer; server_now bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  perform parallaxe_web.assert_runtime(p_store_token);
  if p_expected_version is null or p_version is distinct from p_expected_version + 1 or
     p_updated_at is null or p_expires_at is null or p_expires_at <= server_now or
     p_updated_at > server_now + 5000 or p_expires_at > server_now + 43205000 then
    raise exception using errcode = '22023', message = 'Invalid session lifetime or revision';
  end if;
  if p_data is null or octet_length(p_data) > 1048576 then
    raise exception using errcode = '22023', message = 'Invalid session payload size';
  end if;
  perform p_data::jsonb;
  update parallaxe_web.sessions set version = p_version, data = p_data,
    updated_at = p_updated_at, expires_at = p_expires_at
  where code = p_code and version = p_expected_version and expires_at > server_now;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.parallaxe_web_read(text, text) from public, anon, authenticated;
revoke all on function public.parallaxe_web_insert(text, text, bigint, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.parallaxe_web_cas(text, text, bigint, text, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.parallaxe_web_read(text, text) to anon;
grant execute on function public.parallaxe_web_insert(text, text, bigint, text, bigint, bigint) to anon;
grant execute on function public.parallaxe_web_cas(text, text, bigint, text, bigint, bigint, bigint) to anon;
notify pgrst, 'reload schema';
