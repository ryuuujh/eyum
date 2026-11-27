-- 공식 HS 데이터 반자동 갱신을 제품 · 부속물품에 잇는 부분 (Claude, 11/27)
-- 변경 확인 · 파일 검증 · 비교 · 새 버전 적용은 GPT가 만든다. 여기에는 그 기능이 부를 곳만 둔다.
--   1) hs_data_notices        : 변경 알림 (같은 변경은 한 번만, 읽음과 처리 완료를 따로)
--   2) hs_items_in_use()      : HS가 들어 있는 식품 제품 · 부속물품 옵션 전체 (검토 이력 없는 직접 입력도 포함)
--   3) hs_items_affected(..)  : 바뀐 부호 목록 → 영향받는 품목
--   4) mark_hs_item_for_review / mark_hs_items_for_review : 확정 HS 값은 그대로 두고 재검토 필요로만 바꾼다
--   5) hs_data_action(p)      : 화면용 (현재 버전 · 알림 · 품목 수, 알림 읽음 · 변경 없음 처리)
-- 팀 DB에는 권한을 열지 않는다. 로컬 확인은 supabase/local_only/hs_data_screen_permissions.sql.
begin;

create table public.hs_data_notices (
  id uuid primary key default gen_random_uuid(),
  dataset text not null check (dataset in ('hsk', 'standard_names')),
  kind text not null default 'metadata_changed' check (kind in ('metadata_changed', 'check_failed')),
  change_key text not null check (btrim(change_key) <> ''),  -- 같은 변경을 알아보는 값 (예: 수정일 · 기준일)
  message text not null,
  detail jsonb not null default '{}',   -- 이전 · 이후 메타데이터, 오류 내용
  detected_at timestamptz not null default now(),
  read_at timestamptz,
  read_by text,
  resolution text check (resolution in ('applied', 'no_change')),
  resolved_at timestamptz,
  resolved_by text,
  resolved_version_id uuid references public.hs_data_versions(id),
  unique (dataset, kind, change_key),
  check ((read_at is null) = (read_by is null)),
  check ((resolution is null) = (resolved_at is null)),
  check (resolution is null or nullif(btrim(resolved_by), '') is not null),
  check ((resolution = 'applied') = (resolved_version_id is not null))
);
create index hs_data_notices_open on public.hs_data_notices (detected_at desc) where resolution is null;

-- 알림 남기기. 같은 (데이터, 종류, change_key)는 다시 만들지 않는다.
create function public.record_hs_data_notice(
  p_dataset text, p_kind text, p_change_key text, p_message text, p_detail jsonb default '{}'
)
returns table (notice_id uuid, created boolean)
language plpgsql set search_path = pg_catalog, public as $$
begin
  insert into public.hs_data_notices (dataset, kind, change_key, message, detail)
    values (p_dataset, p_kind, btrim(p_change_key), p_message, coalesce(p_detail, '{}'))
    on conflict (dataset, kind, change_key) do nothing
    returning id, true into notice_id, created;
  if notice_id is null then
    select n.id, false into notice_id, created from public.hs_data_notices n
      where n.dataset = p_dataset and n.kind = p_kind and n.change_key = btrim(p_change_key);
  end if;
  return next;
end;
$$;

-- 처리 완료. applied는 새 버전이 실제로 활성일 때만(GPT 적용 함수가 같은 트랜잭션에서 부른다).
create function public.resolve_hs_data_notice(p_notice uuid, p_resolution text, p_by text, p_version uuid default null)
returns void language plpgsql set search_path = pg_catalog, public as $$
begin
  if p_resolution = 'applied' and not exists (select 1 from public.hs_data_versions where id = p_version and is_active) then
    raise exception 'Applied notice needs the active version';
  end if;
  update public.hs_data_notices set resolution = p_resolution, resolved_at = now(), resolved_by = btrim(p_by),
      resolved_version_id = case when p_resolution = 'applied' then p_version end,
      read_at = coalesce(read_at, now()), read_by = coalesce(read_by, btrim(p_by))
    where id = p_notice and resolution is null;
  if not found then raise exception 'Notice missing or already resolved'; end if;
end;
$$;

-- HS가 들어 있는 품목 전체. 식품은 제품 단위, 부속물품은 옵션 단위. 보관한 것은 뺀다.
-- 검토 이력(hs_classification_id)이 없는 직접 입력 값도 들어간다.
create function public.hs_items_in_use()
returns table (item_type text, item_id uuid, item_label text, hs6 text, hsk10 text,
  hs_classification_id uuid, hs_data_version_id uuid, review_status text)
language sql stable set search_path = pg_catalog, public as $$
  select 'food', p.id, p.name_ko, e.hs6, e.hsk10, e.hs_classification_id, c.hs_data_version_id, c.status
    from public.product_export e join public.products p on p.id = e.product_id
    left join public.hs_classifications c on c.id = e.hs_classification_id
    where e.hs6 is not null and p.status <> 'archived'
  union all
  select 'accessory', o.id, a.item_name || coalesce(' · ' || o.option_name, ''), o.hs6, o.hsk10,
      o.hs_classification_id, c.hs_data_version_id, c.status
    from public.accessory_options o join public.accessories a on a.id = o.accessory_id
    left join public.hs_classifications c on c.id = o.hs_classification_id
    where o.hs6 is not null and o.archived_at is null and a.status <> 'archived'
$$;

-- 바뀐 부호(2~10자리) → 영향받는 품목.
--  · 품목 부호(hsk10, 없으면 hs6)가 바뀐 부호로 시작하면 영향 (상위 호 · 소호가 바뀐 경우 포함)
--  · 6자리만 확정한 품목은 그 6자리 아래 10자리가 바뀌어도 영향 (고를 10자리가 달라졌을 수 있음)
create function public.hs_items_affected(p_codes text[])
returns table (item_type text, item_id uuid, item_label text, hs6 text, hsk10 text,
  hs_classification_id uuid, review_status text, matched_codes text[])
language plpgsql stable set search_path = pg_catalog, public as $$
begin
  if exists (select 1 from unnest(coalesce(p_codes, '{}')) c where c is null or c !~ '^[0-9]{2,10}$') then
    raise exception 'Codes must be 2-10 digits';
  end if;
  return query
    select i.item_type, i.item_id, i.item_label, i.hs6, i.hsk10, i.hs_classification_id, i.review_status, m.codes
    from public.hs_items_in_use() i
    cross join lateral (
      select array_agg(distinct c order by c) as codes from unnest(p_codes) c
      where coalesce(i.hsk10, i.hs6) like c || '%' or (i.hsk10 is null and c like i.hs6 || '%')
    ) m
    where m.codes is not null
    order by i.item_type, i.item_label, i.item_id;
end;
$$;

-- 한 품목을 재검토 필요로. 확정 HS 값 · 확정자 · 확정일 · 검토 이력은 바꾸지 않는다.
-- 검토 이력이 있으면 기존 mark_hs_classification_for_review, 없으면(직접 입력) field_status만 바꾼다.
create function public.mark_hs_item_for_review(p_item_type text, p_item_id uuid, p_reason text)
returns text language plpgsql set search_path = pg_catalog, public as $$
declare
  current_id uuid;
  current_hs6 text;
  current_hsk10 text;
  entity text;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'Reason is required'; end if;
  if p_item_type = 'food' then
    entity := 'product';
    perform 1 from public.products where id = p_item_id for update;
    select hs_classification_id, hs6, hsk10 into current_id, current_hs6, current_hsk10
      from public.product_export where product_id = p_item_id for update;
  elsif p_item_type = 'accessory' then
    entity := 'accessory_option';
    perform 1 from public.accessories a join public.accessory_options o on o.accessory_id = a.id
      where o.id = p_item_id for update of a;
    select hs_classification_id, hs6, hsk10 into current_id, current_hs6, current_hsk10
      from public.accessory_options where id = p_item_id for update;
  else
    raise exception 'Unknown item type';
  end if;
  if current_hs6 is null then raise exception 'Item has no HS code'; end if;

  if current_id is not null then
    perform public.mark_hs_classification_for_review(current_id, p_reason);
    return 'classification';
  end if;
  insert into public.field_status (entity_type, entity_id, field_key, status, note, updated_at)
    values (entity, p_item_id, 'hs6', 'needs_check', btrim(p_reason), now()),
      (entity, p_item_id, 'hsk10', case when current_hsk10 is null then 'missing' else 'needs_check' end,
        case when current_hsk10 is null then '6자리만 확정' else btrim(p_reason) end, now())
    on conflict (entity_type, entity_id, field_key) do update set
      status = excluded.status, note = excluded.note, updated_at = excluded.updated_at, updated_by = null,
      wait_reason = null, wait_who = null, requested_at = null;
  return 'field_status';
end;
$$;

-- 바뀐 부호 목록으로 영향 품목을 한꺼번에 재검토 필요로. GPT 적용 함수가 새 버전을 켠 같은 트랜잭션 안에서 부른다.
create function public.mark_hs_items_for_review(p_codes text[], p_reason text)
returns jsonb language plpgsql set search_path = pg_catalog, public as $$
declare
  item record;
  marked jsonb := '[]';
begin
  for item in select * from public.hs_items_affected(p_codes) loop
    marked := marked || jsonb_build_object('item_type', item.item_type, 'item_id', item.item_id,
      'label', item.item_label, 'codes', to_jsonb(item.matched_codes),
      'via', public.mark_hs_item_for_review(item.item_type, item.item_id, p_reason));
  end loop;
  return jsonb_build_object('count', jsonb_array_length(marked), 'items', marked);
end;
$$;

-- 화면용 함수 하나 (accessory_action과 같은 방식)
create function public.hs_data_action(p jsonb)
returns jsonb language plpgsql set search_path = pg_catalog, public as $$
declare
  operation text := p->>'action';
begin
  if operation = 'status' then
    return jsonb_build_object(
      'active', (select jsonb_build_object('id', v.id, 'metadata', v.metadata, 'approvedAt', v.approved_at,
          'approvedBy', v.approved_by, 'createdAt', v.created_at,
          'hskRows', (select count(*) from public.hsk_codes k where k.version_id = v.id))
        from public.hs_data_versions v where v.is_active),
      'versions', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'metadata', v.metadata,
          'approvedAt', v.approved_at, 'approvedBy', v.approved_by, 'createdAt', v.created_at, 'active', v.is_active)
          order by v.created_at desc) from public.hs_data_versions v), '[]'),
      'notices', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'dataset', n.dataset, 'kind', n.kind,
          'message', n.message, 'detectedAt', n.detected_at, 'readAt', n.read_at, 'readBy', n.read_by,
          'resolution', n.resolution, 'resolvedAt', n.resolved_at, 'resolvedBy', n.resolved_by)
          order by n.resolution is not null, n.detected_at desc)
        from (select * from public.hs_data_notices order by resolution is not null, detected_at desc limit 30) n), '[]'),
      'items', (select jsonb_build_object(
          'food', count(*) filter (where i.item_type = 'food'),
          'accessory', count(*) filter (where i.item_type = 'accessory'),
          'withoutReview', count(*) filter (where i.hs_classification_id is null),
          'needsReview', count(*) filter (where i.review_status = 'needs_review' or (i.hs_classification_id is null
            and exists (select 1 from public.field_status f where f.entity_type = case i.item_type when 'food' then 'product' else 'accessory_option' end
              and f.entity_id = i.item_id and f.field_key = 'hs6' and f.status = 'needs_check'))))
        from public.hs_items_in_use() i));
  elsif operation = 'read_notice' then
    if nullif(btrim(p->>'by'), '') is null then raise exception 'Name is required'; end if;
    update public.hs_data_notices set read_at = now(), read_by = btrim(p->>'by')
      where id = (p->>'id')::uuid and read_at is null;
  elsif operation = 'no_change' then
    perform public.resolve_hs_data_notice((p->>'id')::uuid, 'no_change', p->>'by');
  else
    raise exception 'Unknown action';
  end if;
  return jsonb_build_object('id', p->>'id');
end;
$$;

revoke all on public.hs_data_notices from public, anon, authenticated;
revoke all on function public.record_hs_data_notice(text,text,text,text,jsonb), public.resolve_hs_data_notice(uuid,text,text,uuid),
  public.hs_items_in_use(), public.hs_items_affected(text[]), public.mark_hs_item_for_review(text,uuid,text),
  public.mark_hs_items_for_review(text[],text), public.hs_data_action(jsonb)
  from public, anon, authenticated, service_role;
commit;
