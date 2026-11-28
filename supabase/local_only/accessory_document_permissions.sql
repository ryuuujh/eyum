-- Run manually in an isolated local Supabase database only, after migration 11.
begin;
do $$
begin
  if current_database() !~ '^heyum_verify_[0-9a-f]{16}$'
    and current_setting('heyum.local_accessory_permissions', true) is distinct from 'on' then
    raise exception 'Local development database opt-in required';
  end if;
end;
$$;

-- The local publishable-key role gets only the document projections, not the tables.
alter view public.accessory_document_options set (security_invoker=false);
create view public.accessory_document_status with (security_barrier=true) as
select s.entity_type,s.entity_id,s.field_key,s.status,s.wait_reason,s.note
from public.field_status s
where (s.entity_type='accessory' and s.field_key in ('item_name','item_name_en') and exists (
  select 1 from public.accessory_document_options d where d.accessory_id=s.entity_id
)) or (s.entity_type='accessory_option' and s.field_key in (
  'option_name','management_code','hs6','hsk10','material','origin','unit_weight_g','units_per_ctn',
  'ctn_net_kg','ctn_gross_kg','ctn_l_cm','ctn_w_cm','ctn_h_cm','unit_price','currency'
) and exists (select 1 from public.accessory_document_options d where d.option_id=s.entity_id));

revoke all on public.accessory_document_status from public, anon, authenticated, service_role;
grant select on public.accessory_document_options, public.accessory_document_status to anon;
alter function public.set_accessory_export_selected(uuid,boolean) security definer;
grant execute on function public.set_accessory_export_selected(uuid,boolean) to anon;
commit;
