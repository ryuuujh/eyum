-- 로컬 전용: 가상 데이터만 있는 독립 로컬 DB에서만 쓴다. 팀 DB에 넣지 말 것.
-- accessory_screen_permissions.sql 다음에 같은 세션에서 실행한다.
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

-- HS 데이터 확인 화면은 이 함수만 부른다.
alter function public.hs_data_action(jsonb) security definer;
grant execute on function public.hs_data_action(jsonb) to anon;
commit;
