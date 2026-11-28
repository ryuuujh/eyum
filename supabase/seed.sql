-- 로컬 DB 초기화용 가상 제품. DB 미연결 화면의 src/features/products/sample.ts와 같은 값이다.
-- 공통 DB에는 검토한 마이그레이션만 적용한다.

insert into products (id, code, name_ko, net_content_value, net_content_unit, net_content_note,
  serving_desc, servings_per_pack, storage_condition, finished_country, export_selected, created_at, updated_at)
values ('f1000000-0000-4000-8000-000000000001', 'demo-pumpkin-soup', '테스트 단호박 수프 키트', 180, 'g', '가상 포장에 표시된 중량',
  '수프 한 그릇', 1, '냉장', '캐나다', true, '2026-11-28T00:00:00Z', '2026-11-28T00:00:00Z');

insert into components (id, name, manufacturer_name, manufacturer_public, food_type_kr,
  animal_ingredient, nutrition_basis, nutrition_source) values
  ('f2000000-0000-4000-8000-000000000001', '단호박 퓌레', '실습용 가상 제조소', true, '채소가공품', '없음', '100g', '가상 영양표 A'),
  ('f2000000-0000-4000-8000-000000000002', '귀리 크런치', null, null, null, '미확인', '100g', '가상 영양표 B'),
  ('f2000000-0000-4000-8000-000000000003', '코코넛 크림', null, null, null, '없음', '100mL', '가상 영양표 C');

insert into product_components (product_id, component_id, amount, unit, quantity, sort_order) values
  ('f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 125, 'g', 1, 1),
  ('f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002', 22, 'g', 1, 2),
  ('f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000003', 30, 'mL', 1, 3);

insert into component_ingredients (id, component_id, seq, name, name_en, origin, allergens) values
  ('f3000000-0000-4000-8001-000000000001', 'f2000000-0000-4000-8000-000000000001', 1, '단호박', 'Pumpkin', '캐나다산', '{}'),
  ('f3000000-0000-4000-8001-000000000002', 'f2000000-0000-4000-8000-000000000001', 2, '당근', 'Carrot', '벨기에산', '{}'),
  ('f3000000-0000-4000-8002-000000000001', 'f2000000-0000-4000-8000-000000000002', 1, '귀리 플레이크', 'Oat flakes', '핀란드산', '{}'),
  ('f3000000-0000-4000-8002-000000000002', 'f2000000-0000-4000-8000-000000000002', 2, '아몬드 조각', 'Almond pieces', '호주산', '{아몬드}'),
  ('f3000000-0000-4000-8003-000000000001', 'f2000000-0000-4000-8000-000000000003', 1, '코코넛', 'Coconut', '스리랑카산', '{}'),
  ('f3000000-0000-4000-8003-000000000002', 'f2000000-0000-4000-8000-000000000003', 2, '물', 'Water', '캐나다산', '{}');

insert into component_nutrition (component_id, kcal, sodium_mg, carb_g, sugar_g, fat_g, sat_fat_g, protein_g) values
  ('f2000000-0000-4000-8000-000000000001', 52, 24, 10.5, 3.8, 0.6, 0.15, 1.1),
  ('f2000000-0000-4000-8000-000000000002', 384, 48, 58, 5.6, 12.4, 1.8, 10.1),
  ('f2000000-0000-4000-8000-000000000003', 164, 19, 3.2, 1.4, 16.3, 12.7, 1.2);

insert into product_label_texts (id, product_id, language, pack_level, item_key, text, source, sort_order) values
  ('f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', '영어', 'unit', 'product_name', 'Demo Pumpkin Soup Kit', '실습용 가상 포장 문안', 1),
  ('f4000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', '영어', 'unit', 'net_weight', 'Net weight per kit: 180 g.', '실습용 가상 포장 문안', 2),
  ('f4000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', '영어', 'unit', 'ingredients', 'Pumpkin puree (pumpkin, carrot), oat crunch (oat flakes, almond pieces), coconut cream (coconut, water). Contains almonds.', '실습용 가상 포장 문안', 3),
  ('f4000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', '영어', 'unit', 'storage', 'Keep the unopened kit refrigerated.', '실습용 가상 포장 문안', 4),
  ('f4000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', '영어', 'unit', 'origin', 'Made in Canada.', '실습용 가상 포장 문안', 5);

insert into field_status (id, entity_type, entity_id, field_key, status, wait_reason, wait_who, requested_at, note, updated_at) values
  ('f5000000-0000-4000-8000-000000000001', 'product', 'f1000000-0000-4000-8000-000000000001', 'finished_country', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000002', 'product', 'f1000000-0000-4000-8000-000000000001', 'storage_condition', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000003', 'product', 'f1000000-0000-4000-8000-000000000001', 'net_content_value', 'needs_check', null, null, null, '가상 라벨의 표시 중량을 구성품 실측값과 대조하는 예시', '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000004', 'product', 'f1000000-0000-4000-8000-000000000001', 'name_en', 'missing', 'undecided', '실습용 라벨 담당', '2026-11-28', '가상 라벨의 영문 상품명은 초안', '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000005', 'component', 'f2000000-0000-4000-8000-000000000001', 'food_type_kr', 'needs_check', null, null, null, '가상 제품 분류 검토 예시', '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000006', 'component', 'f2000000-0000-4000-8000-000000000001', 'animal_ingredient', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000007', 'component', 'f2000000-0000-4000-8000-000000000001', 'ingredients', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000008', 'component', 'f2000000-0000-4000-8000-000000000001', 'nutrition_source', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000009', 'component', 'f2000000-0000-4000-8000-000000000002', 'ingredients', 'needs_check', null, null, null, '가상 크런치의 원재료 순서 재확인', '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000010', 'component', 'f2000000-0000-4000-8000-000000000002', 'animal_ingredient', 'missing', 'asking_supplier', '실습용 구성품 담당', '2026-11-28', null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000011', 'component', 'f2000000-0000-4000-8000-000000000002', 'nutrition_source', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000012', 'component', 'f2000000-0000-4000-8000-000000000003', 'ingredients', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000013', 'component', 'f2000000-0000-4000-8000-000000000003', 'animal_ingredient', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000014', 'component', 'f2000000-0000-4000-8000-000000000003', 'unit_weight_g', 'missing', null, null, null, '한 포 실측 전에는 100g당 영양값을 보류', '2026-11-28T00:00:00Z'),
  ('f5000000-0000-4000-8000-000000000015', 'component', 'f2000000-0000-4000-8000-000000000003', 'nutrition_source', 'needs_check', null, null, null, '가상 크림의 표시 기준 재확인', '2026-11-28T00:00:00Z');
