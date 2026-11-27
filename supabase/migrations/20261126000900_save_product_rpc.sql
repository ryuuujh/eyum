-- 제품 저장 함수 (Claude). 화면 저장 한 번 = 이 함수 한 번 = 트랜잭션 하나.
-- 중간에 하나라도 실패하면 전부 취소된다. payload 모양은 src/lib/products/form.ts 의 SaveRows.
-- 마이그레이션 순서: 5(product_export) 다음, GPT의 6 · 7과 겹치지 않음.

create or replace function save_product(payload jsonb)
returns uuid
language plpgsql
as $$
declare
  pid uuid := (payload->'product'->>'id')::uuid;
  comp_ids uuid[];
begin
  -- 1. 제품
  insert into products
  select * from jsonb_populate_record(null::products,
    jsonb_build_object('export_selected', false) || (payload->'product') || jsonb_build_object('created_at', now(), 'updated_at', now()))
  on conflict (id) do update set
    code = excluded.code, name_ko = excluded.name_ko, name_en = excluded.name_en,
    net_content_value = excluded.net_content_value, net_content_unit = excluded.net_content_unit,
    net_content_note = excluded.net_content_note, serving_desc = excluded.serving_desc,
    servings_per_pack = excluded.servings_per_pack, storage_condition = excluded.storage_condition,
    date_type = excluded.date_type, date_period = excluded.date_period, manufacturer_name = excluded.manufacturer_name, finished_country = excluded.finished_country,
    gtin = excluded.gtin, halal = excluded.halal, storage_text = excluded.storage_text, cooking_en = excluded.cooking_en,
    caution_en = excluded.caution_en, claims = excluded.claims,
    pack_w_mm = excluded.pack_w_mm, pack_d_mm = excluded.pack_d_mm, pack_h_mm = excluded.pack_h_mm,
    label_w_mm = excluded.label_w_mm, label_h_mm = excluded.label_h_mm,
    outer_label_w_mm = excluded.outer_label_w_mm, outer_label_h_mm = excluded.outer_label_h_mm, status = excluded.status;

  -- 2. 구성품 (다른 제품과 같이 쓰는 구성품이면 그 제품에도 반영됨)
  insert into components
  select * from jsonb_populate_recordset(null::components,
    (select coalesce(jsonb_agg(c || jsonb_build_object('created_at', now(), 'updated_at', now())), '[]') from jsonb_array_elements(payload->'components') c))
  on conflict (id) do update set
    name = excluded.name, manufacturer_name = excluded.manufacturer_name, manufacturer_public = excluded.manufacturer_public,
    report_no = excluded.report_no, food_type_kr = excluded.food_type_kr, animal_ingredient = excluded.animal_ingredient,
    animal_ingredient_detail = excluded.animal_ingredient_detail, cross_contact = excluded.cross_contact,
    nutrition_basis = excluded.nutrition_basis, unit_weight_g = excluded.unit_weight_g, nutrition_source = excluded.nutrition_source;
  select coalesce(array_agg((c->>'id')::uuid), '{}') into comp_ids from jsonb_array_elements(payload->'components') c;

  -- 3. 제품 ↔ 구성품
  delete from product_components where product_id = pid;
  insert into product_components select * from jsonb_populate_recordset(null::product_components, payload->'links');

  -- 4. 원재료 (부모가 먼저 오도록 화면에서 정렬해 보냄) · 영양성분
  delete from component_ingredients where component_id = any(comp_ids);
  insert into component_ingredients select * from jsonb_populate_recordset(null::component_ingredients, coalesce(payload->'ingredients', '[]'));
  insert into component_nutrition select * from jsonb_populate_recordset(null::component_nutrition, coalesce(payload->'nutrition', '[]'))
  on conflict (component_id) do update set
    kcal = excluded.kcal, sodium_mg = excluded.sodium_mg, carb_g = excluded.carb_g, sugar_g = excluded.sugar_g,
    fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g, trans_fat_g = excluded.trans_fat_g,
    cholesterol_mg = excluded.cholesterol_mg, protein_g = excluded.protein_g, fiber_g = excluded.fiber_g;

  -- 5. 포장 부위
  delete from product_packaging_parts where product_id = pid;
  insert into product_packaging_parts
  select * from jsonb_populate_recordset(null::product_packaging_parts,
    (select coalesce(jsonb_agg(x || jsonb_build_object('product_id', pid)), '[]') from jsonb_array_elements(coalesce(payload->'packaging', '[]')) x));

  -- 5-1. 기존 라벨 문구
  delete from product_label_texts where product_id = pid;
  insert into product_label_texts
  select * from jsonb_populate_recordset(null::product_label_texts,
    (select coalesce(jsonb_agg(x || jsonb_build_object('product_id', pid)), '[]') from jsonb_array_elements(coalesce(payload->'labelTexts', '[]')) x));

  -- 6. 수출 · 물류
  if jsonb_typeof(payload->'exportInfo') = 'object' then
    insert into product_export
    select * from jsonb_populate_record(null::product_export, (payload->'exportInfo') || jsonb_build_object('product_id', pid, 'updated_at', now()))
    on conflict (product_id) do update set
      unit_price = excluded.unit_price, currency = excluded.currency, units_per_ctn = excluded.units_per_ctn,
      ctn_net_kg = excluded.ctn_net_kg, ctn_gross_kg = excluded.ctn_gross_kg,
      ctn_l_cm = excluded.ctn_l_cm, ctn_w_cm = excluded.ctn_w_cm, ctn_h_cm = excluded.ctn_h_cm,
      unit_gross_g = excluded.unit_gross_g, pallet_l_cm = excluded.pallet_l_cm, pallet_w_cm = excluded.pallet_w_cm,
      pallet_layers = excluded.pallet_layers, pallet_ctn_count = excluded.pallet_ctn_count,
      -- HS 검토(hs_classifications)로 확정된 코드는 덮지 않음. 손으로 바꾼 HS6와 안 맞는 HSK10은 비움
      hs6 = case when product_export.hs_classification_id is null then excluded.hs6 else product_export.hs6 end,
      hsk10 = case when product_export.hs_classification_id is null and left(product_export.hsk10, 6) is distinct from excluded.hs6
                   then null else product_export.hsk10 end;
  end if;

  -- 7. 칸 상태
  insert into field_status (entity_type, entity_id, field_key, status, wait_reason, wait_who, requested_at, note, source_doc_id, updated_by)
  select entity_type, entity_id, field_key, status, wait_reason, wait_who, requested_at, note, source_doc_id, updated_by
  from jsonb_populate_recordset(null::field_status, coalesce(payload->'statuses', '[]'))
  on conflict (entity_type, entity_id, field_key) do update set
    status = excluded.status, wait_reason = excluded.wait_reason, wait_who = excluded.wait_who,
    requested_at = excluded.requested_at, note = excluded.note, source_doc_id = excluded.source_doc_id,
    updated_by = excluded.updated_by, updated_at = now();

  return pid;
end;
$$;
