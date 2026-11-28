begin;
create table public.hs_classifications (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('food', 'accessory')),
  item_id uuid not null,
  status text not null default 'candidates_generated'
    check (status in ('candidates_generated','in_review','confirmed','needs_review')),
  candidates jsonb not null default '[]' check (jsonb_typeof(candidates) = 'array'),
  chosen_hs6 text check (chosen_hs6 ~ '^[0-9]{6}$'),
  chosen_hsk10 text check (chosen_hsk10 is null or (chosen_hsk10 ~ '^[0-9]{10}$' and chosen_hs6 is not null and left(chosen_hsk10, 6) = chosen_hs6)),
  ai_rationale text,
  human_reason text,
  hs_data_version_id uuid not null references public.hs_data_versions(id),
  confirmed_by text,
  confirmed_at timestamptz,
  review_reason text,
  review_requested_at timestamptz,
  input_snapshot jsonb not null default '{}',
  evidence jsonb not null default '[]',
  verification_level text,
  ai_model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  foreign key (hs_data_version_id, chosen_hsk10) references public.hsk_codes(version_id, code),
  check ((status in ('confirmed','needs_review')) = (confirmed_at is not null)),
  check (confirmed_at is null or (chosen_hs6 is not null and confirmed_by is not null and human_reason is not null))
);
create function public.enforce_official_review_hs6()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.chosen_hs6 is not null and not exists (
    select 1 from public.official_hs6
    where version_id = new.hs_data_version_id and hs6 = new.chosen_hs6
  ) then
    raise exception 'HS6 not found in the official dataset' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_official_review_hs6() from public, anon, authenticated;
create trigger hs_classifications_validate_hs6
  before insert or update of chosen_hs6, hs_data_version_id on public.hs_classifications
  for each row execute function public.enforce_official_review_hs6();

create index hs_classifications_item_history on public.hs_classifications(item_type, item_id, created_at desc);
revoke all on public.hs_classifications from public, anon, authenticated;
commit;

