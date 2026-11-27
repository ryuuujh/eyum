-- [공용] 1/8 제품 코어 테이블 (Claude)
-- 제품은 구성품 단위로 등록하고, 제품 영양성분은 저장하지 않고 구성품 값으로 계산한다.
-- 배합비 · 정확한 함량 · 원료 공급처 · 제조 방법은 받지 않는다.

create extension if not exists pgcrypto;

-- 공통: updated_at 자동 갱신
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 제품
create table products (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ko            text not null,
  name_en            text,
  net_content_value  numeric check (net_content_value > 0),
  net_content_unit   text check (net_content_unit in ('g', 'kg', 'mL', 'L')),
  net_content_note   text,                         -- 예: 조리수 제외
  serving_desc       text,                         -- 예: 1인분
  servings_per_pack  numeric check (servings_per_pack > 0),
  storage_condition  text check (storage_condition in ('상온', '냉장', '냉동')),
  date_type          text check (date_type in ('소비기한', '품질유지기한')),
  date_period        text,                         -- 예: 12개월
  manufacturer_name  text,                         -- 완제품 제조원 (최종으로 만들거나 포장한 곳, 라벨 · 서류용)
  finished_country   text,                         -- 완제품 제조국
  gtin               text check (gtin ~ '^[0-9]{8,14}$'),
  halal              text not null default '미확인' check (halal in ('미확인', '없음', '있음')),
  storage_text       text,                         -- 보관 방법 문구
  cooking_en         text,
  caution_en         text,
  claims             text,                         -- 포장 강조 문구 · 인증 마크
  pack_w_mm          numeric, pack_d_mm numeric, pack_h_mm numeric,
  label_w_mm         numeric, label_h_mm numeric,  -- 라벨 부착 가능 면적
  export_selected    boolean not null default false,  -- 수출할 제품 체크 (다른 탭은 /api/products?selected=1로 고름)
  status             text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- 현지어 제품명 (번역은 라벨 탭, 확정된 이름만 저장)
create table product_local_names (
  product_id uuid not null references products(id) on delete cascade,
  lang       text not null check (lang ~ '^[a-z]{2}$'),
  name       text not null,
  primary key (product_id, lang)
);

-- 구성품 (여러 제품이 같이 씀)
create table components (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  manufacturer_name        text,
  manufacturer_public      boolean,             -- 라벨에 공개되는 제조원인지 (null = 모름)
  report_no                text,                -- 품목보고번호
  food_type_kr             text,                -- 식품유형 (한국 기준)
  animal_ingredient        text not null default '미확인' check (animal_ingredient in ('미확인', '없음', '있음')),
  animal_ingredient_detail text,
  cross_contact            text,                -- 교차접촉 알레르기
  nutrition_basis          text not null default '100g' check (nutrition_basis in ('100g', '100mL')),
  unit_weight_g            numeric check (unit_weight_g > 0),  -- mL 구성품 한 포의 실중량
  nutrition_source         text,                -- 예: 시험성적서 · 휴먼바이오 · 2026.03.20
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger components_updated_at before update on components
  for each row execute function set_updated_at();

-- 제품 ↔ 구성품
create table product_components (
  product_id   uuid not null references products(id) on delete cascade,
  component_id uuid not null references components(id) on delete restrict,
  amount       numeric not null check (amount > 0),     -- 한 봉 중량 또는 용량
  unit         text not null check (unit in ('g', 'mL')),
  quantity     numeric not null default 1 check (quantity > 0),
  sort_order   int not null default 0,
  primary key (product_id, component_id)
);

-- 원재료 (많이 든 순)
create table component_ingredients (
  id                uuid primary key default gen_random_uuid(),
  component_id      uuid not null references components(id) on delete cascade,
  parent_id         uuid references component_ingredients(id) on delete cascade,  -- 하위 원료
  seq               int not null check (seq > 0),
  name              text not null,
  origin            text,
  is_organic        boolean not null default false,
  is_additive       boolean not null default false,
  additive_function text,                       -- 예: 산도조절제
  ins_no            text,                       -- 예: 330
  allergens         text[] not null default '{}',
  labeled_pct       numeric check (labeled_pct > 0 and labeled_pct <= 100),  -- 라벨에 적힌 함량만
  pct_basis         text check (pct_basis in ('구성품 기준', '완제품 기준')),
  check ((labeled_pct is null) = (pct_basis is null))
);
create unique index component_ingredients_order
  on component_ingredients (component_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), seq);

-- 구성품 영양성분 (components.nutrition_basis 기준)
create table component_nutrition (
  component_id   uuid primary key references components(id) on delete cascade,
  kcal           numeric, sodium_mg numeric, carb_g numeric, sugar_g numeric,
  fat_g          numeric, sat_fat_g numeric, trans_fat_g numeric,
  cholesterol_mg numeric, protein_g numeric, fiber_g numeric
);

-- 소비자 포장 부위별 재질 (프랑스 Triman · Info-tri)
create table product_packaging_parts (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  part       text not null,                     -- 용기, 뚜껑, 파우치 …
  material   text,
  separable  text check (separable in ('분리됨', '붙어 있음')),
  sort_order int not null default 0
);

-- 기존 라벨 문구 (원문 그대로, 라벨 탭이 번역 · 비교에 씀). 제조원 · 수출자 · 수입자 항목은 주소가 있어 외부 공유 · AI 전송에서 뺀다
create table product_label_texts (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  language   text not null,                     -- 영어 · 한국어 · 베트남어 …
  pack_level text not null check (pack_level in ('unit', 'outer')),   -- 개별포장 · 외박스
  item_key   text not null check (item_key in ('product_name', 'net_weight', 'ingredients', 'allergens', 'instructions', 'storage',
               'precaution', 'date', 'origin', 'nutrition', 'manufacturer', 'exporter', 'importer', 'other')),
  text       text not null,
  source     text,                              -- 어느 라벨에서 옮겼는지
  sort_order int not null default 0
);
create index product_label_texts_product on product_label_texts(product_id);

-- 올린 자료 (원본은 Supabase Storage, AI로 보내기 전 민감정보 제거)
create table source_documents (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references products(id) on delete set null,
  storage_path text not null,
  kind         text,                            -- 라벨 전개도, 시험성적서, 메일 본문 …
  masked       boolean not null default false,
  uploaded_at  timestamptz not null default now()
);
