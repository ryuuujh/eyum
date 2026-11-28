begin;

create function public.accessory_option_review_input(p_option uuid)
returns jsonb language sql stable set search_path = pg_catalog, public as $$
  select jsonb_build_object('name',a.item_name,'material',o.material,'purpose',o.intended_use,'attributes',o.attributes)
  from public.accessory_options o join public.accessories a on a.id=o.accessory_id where o.id=p_option;
$$;

create or replace function public.confirm_hs_classification(
  p_classification_id uuid, p_hs6 text, p_hsk10 text, p_confirmed_by text, p_human_reason text
)
returns public.hs_classifications
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  review public.hs_classifications%rowtype;
  entity text;
  checked_on date := (statement_timestamp() at time zone 'Asia/Seoul')::date;
begin
  perform 1 from public.accessories a join public.accessory_options o on o.accessory_id=a.id
    join public.hs_classifications c on c.item_type='accessory' and c.item_id=o.id
    where c.id=p_classification_id for update of a;
  select * into strict review from public.hs_classifications
    where id = p_classification_id for update;

  if review.status not in ('candidates_generated', 'in_review') then
    raise exception 'Create a new review to confirm again';
  end if;
  if review.item_type='accessory' and review.input_snapshot->'option' is not null
    and review.input_snapshot->'option' is distinct from public.accessory_option_review_input(review.item_id) then
    raise exception 'Option details changed. Search again';
  end if;
  if p_hs6 is null or p_hs6 !~ '^[0-9]{6}$'
    or (p_hsk10 is not null and (p_hsk10 !~ '^[0-9]{10}$' or left(p_hsk10, 6) <> p_hs6))
    or nullif(btrim(p_confirmed_by), '') is null
    or nullif(btrim(p_human_reason), '') is null then
    raise exception 'Invalid codes or missing reviewer/reason';
  end if;

  perform 1 from public.hs_data_versions where id = review.hs_data_version_id and is_active for share;
  if not found then raise exception 'The official dataset changed. Start a new review'; end if;
  if not exists (select 1 from public.official_hs6 where version_id = review.hs_data_version_id and hs6 = p_hs6)
    or (p_hsk10 is not null and not exists (
      select 1 from public.hsk_codes where version_id = review.hs_data_version_id and code = p_hsk10
    )) then
    raise exception 'Code not found in the official dataset';
  end if;

  if review.item_type = 'food' then
    entity := 'product';
    perform 1 from public.products where id = review.item_id for update;
    if not found then raise exception 'Product not found'; end if;
    insert into public.product_export (product_id, hs6, hsk10, hs_checked_at, hs_confirmed_by, hs_classification_id)
      values (review.item_id, p_hs6, p_hsk10, checked_on, btrim(p_confirmed_by), review.id)
      on conflict (product_id) do update set hs6 = excluded.hs6, hsk10 = excluded.hsk10,
        hs_checked_at = excluded.hs_checked_at, hs_confirmed_by = excluded.hs_confirmed_by,
        hs_classification_id = excluded.hs_classification_id;
  else
    entity := 'accessory_option';
    update public.accessory_options
      set hs6 = p_hs6, hsk10 = p_hsk10, hs_checked_at = checked_on,
        hs_confirmed_by = btrim(p_confirmed_by), hs_classification_id = review.id
      where id = review.item_id and archived_at is null and exists (
        select 1 from public.accessories a where a.id=accessory_id and a.status<>'archived'
      );
    if not found then raise exception 'Accessory missing or archived'; end if;
  end if;

  update public.hs_classifications
    set status = 'confirmed', chosen_hs6 = p_hs6, chosen_hsk10 = p_hsk10,
      confirmed_by = btrim(p_confirmed_by), human_reason = btrim(p_human_reason), confirmed_at = clock_timestamp()
    where id = review.id returning * into review;

  insert into public.field_status (entity_type, entity_id, field_key, status, note, updated_at, updated_by)
    values
      (entity, review.item_id, 'hs6', 'confirmed', null, now(), review.confirmed_by),
      (entity, review.item_id, 'hsk10', case when p_hsk10 is null then 'missing' else 'confirmed' end,
        case when p_hsk10 is null then '6자리만 확정' end, now(), review.confirmed_by)
    on conflict (entity_type, entity_id, field_key) do update set status = excluded.status, note = excluded.note,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by,
      wait_reason = null, wait_who = null, requested_at = null, source_doc_id = null;
  return review;
end;
$$;

create or replace function public.mark_hs_classification_for_review(
  p_classification_id uuid, p_reason text, p_hsk10_affected boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  review public.hs_classifications%rowtype;
  current_id uuid;
  current_hsk10 text;
  entity text;
begin
  perform 1 from public.accessories a join public.accessory_options o on o.accessory_id=a.id
    join public.hs_classifications c on c.item_type='accessory' and c.item_id=o.id
    where c.id=p_classification_id for update of a;
  select * into strict review from public.hs_classifications
    where id = p_classification_id for update;
  if review.status not in ('confirmed', 'needs_review')
    or nullif(btrim(p_reason), '') is null or p_hsk10_affected is null then
    raise exception 'Confirmed review and a reason are required';
  end if;

  if review.item_type = 'food' then
    entity := 'product';
    perform 1 from public.products where id = review.item_id for update;
    select hs_classification_id, hsk10 into current_id, current_hsk10
      from public.product_export where product_id = review.item_id for update;
  else
    entity := 'accessory_option';
    select hs_classification_id, hsk10 into current_id, current_hsk10
      from public.accessory_options where id = review.item_id for update;
  end if;

  update public.hs_classifications set status = 'needs_review',
    review_reason = btrim(p_reason), review_requested_at = now() where id = review.id;

  if current_id is distinct from review.id then return false; end if;
  insert into public.field_status (entity_type, entity_id, field_key, status, note, updated_at)
    select entity, review.item_id, field.key, field.status, field.note, now()
    from (values
      ('hs6', 'needs_check', btrim(p_reason), true),
      ('hsk10', case when current_hsk10 is null then 'missing' else 'needs_check' end,
        case when current_hsk10 is null then '6자리만 확정' else btrim(p_reason) end,
        p_hsk10_affected or current_hsk10 is null)
    ) as field(key, status, note, affected)
    where field.affected
    on conflict (entity_type, entity_id, field_key) do update set
      status = excluded.status, note = excluded.note, updated_at = excluded.updated_at, updated_by = null;
  return true;
end;
$$;

revoke all on function public.confirm_hs_classification(uuid,text,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.mark_hs_classification_for_review(uuid,text,boolean) from public, anon, authenticated, service_role;

create function public.invalidate_accessory_confirmation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare review_id uuid;
begin
  if tg_table_name='accessories' then
    if old.item_name is distinct from new.item_name then
      for review_id in select hs_classification_id from public.accessory_options
        where accessory_id=new.id and hs_classification_id is not null order by id
      loop
        perform public.mark_hs_classification_for_review(review_id,'Accessory name changed');
      end loop;
    end if;
  elsif (old.material,old.intended_use,old.attributes) is distinct from (new.material,new.intended_use,new.attributes)
    and new.hs_classification_id is not null then
    perform public.mark_hs_classification_for_review(new.hs_classification_id,'Classification attributes changed');
  end if;
  return new;
end;
$$;
create trigger accessories_recheck_name after update of item_name on public.accessories
  for each row execute function public.invalidate_accessory_confirmation();
create trigger accessory_options_recheck_attributes after update of material,intended_use,attributes on public.accessory_options
  for each row execute function public.invalidate_accessory_confirmation();
revoke all on function public.accessory_option_review_input(uuid), public.invalidate_accessory_confirmation()
  from public, anon, authenticated, service_role;

commit;
