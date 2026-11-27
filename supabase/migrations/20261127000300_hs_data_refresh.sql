begin;
create table public.hs_data_checks (
  id bigint generated always as identity primary key,
  dataset text not null check (dataset in ('hsk','standard_names')),
  checked_at timestamptz not null default clock_timestamp(),
  next_check_at timestamptz not null,
  ok boolean not null,
  metadata jsonb,
  change_key text,
  error_code text
);
create index hs_data_checks_recent on public.hs_data_checks(dataset,id desc);
create table public.hs_data_approvals (
  version_id uuid primary key references public.hs_data_versions,
  previous_version_id uuid not null references public.hs_data_versions,
  notice_id uuid references public.hs_data_notices,
  approved_by text not null,
  reason text not null,
  approved_at timestamptz not null default clock_timestamp(),
  differences jsonb not null,
  review_result jsonb not null
);

create function public.compare_hs_data_versions(p_previous uuid,p_candidate uuid)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
  with old_codes as (select code,name_ko,name_en from public.hsk_codes where version_id=p_previous),
  new_codes as (select code,name_ko,name_en from public.hsk_codes where version_id=p_candidate),
  hsk as (
    select coalesce(o.code,n.code) code,
      case when o.code is null then 'added' when n.code is null then 'removed' else 'changed' end kind
    from old_codes o full join new_codes n using(code)
    where o.code is null or n.code is null or (o.name_ko,o.name_en) is distinct from (n.name_ko,n.name_en)
  ), standard_groups as (
    select version_id,code,jsonb_agg(jsonb_build_array(name_ko,name_en,specification)
      order by jsonb_build_array(name_ko,name_en,specification)) entries
    from public.hs_standard_names where version_id in (p_previous,p_candidate) group by version_id,code
  ), standard as (
    select coalesce(o.code,n.code) code,
      case when o.code is null then 'added' when n.code is null then 'removed' else 'changed' end kind
    from (select * from standard_groups where version_id=p_previous) o
    full join (select * from standard_groups where version_id=p_candidate) n using(code)
    where o.entries is distinct from n.entries
  ), standard_links as (
    select code from standard where kind='removed'
    union
    select link.code from public.hs_standard_names o
    join public.hs_standard_names n
      on coalesce(o.name_ko,'')=coalesce(n.name_ko,'') and coalesce(o.name_en,'')=coalesce(n.name_en,'')
    cross join lateral (values(o.code),(n.code)) link(code)
    where o.version_id=p_previous and n.version_id=p_candidate and o.code<>n.code
      and (o.name_ko is not null or o.name_en is not null)
      and not exists (select 1 from public.hs_standard_names kept where kept.version_id=p_candidate
        and kept.code=o.code and kept.name_ko is not distinct from o.name_ko and kept.name_en is not distinct from o.name_en)
  )
  select jsonb_build_object(
    'hsk',coalesce((select jsonb_agg(to_jsonb(hsk) order by code) from hsk),'[]'),
    'standard_names',coalesce((select jsonb_agg(to_jsonb(standard) order by code) from standard),'[]'),
    'candidate_snapshot',md5(
      coalesce((select jsonb_agg(to_jsonb(n) order by n.code)::text from new_codes n),'[]') ||
      coalesce((select jsonb_agg(jsonb_build_array(code,entries) order by code)::text
        from standard_groups where version_id=p_candidate),'[]')),
    'standard_link_audit_codes',coalesce((select jsonb_agg(distinct code order by code) from standard_links),'[]'),
    'review_codes',coalesce((select jsonb_agg(code order by code) from hsk),'[]')
  );
$$;

create function public.approve_hs_data_update(p_expected uuid,p_candidate uuid,p_notice uuid,p_by text,p_reason text,
  p_expected_diff jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare
  active_id uuid;
  diff jsonb;
  review_codes text[];
  result jsonb;
begin
  if nullif(btrim(p_by),'') is null or nullif(btrim(p_reason),'') is null then
    raise exception 'Approver and reason required';
  end if;
  lock table public.hs_data_versions,public.hsk_codes,public.hs_standard_names in share row exclusive mode;
  select id into active_id from public.hs_data_versions where is_active;
  if active_id is null or active_id is distinct from p_expected then raise exception 'Active version changed'; end if;
  if p_candidate is null or p_candidate=active_id or not exists (
    select 1 from public.hs_data_versions where id=p_candidate and approved_at is null and not is_active
  ) then raise exception 'Candidate is not staged'; end if;
  if not exists (select 1 from public.hsk_codes where version_id=p_candidate and length(code)=10)
    or not exists (select 1 from public.hs_standard_names where version_id=p_candidate)
  then raise exception 'Candidate dataset incomplete'; end if;
  diff := public.compare_hs_data_versions(active_id,p_candidate);
  if diff is distinct from p_expected_diff then raise exception 'Comparison changed'; end if;
  review_codes := array(select jsonb_array_elements_text(diff->'review_codes'));
  update public.hs_data_versions set is_active=false where id=active_id;
  update public.hs_data_versions set is_active=true, approved_by=btrim(p_by), approved_at=clock_timestamp()
    where id=p_candidate;
  if cardinality(review_codes)>0 then
    result := public.mark_hs_items_for_review(review_codes,btrim(p_reason));
  else
    result := '{"count":0,"items":[]}'::jsonb;
  end if;
  if p_notice is not null then
    perform public.resolve_hs_data_notice(p_notice,'applied',btrim(p_by),p_candidate);
  end if;
  insert into public.hs_data_approvals(version_id,previous_version_id,notice_id,approved_by,reason,differences,review_result)
    values(p_candidate,active_id,p_notice,btrim(p_by),btrim(p_reason),diff,result);
  return result;
end;
$$;

revoke all on public.hs_data_checks,public.hs_data_approvals from public,anon,authenticated,service_role;
revoke all on function public.compare_hs_data_versions(uuid,uuid),
  public.approve_hs_data_update(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
commit;
