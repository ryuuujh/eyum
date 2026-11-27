-- [공용] 2/8 field_status (Claude 생성, 제품 · 부속물품 공통)
-- 칸마다 값의 확인 상태를 같이 관리한다.
-- 줄이 없을 때: 값이 비었으면 missing, 값이 있으면 needs_check로 본다.
-- 할 일 개수: missing + needs_check + on_hold (wait_reason이 있어도 포함). not_applicable만 제외.

create table field_status (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('product', 'component', 'ingredient', 'accessory', 'accessory_option')),
  entity_id     uuid not null,      -- 여러 테이블을 가리켜 FK 없음. RPC · 앱에서 존재 검증
  field_key     text not null check (field_key ~ '^[a-z0-9_]+$'),  -- 대상 테이블 컬럼명 그대로
  status        text not null check (status in ('confirmed', 'needs_check', 'missing', 'on_hold', 'not_applicable')),
  wait_reason   text check (wait_reason in ('asking_supplier', 'undecided', 'unknown')),
  wait_who      text,
  requested_at  date,
  note          text,
  source_doc_id uuid references source_documents(id) on delete set null,
  updated_by    text,               -- 로그인 전까지 이름
  updated_at    timestamptz not null default now(),
  unique (entity_type, entity_id, field_key),
  -- 기다리는 이유는 아직 값이 확정되지 않은 칸에만
  check (wait_reason is null or status in ('missing', 'needs_check'))
);
create index field_status_entity on field_status (entity_type, entity_id);
create trigger field_status_updated_at before update on field_status
  for each row execute function set_updated_at();

-- 대상 행이 지워지면 상태 줄도 같이 지운다 (FK가 없으니 트리거로)
create or replace function delete_field_status() returns trigger
language plpgsql as $$
begin
  delete from field_status where entity_type = tg_argv[0] and entity_id = old.id;
  return old;
end;
$$;
create trigger products_delete_status after delete on products
  for each row execute function delete_field_status('product');
create trigger components_delete_status after delete on components
  for each row execute function delete_field_status('component');
create trigger ingredients_delete_status after delete on component_ingredients
  for each row execute function delete_field_status('ingredient');
-- accessory: 부속물품 공통 칸(물품명 · 영문명 등), accessory_option: 옵션 칸(재질 · 용도 · 형태 · 규격 · HS).
-- 옵션이 없는 물품의 기본 옵션도 accessory_option이다 (11/26 합의).
-- accessories · accessory_options 테이블은 GPT 마이그레이션(6/8)에서 같은 트리거를 붙인다:
--   accessories → delete_field_status('accessory'), accessory_options → delete_field_status('accessory_option')
