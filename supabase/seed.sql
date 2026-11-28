-- 로컬 DB 초기화용 가상 제품. DB 미연결 화면의 src/features/products/sample.ts와 같은 값이다.
-- 공통 DB에는 검토한 마이그레이션만 적용한다.

insert into products (id, code, name_ko, name_en, net_content_value, net_content_unit, net_content_note,
  serving_desc, servings_per_pack, storage_condition, finished_country, export_selected, created_at, updated_at)
values ('d1000000-0000-4000-8000-000000000001', 'demo-tteokbokki', '테스트 떡볶이', 'Test Tteokbokki', 166, 'g', '떡·고명·소스 합계의 가상 포장 표시값',
  '떡볶이 1인분', 1, '냉동', '태국', true, '2026-11-28T00:00:00Z', '2026-11-28T00:00:00Z');

insert into components (id, name, manufacturer_name, manufacturer_public, food_type_kr,
  animal_ingredient, nutrition_basis, nutrition_source) values
  ('d2000000-0000-4000-8000-000000000001', '조랭이떡', '가상 떡 실습실', true, '떡류', '없음', '100g', '가상 조랭이떡 영양표'),
  ('d2000000-0000-4000-8000-000000000002', '대파 참깨 고명', null, null, null, '미확인', '100g', '가상 고명 영양표'),
  ('d2000000-0000-4000-8000-000000000003', '사과 고추 소스', null, null, null, '없음', '100mL', '가상 소스 영양표');

insert into product_components (product_id, component_id, amount, unit, quantity, sort_order) values
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 110, 'g', 1, 1),
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 8, 'g', 1, 2),
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000003', 45, 'mL', 1, 3);

insert into component_ingredients (id, component_id, seq, name, name_en, origin, allergens) values
  ('d3000000-0000-4000-8001-000000000001', 'd2000000-0000-4000-8000-000000000001', 1, '쌀가루', 'Rice flour', '태국산', '{}'),
  ('d3000000-0000-4000-8001-000000000002', 'd2000000-0000-4000-8000-000000000001', 2, '기장가루', 'Millet flour', '프랑스산', '{}'),
  ('d3000000-0000-4000-8002-000000000001', 'd2000000-0000-4000-8000-000000000002', 1, '건대파', 'Dried green onion', '대만산', '{}'),
  ('d3000000-0000-4000-8002-000000000002', 'd2000000-0000-4000-8000-000000000002', 2, '볶은 참깨', 'Roasted sesame seeds', '인도산', '{참깨}'),
  ('d3000000-0000-4000-8003-000000000001', 'd2000000-0000-4000-8000-000000000003', 1, '사과 퓌레', 'Apple puree', '폴란드산', '{}'),
  ('d3000000-0000-4000-8003-000000000002', 'd2000000-0000-4000-8000-000000000003', 2, '물', 'Water', '태국산', '{}'),
  ('d3000000-0000-4000-8003-000000000003', 'd2000000-0000-4000-8000-000000000003', 3, '고춧가루', 'Chili powder', '튀르키예산', '{}');

insert into component_nutrition (component_id, kcal, sodium_mg, carb_g, sugar_g, fat_g, sat_fat_g, protein_g) values
  ('d2000000-0000-4000-8000-000000000001', 203, 18, 44.5, 0.8, 0.7, 0.1, 4.6),
  ('d2000000-0000-4000-8000-000000000002', 403, 66, 38.5, 6.2, 19.2, 2.8, 15.4),
  ('d2000000-0000-4000-8000-000000000003', 57, 31, 12.6, 7.8, 0.3, 0.05, 0.9);

insert into product_label_texts (id, product_id, language, pack_level, item_key, text, source, sort_order) values
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '영어', 'unit', 'product_name', 'Test Tteokbokki', '떡볶이 가상 라벨 초안', 1),
  ('d4000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', '영어', 'unit', 'net_weight', 'Net weight: 166 g (one serving).', '떡볶이 가상 라벨 초안', 2),
  ('d4000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', '영어', 'unit', 'ingredients', 'Rice cakes (rice flour, millet flour), apple chili sauce (apple puree, water, chili powder), green onion and sesame garnish (dried green onion, roasted sesame seeds). Contains sesame.', '떡볶이 가상 라벨 초안', 3),
  ('d4000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', '영어', 'unit', 'storage', 'Keep frozen until ready to cook.', '떡볶이 가상 라벨 초안', 4),
  ('d4000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000001', '영어', 'unit', 'origin', 'Made in Thailand.', '떡볶이 가상 라벨 초안', 5);

insert into field_status (id, entity_type, entity_id, field_key, status, wait_reason, wait_who, requested_at, note, updated_at) values
  ('d5000000-0000-4000-8000-000000000001', 'product', 'd1000000-0000-4000-8000-000000000001', 'finished_country', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000002', 'product', 'd1000000-0000-4000-8000-000000000001', 'storage_condition', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000003', 'product', 'd1000000-0000-4000-8000-000000000001', 'net_content_value', 'needs_check', null, null, null, '소스 실중량 확인 후 가상 포장의 166g과 대조', '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000004', 'product', 'd1000000-0000-4000-8000-000000000001', 'manufacturer_name', 'missing', 'asking_supplier', '실습용 포장 담당', '2026-11-28', '완제품 제조원 표기 대기', '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000005', 'component', 'd2000000-0000-4000-8000-000000000001', 'food_type_kr', 'needs_check', null, null, null, '조랭이떡 식품유형을 가상 사양서와 대조', '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000006', 'component', 'd2000000-0000-4000-8000-000000000001', 'animal_ingredient', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000007', 'component', 'd2000000-0000-4000-8000-000000000001', 'ingredients', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000008', 'component', 'd2000000-0000-4000-8000-000000000001', 'nutrition_source', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000009', 'component', 'd2000000-0000-4000-8000-000000000002', 'ingredients', 'needs_check', null, null, null, '고명의 건대파와 볶은 참깨 표시 순서 확인', '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000010', 'component', 'd2000000-0000-4000-8000-000000000002', 'animal_ingredient', 'missing', 'asking_supplier', '실습용 고명 담당', '2026-11-28', null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000011', 'component', 'd2000000-0000-4000-8000-000000000002', 'nutrition_source', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000012', 'component', 'd2000000-0000-4000-8000-000000000003', 'ingredients', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000013', 'component', 'd2000000-0000-4000-8000-000000000003', 'animal_ingredient', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000014', 'component', 'd2000000-0000-4000-8000-000000000003', 'unit_weight_g', 'missing', null, null, null, '소스 한 포 실중량 확인 전에는 100g당 영양값 보류', '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000015', 'component', 'd2000000-0000-4000-8000-000000000003', 'nutrition_source', 'needs_check', null, null, null, '소스의 가상 영양표가 100mL 기준인지 재확인', '2026-11-28T00:00:00Z'),
  ('d5000000-0000-4000-8000-000000000016', 'product', 'd1000000-0000-4000-8000-000000000001', 'name_en', 'confirmed', null, null, null, null, '2026-11-28T00:00:00Z');
