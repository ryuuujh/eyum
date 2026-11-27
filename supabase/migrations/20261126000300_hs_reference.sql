begin;
create table public.hs_data_versions (
  id uuid primary key default gen_random_uuid(),
  hsk_sha256 text not null check (hsk_sha256 ~ '^[0-9a-f]{64}$'),
  standard_sha256 text not null check (standard_sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  is_active boolean not null default false,
  unique (hsk_sha256, standard_sha256),
  check (not is_active or (approved_at is not null and nullif(btrim(approved_by), '') is not null))
);
create unique index hs_data_one_active_version on public.hs_data_versions (is_active) where is_active;

create table public.hsk_codes (
  version_id uuid not null references public.hs_data_versions(id),
  code text not null check (code ~ '^[0-9]{2,10}$'),
  name_ko text not null,
  name_en text,
  primary key (version_id, code)
);

-- Official six-digit entries and prefixes proven by an official ten-digit entry.
create view public.official_hs6 as
  select version_id, left(code, 6) as hs6
  from public.hsk_codes
  where length(code) in (6, 10)
  group by version_id, left(code, 6);
revoke all on public.official_hs6 from public, anon, authenticated;

create table public.hs_standard_names (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  code text not null,
  name_ko text,
  name_en text,
  specification jsonb not null default '{}',
  foreign key (version_id, code) references public.hsk_codes(version_id, code)
);
create index hs_standard_names_version_code on public.hs_standard_names(version_id, code);
revoke all on public.hs_data_versions, public.hsk_codes, public.hs_standard_names from public, anon, authenticated;
commit;

