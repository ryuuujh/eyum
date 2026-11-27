-- [공용] 5/8 product_export (Claude)
-- GPT의 hs_classifications(4/8)가 먼저 머지되어 있어야 한다.
-- field_status에서 제품 HS는 entity_type='product', entity_id=products.id, field_key='hs6'|'hsk10'.

create table product_export (
  product_id           uuid primary key references products(id) on delete cascade,
  -- HS (부속물품과 같은 이름 · 형식)
  hs6                  text check (hs6 ~ '^[0-9]{6}$'),
  hsk10                text check (hsk10 ~ '^[0-9]{10}$'),
  hs_checked_at        date,
  hs_confirmed_by      text,
  hs_classification_id uuid references hs_classifications(id) on delete set null,
  -- 가격 (공개 범위: 내부만)
  unit_price           numeric check (unit_price >= 0),
  currency             text check (currency ~ '^[A-Z]{3}$'),
  -- CTN
  units_per_ctn        int check (units_per_ctn > 0),
  ctn_net_kg           numeric, ctn_gross_kg numeric,
  ctn_l_cm             numeric, ctn_w_cm numeric, ctn_h_cm numeric,
  unit_gross_g         numeric,                -- 1개당 포장 포함 중량
  -- 팔레트
  pallet_l_cm          numeric, pallet_w_cm numeric,
  pallet_layers        int, pallet_ctn_count int,
  updated_at           timestamptz not null default now(),
  check (hsk10 is null or (hs6 is not null and left(hsk10, 6) = hs6))
);
create trigger product_export_updated_at before update on product_export
  for each row execute function set_updated_at();
