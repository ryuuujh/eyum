begin;
alter table public.accessory_options
  add column export_selected boolean not null default false,
  add column origin text,
  add column unit_weight_g numeric check (unit_weight_g > 0),
  add column units_per_ctn integer check (units_per_ctn > 0),
  add column ctn_net_kg numeric check (ctn_net_kg > 0),
  add column ctn_gross_kg numeric check (ctn_gross_kg > 0),
  add column ctn_l_cm numeric check (ctn_l_cm > 0),
  add column ctn_w_cm numeric check (ctn_w_cm > 0),
  add column ctn_h_cm numeric check (ctn_h_cm > 0),
  add check (archived_at is null or not export_selected),
  add check (ctn_gross_kg >= ctn_net_kg);

create function public.clear_accessory_export_selection()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_table_name = 'accessories' then
    if new.status = 'archived' then
      update public.accessory_options set export_selected = false
      where accessory_id = new.id and export_selected;
    end if;
  elsif new.archived_at is not null then
    new.export_selected := false;
  end if;
  return new;
end;
$$;

create trigger accessories_clear_export_selection
  after update of status on public.accessories
  for each row execute function public.clear_accessory_export_selection();
create trigger accessory_options_clear_export_selection
  before update of archived_at on public.accessory_options
  for each row execute function public.clear_accessory_export_selection();

create function public.set_accessory_export_selected(p_option_id uuid,p_selected boolean)
returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
declare parent_status text;
begin
  select a.status into strict parent_status from public.accessories a
    join public.accessory_options o on o.accessory_id=a.id
    where o.id=p_option_id for update of a;
  if parent_status='archived' then raise exception 'Archived accessory' using errcode='23514'; end if;
  update public.accessory_options set export_selected=p_selected
    where id=p_option_id and archived_at is null;
  if not found then raise exception 'Archived option' using errcode='23514'; end if;
  return p_selected;
end;
$$;

create view public.accessory_document_options with (security_invoker=true) as
select o.id as option_id,a.id as accessory_id,o.export_selected,
  a.item_name,a.item_name_en,o.option_name,o.management_code,o.hs6,o.hsk10,o.material,
  o.origin,o.unit_weight_g,o.units_per_ctn,o.ctn_net_kg,o.ctn_gross_kg,o.ctn_l_cm,o.ctn_w_cm,o.ctn_h_cm
from public.accessory_options o
join public.accessories a on a.id=o.accessory_id
where o.archived_at is null and a.status <> 'archived';

revoke all on public.accessory_document_options from public, anon, authenticated, service_role;
revoke all on function public.set_accessory_export_selected(uuid,boolean), public.clear_accessory_export_selection()
  from public, anon, authenticated, service_role;
commit;
