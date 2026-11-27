begin;

create table public.accessories (
  id uuid primary key default gen_random_uuid(),
  item_name text not null check (btrim(item_name) <> ''),
  item_name_en text,
  description text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  status_before_archive text check (status_before_archive in ('draft','active')),
  created_at timestamptz not null default now()
);
revoke all on public.accessories from public, anon, authenticated, service_role;
create table public.accessory_options (
  id uuid primary key default gen_random_uuid(),
  accessory_id uuid not null references public.accessories(id),
  option_name text,
  management_code text not null default ('ACC-' || gen_random_uuid()::text)
    check (management_code <> '' and management_code = btrim(management_code)),
  is_default boolean not null default false,
  archived_at timestamptz,
  material text,
  intended_use text,
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object'),
  hs6 text check (hs6 ~ '^[0-9]{6}$'),
  hsk10 text check (hsk10 is null or (hsk10 ~ '^[0-9]{10}$' and hs6 is not null and left(hsk10,6) = hs6)),
  hs_checked_at date,
  hs_confirmed_by text,
  hs_classification_id uuid references public.hs_classifications(id),
  created_at timestamptz not null default now(),
  check (archived_at is null or not is_default)
);
create unique index accessory_options_default on public.accessory_options(accessory_id) where is_default;
create unique index accessory_options_management_code on public.accessory_options(lower(management_code));
create index accessory_options_parent on public.accessory_options(accessory_id);
revoke all on public.accessory_options from public, anon, authenticated, service_role;

create function public.create_accessory_default_option()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  insert into public.accessory_options(accessory_id,is_default) values (new.id,true);
  return new;
end;
$$;
create trigger accessories_default_option after insert on public.accessories
  for each row execute function public.create_accessory_default_option();

create function public.change_accessory_archive(p_item uuid, p_option uuid, p_restore boolean, p_replacement uuid default null)
returns void language plpgsql set search_path = pg_catalog, public as $$
declare
  parent public.accessories;
  target public.accessory_options;
  remaining uuid[];
begin
  select * into strict parent from public.accessories where id=p_item for update;
  if p_option is null then
    if p_restore then
      update public.accessories set status=coalesce(status_before_archive,'active'), status_before_archive=null
        where id=p_item and status='archived';
    else
      update public.accessories set status_before_archive=status, status='archived'
        where id=p_item and status<>'archived';
    end if;
    return;
  end if;
  if parent.status='archived' then raise exception 'Restore the accessory before editing its options'; end if;
  select * into strict target from public.accessory_options where id=p_option and accessory_id=p_item for update;
  if p_restore then
    update public.accessory_options set archived_at=null where id=p_option;
    return;
  end if;
  if target.archived_at is not null then return; end if;
  select array(select id from public.accessory_options where accessory_id=p_item and id<>p_option and archived_at is null)
    into remaining;
  if cardinality(remaining)=0 then raise exception 'Archive the accessory to archive its last active option'; end if;
  if target.is_default then
    if cardinality(remaining)=1 then p_replacement := remaining[1]; end if;
    if p_replacement is null or not (p_replacement=any(remaining)) then raise exception 'Select an active replacement default'; end if;
  end if;
  update public.accessory_options set archived_at=now(),is_default=false where id=p_option;
  if target.is_default then update public.accessory_options set is_default=true where id=p_replacement; end if;
end;
$$;
revoke all on function public.create_accessory_default_option(), public.change_accessory_archive(uuid,uuid,boolean,uuid)
  from public, anon, authenticated, service_role;


create trigger accessories_delete_status after delete on public.accessories
  for each row execute function public.delete_field_status('accessory');
create trigger accessory_options_delete_status after delete on public.accessory_options
  for each row execute function public.delete_field_status('accessory_option');

commit;
