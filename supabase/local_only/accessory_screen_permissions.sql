-- 로컬 전용: 가상 데이터만 있는 독립 로컬 DB에서만 쓴다. 팀 DB에 넣지 말 것.
-- accessory_document_permissions.sql 다음에 같은 세션에서 실행한다.
-- 기본 DB 이름이 postgres면 먼저 SET heyum.local_accessory_permissions = 'on';
begin;
do $$
begin
  if current_database() !~ '^heyum_verify_[0-9a-f]{16}$'
    and current_setting('heyum.local_accessory_permissions', true) is distinct from 'on' then
    raise exception 'Local development database opt-in required';
  end if;
end;
$$;

-- 화면은 이 두 함수만 부른다. 표 자체 권한은 열지 않는다.
alter function public.accessory_action(jsonb) security definer;
alter function public.food_hs_action(jsonb) security definer;
grant execute on function public.accessory_action(jsonb), public.food_hs_action(jsonb) to anon;
commit;
