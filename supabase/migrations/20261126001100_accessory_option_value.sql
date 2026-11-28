begin;
alter table public.accessory_options
  add column unit_price numeric check (unit_price >= 0),
  add column currency text check (currency ~ '^[A-Z]{3}$');

create or replace view public.accessory_document_options with (security_invoker=true) as
select o.id as option_id,a.id as accessory_id,o.export_selected,
  a.item_name,a.item_name_en,o.option_name,o.management_code,o.hs6,o.hsk10,o.material,
  o.origin,o.unit_weight_g,o.units_per_ctn,o.ctn_net_kg,o.ctn_gross_kg,o.ctn_l_cm,o.ctn_w_cm,o.ctn_h_cm,
  o.unit_price,o.currency
from public.accessory_options o
join public.accessories a on a.id=o.accessory_id
where o.archived_at is null and a.status <> 'archived';
commit;
