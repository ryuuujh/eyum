-- 또떡EZ 예시 데이터 (8/8, Claude). 근거: 또떡EZ_등록예시.md
-- 고정 id를 써서 다른 탭이 같은 제품을 가리킬 수 있게 한다.

insert into products (id, code, name_ko, net_content_value, net_content_unit, net_content_note,
  serving_desc, servings_per_pack, storage_condition, finished_country, halal, status)
values ('11111111-0000-4000-8000-000000000001', 'ttok-ez', '또떡EZ', 226, 'g', '조리수 제외',
  '1인분', 2, '상온', '대한민국', '미확인', 'draft');

insert into components (id, name, manufacturer_name, manufacturer_public, report_no, food_type_kr,
  animal_ingredient, nutrition_basis, unit_weight_g, nutrition_source) values
('22222222-0000-4000-8000-000000000001', '떡볶이떡-S', '농업회사법인 주식회사 푸르메에프에스', true,
  '20140487270112', '떡류', '없음', '100g', null, '시험성적서 · 휴먼바이오 · 2026.03.20'),
('22222222-0000-4000-8000-000000000002', '파우더A', null, null,
  null, null, '미확인', '100g', null, '시험성적서 · 바이오푸드랩 · 2026.07.27'),
('22222222-0000-4000-8000-000000000003', '양조간장 501', '샘표', true,
  null, null, '미확인', '100mL', null, '제품 라벨 표시값 (100mL당)');

insert into product_components (product_id, component_id, amount, unit, quantity, sort_order) values
('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 100, 'g', 2, 1),
('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002', 20, 'g', 1, 2),
('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000003', 6, 'mL', 1, 3);

insert into component_ingredients (component_id, seq, name, origin, is_additive, ins_no) values
('22222222-0000-4000-8000-000000000001', 1, '쌀', '미국산', false, null),
('22222222-0000-4000-8000-000000000001', 2, '소금', null, false, null),
('22222222-0000-4000-8000-000000000001', 3, '구연산', null, true, '330'),
('22222222-0000-4000-8000-000000000001', 4, '주정', null, false, null),
-- 파우더A: 혜윰 회신 (2026-11-26) 원재료 순서만, 함량 없음
('22222222-0000-4000-8000-000000000002', 1, '토마토분말', null, false, null),
('22222222-0000-4000-8000-000000000002', 2, '유기농 사탕수수당', null, false, null),
('22222222-0000-4000-8000-000000000002', 3, '양파', null, false, null),
('22222222-0000-4000-8000-000000000002', 4, '마늘', null, false, null),
('22222222-0000-4000-8000-000000000002', 5, '다시마', null, false, null),
('22222222-0000-4000-8000-000000000003', 1, '양조간장', null, false, null);
update component_ingredients set is_organic = true where component_id = '22222222-0000-4000-8000-000000000002' and name = '유기농 사탕수수당';
update component_ingredients set origin = '스페인산', allergens = '{토마토}' where component_id = '22222222-0000-4000-8000-000000000002' and name = '토마토분말';
update component_ingredients set origin = '아르헨티나산' where component_id = '22222222-0000-4000-8000-000000000002' and name = '유기농 사탕수수당';
update component_ingredients set origin = '국산' where component_id = '22222222-0000-4000-8000-000000000002' and name in ('양파', '마늘', '다시마');
update component_ingredients set origin = '국산', allergens = '{대두,밀}' where component_id = '22222222-0000-4000-8000-000000000003';
update components set animal_ingredient = '없음' where id = '22222222-0000-4000-8000-000000000002';

insert into component_nutrition (component_id, kcal, sodium_mg, carb_g, sugar_g, fat_g, sat_fat_g, protein_g) values
('22222222-0000-4000-8000-000000000001', 218.3, 173.21, 48.80, 0.00, 0.76, 0.21, 4.22),
('22222222-0000-4000-8000-000000000002', 338.2, 1736.90, 71.76, 61.82, 0.40, 0.11, 11.88),
('22222222-0000-4000-8000-000000000003', 100.0, 6300.00, 9.00, 2.00, 0.10, 0.00, 10.00);

-- 확인 상태 (값이 있는데 확인이 필요한 칸, 기다리는 칸)
insert into field_status (entity_type, entity_id, field_key, status, wait_reason, wait_who, requested_at, note) values
('product',   '11111111-0000-4000-8000-000000000001', 'net_content_value', 'needs_check', null, null, null, '간장 6mL를 6g으로 본 값'),
('product',   '11111111-0000-4000-8000-000000000001', 'storage_condition', 'confirmed', null, null, null, '영어 라벨(10.14) Store in a cool, dry place'),
('product',   '11111111-0000-4000-8000-000000000001', 'finished_country',  'confirmed', null, null, null, '영어 라벨(10.14) Country of Origin: Republic of Korea'),
('component', '22222222-0000-4000-8000-000000000002', 'ingredients',       'needs_check', null, null, null, '순서는 혜윰 회신(11/26), 원산지 · 알레르기는 영어 라벨(10.14). 영어 라벨엔 3번째에 소금이 있어 혜윰 확인 중'),
('component', '22222222-0000-4000-8000-000000000003', 'ingredients',       'needs_check', null, null, null, '영어 라벨(10.14) 기준 한 줄 원재료(하위 원료 구분 안 함, 혜윰). 11/30 미팅에서 확인'),
('product',   '11111111-0000-4000-8000-000000000001', 'name_en',           'missing', 'undecided', '혜윰', '2026-11-25', null),
('component', '22222222-0000-4000-8000-000000000001', 'food_type_kr',      'needs_check', null, null, null, '라벨의 "떡류, 복합조미식품"에서 추정'),
('component', '22222222-0000-4000-8000-000000000001', 'animal_ingredient', 'needs_check', null, null, null, '원재료 기준, 하위 원료 확인 전'),
('component', '22222222-0000-4000-8000-000000000002', 'animal_ingredient', 'needs_check', null, null, null, '원재료 기준 없음으로 보임 (다시마는 해조류), 혜윰 확인 전'),
('component', '22222222-0000-4000-8000-000000000003', 'manufacturer_name', 'needs_check', null, null, null, '정식 제조원명 필요'),
('component', '22222222-0000-4000-8000-000000000003', 'unit_weight_g',     'missing', null, null, null, '6mL = 몇 g인지 없음 → 100g당 영양 보류'),
('component', '22222222-0000-4000-8000-000000000003', 'nutrition_source',  'needs_check', null, null, null, '시험성적서 아님');

-- 자료에 그대로 있는 값은 확인됨으로 둔다 (줄이 없으면 값이 있어도 "확인 필요"로 보기 때문)
insert into field_status (entity_type, entity_id, field_key, status) values
('product',   '11111111-0000-4000-8000-000000000001', 'name_ko', 'confirmed'),
('product',   '11111111-0000-4000-8000-000000000001', 'serving_desc', 'confirmed'),
('product',   '11111111-0000-4000-8000-000000000001', 'servings_per_pack', 'confirmed'),
('component', '22222222-0000-4000-8000-000000000001', 'manufacturer_name', 'confirmed'),
('component', '22222222-0000-4000-8000-000000000001', 'report_no', 'confirmed'),
('component', '22222222-0000-4000-8000-000000000001', 'nutrition_source', 'confirmed'),
('component', '22222222-0000-4000-8000-000000000002', 'nutrition_source', 'confirmed');
