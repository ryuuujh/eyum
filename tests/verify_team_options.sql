-- Run only in an isolated database with the official catalog and team migrations.
begin;
do $$
declare
  item_id uuid;
  option_id uuid;
  empty_option uuid;
  fixture_product_id uuid := gen_random_uuid();
  version_id uuid;
  review_id uuid;
  second_option uuid;
begin
  select id into strict version_id from public.hs_data_versions where is_active;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='accessories'
    and column_name in ('hs6','hsk10','hs_checked_at','hs_confirmed_by','hs_classification_id')) then
    raise exception 'Parent has HS columns';
  end if;
  insert into public.accessories(item_name,status) values ('볼펜','active') returning id into item_id;
  select id into strict option_id from public.accessory_options where accessory_id=item_id and is_default;
  insert into public.accessory_options(accessory_id,option_name) values(item_id,'Fixture option') returning id into second_option;
  if exists(select 1 from public.accessory_document_options where export_selected) then
    raise exception 'Options should start unselected';
  end if;
  perform public.set_accessory_export_selected(second_option,true);
  if (select count(*) from public.accessory_document_options where export_selected)<>1 then
    raise exception 'Selection should affect only one option';
  end if;
  perform public.change_accessory_archive(item_id,second_option,false);
  begin
    perform public.set_accessory_export_selected(second_option,true);
    raise exception 'Archived option was selectable';
  exception when check_violation then null;
  end;
  perform public.change_accessory_archive(item_id,second_option,true);
  perform public.set_accessory_export_selected(option_id,true);
  perform public.change_accessory_archive(item_id,null,false);
  if exists(select 1 from public.accessory_options where accessory_id=item_id and export_selected) then
    raise exception 'Archiving parent did not clear selection';
  end if;
  perform public.change_accessory_archive(item_id,null,true);
  if exists(select 1 from public.accessory_document_options where export_selected) then
    raise exception 'Restoring must not reselect options';
  end if;
  if not exists(select 1 from public.search_hs_candidates('accessory','볼펜',true) where hsk10='9608100000')
    then raise exception 'Official candidate missing'; end if;
  insert into public.hs_classifications(item_type,item_id,hs_data_version_id,input_snapshot)
    values('accessory',option_id,version_id,jsonb_build_object('option',public.accessory_option_review_input(option_id)))
    returning id into review_id;
  perform public.confirm_hs_classification(review_id,'960810','9608100000','Fixture reviewer','Catalog verification');
  if not exists(select 1 from public.accessory_options where id=option_id and hsk10='9608100000')
    or not exists(select 1 from public.field_status where entity_id=option_id and entity_type='accessory_option'
      and field_key='hsk10' and status='confirmed') then raise exception 'Option confirmation failed'; end if;
  update public.accessories set item_name='포장된 볼펜' where id=item_id;
  if not exists(select 1 from public.hs_classifications where id=review_id and status='needs_review')
    or not exists(select 1 from public.accessory_options where id=option_id and hsk10='9608100000')
    then raise exception 'Recheck did not preserve HS code'; end if;
  insert into public.products(id,code,name_ko)
    values(fixture_product_id,'test-' || fixture_product_id::text,'시험용 식품');
  insert into public.hs_classifications(item_type,item_id,hs_data_version_id)
    values('food',fixture_product_id,version_id) returning id into review_id;
  perform public.confirm_hs_classification(review_id,'190230',null,'Fixture reviewer','Catalog verification');
  if not exists(select 1 from public.product_export p where p.product_id=fixture_product_id and p.hs6='190230')
    then raise exception 'Food confirmation failed'; end if;

  insert into public.accessories(item_name) values ('Disposable cleanup fixture') returning id into item_id;
  select id into strict empty_option from public.accessory_options where accessory_id=item_id and is_default;
  insert into public.field_status(entity_type,entity_id,field_key,status) values
    ('accessory',item_id,'item_name','confirmed'),('accessory_option',empty_option,'hs6','missing');
  delete from public.accessory_options where id=empty_option;
  if exists(select 1 from public.field_status where entity_type='accessory_option' and entity_id=empty_option)
    then raise exception 'Option cleanup failed'; end if;
  delete from public.accessories where id=item_id;
  if exists(select 1 from public.field_status where entity_type='accessory' and entity_id=item_id)
    then raise exception 'Parent cleanup failed'; end if;
end;
$$;
rollback;
