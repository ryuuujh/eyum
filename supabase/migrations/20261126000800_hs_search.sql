begin;

create function public.normalize_hs_search(p_value text)
returns text language sql immutable
set search_path = pg_catalog, public
as $$
  select regexp_replace(lower(normalize(coalesce(p_value, ''), NFKC)), '[^[:alnum:]]', '', 'g');
$$;

create table public.hs_search_aliases (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('food','accessory')),
  item_term text not null check (public.normalize_hs_search(item_term) <> ''),
  alias_term text not null check (public.normalize_hs_search(alias_term) <> ''),
  priority integer not null default 0,
  enabled boolean not null default true,
  reviewed_by text,
  updated_at timestamptz not null default now()
);
create unique index hs_search_aliases_terms on public.hs_search_aliases
  (item_type, public.normalize_hs_search(item_term), public.normalize_hs_search(alias_term));

create table public.hs_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('food','accessory')),
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  value_type text not null check (value_type in ('text','choice','boolean','number')),
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  applies_to_term text,
  enabled boolean not null default false,
  reviewed_by text,
  check (not enabled or nullif(btrim(reviewed_by), '') is not null),
  unique nulls not distinct (item_type, field_key, applies_to_term)
);

alter table public.hsk_codes add column search_name text generated always as
  (public.normalize_hs_search(coalesce(name_ko,'') || ' ' || coalesce(name_en,''))) stored;
alter table public.hs_standard_names add column search_name text generated always as
  (public.normalize_hs_search(coalesce(name_ko,'') || ' ' || coalesce(name_en,''))) stored;

create or replace view public.reusable_accessory_hs as
select o.id as item_id,a.item_name,o.material,o.intended_use,o.hs6,o.hsk10,c.id as classification_id
from public.accessory_options o
join public.accessories a on a.id=o.accessory_id
join public.hs_classifications c on c.id=o.hs_classification_id and c.item_type='accessory'
  and c.item_id=o.id and c.status='confirmed' and o.hs6=c.chosen_hs6
  and o.hsk10 is not distinct from c.chosen_hsk10
join public.hs_data_versions v on v.id=c.hs_data_version_id and v.is_active
where a.status='active' and o.archived_at is null
  and (nullif(c.input_snapshot->'answers'->>'material','') is null or c.input_snapshot->'answers'->>'material'=o.material)
  and (nullif(c.input_snapshot->'answers'->>'purpose','') is null or c.input_snapshot->'answers'->>'purpose'=o.intended_use)
  and (nullif(c.input_snapshot->'answers'->>'shape','') is null
    or c.input_snapshot->'answers'->>'shape'=coalesce(o.attributes->>'shape',o.attributes->>'form'));

revoke all on public.reusable_accessory_hs from public, anon, authenticated, service_role;
create or replace function public.search_hs_candidates(
  p_item_type text, p_item_name text, p_use_aliases boolean default true,
  p_material text default null, p_intended_use text default null, p_form text default null,
  p_extra_terms text[] default array[]::text[]
)
returns table(hs6 text, hsk10 text, label text, source text, score integer, term text)
language sql stable security invoker
set search_path = pg_catalog, public
as $$
with input as (
  select public.normalize_hs_search(p_item_name) as name,
    public.normalize_hs_search(p_material) as material,
    public.normalize_hs_search(p_intended_use) as intended_use,
    public.normalize_hs_search(p_form) as form
  where p_item_type in ('food','accessory') and public.normalize_hs_search(p_item_name) <> ''
), active as (
  select id from public.hs_data_versions where is_active
), raw_terms as (
  select name as term, 100 as weight from input
  union all
  select public.normalize_hs_search(a.alias_term), 50
    from public.hs_search_aliases a cross join input i
    where p_use_aliases and a.enabled and a.item_type=p_item_type
      and public.normalize_hs_search(a.item_term)=i.name
  union all
  select t.term, 50 from (
    select public.normalize_hs_search(value) as term
    from unnest(p_extra_terms[1:5]) as x(value) where length(value) between 1 and 60
  ) t cross join input where t.term <> ''
), terms as (
  select raw_terms.term, max(weight) as weight from raw_terms group by raw_terms.term
), matches as (
  select h.version_id, h.code, coalesce(nullif(h.name_ko,''),h.name_en) as label, 'hsk'::text as source, t.term, t.weight
    from active v join public.hsk_codes h on h.version_id=v.id
    join terms t on strpos(h.search_name,t.term)>0
  union all
  select n.version_id,n.code,coalesce(nullif(n.name_ko,''),n.name_en),'standard_name',t.term,t.weight
    from active v join public.hs_standard_names n on n.version_id=v.id
    join terms t on strpos(n.search_name,t.term)>0
), expanded as (
  select m.*, 0 as inherited from matches m where length(m.code) in (6,10)
  union all
  select m.version_id,h.code,coalesce(nullif(h.name_ko,''),h.name_en),'hsk',m.term,m.weight,20
    from matches m join public.hsk_codes h on h.version_id=m.version_id
      and h.code between rpad(m.code,10,'0') and rpad(m.code,10,'9')
    where length(m.code) not in (6,10) and length(h.code)=10
), labeled as (
  select e.*, public.normalize_hs_search(e.label) as normalized from expanded e
), scored as (
  select e.code, e.label, e.source, e.term,
    e.weight - e.inherited + case when e.normalized=e.term then 25 else 0 end
    + case when e.source='standard_name' then 5 else 0 end
    + case when i.material<>'' and strpos(e.normalized,i.material)>0 then 18
           when i.material<>'' and exists (
             select 1 from public.hsk_codes parent
             where parent.version_id=e.version_id
               and parent.code in (left(e.code,4),left(e.code,6),left(e.code,7),left(e.code,8),left(e.code,9))
               and length(parent.code)<length(e.code) and strpos(parent.search_name,i.material)>0
           ) then 10 else 0 end
    + case when i.form<>'' and strpos(e.normalized,i.form)>0 then 12 else 0 end
    + case when length(i.intended_use)>=2 and strpos(e.normalized,i.intended_use)>0 then 16 else 0 end
    - case when exists (
        select 1 from unnest(array['구급','담배용','신변장식','문구류','충전용','봉함용','레이블부착용']) as k(word)
        where strpos(e.normalized,k.word)>0
      ) and not exists (
        select 1 from unnest(array['구급','담배용','신변장식','문구류','충전용','봉함용','레이블부착용']) as k(word)
        where strpos(e.normalized,k.word)>0 and strpos(i.intended_use,k.word)>0
      ) then 45 else 0 end
    - case when (strpos(e.normalized,'골판지로만든것으로한정')>0 and strpos(i.form,'골판지')=0 and strpos(i.material,'골판지')=0)
        or (strpos(e.normalized,'골판지로만든것은제외')>0 and strpos(i.form,'접는상자')=0 and strpos(i.material,'접는상자')=0)
      then 12 else 0 end as score
  from labeled e cross join input i
), combined as (
  select s.* from scored s
  union all
  select coalesce(r.hsk10,r.hs6),r.item_name,'registered_item',i.name,200
    from public.reusable_accessory_hs r join public.accessory_options a on a.id=r.item_id
    cross join input i
    where p_item_type='accessory' and public.normalize_hs_search(r.item_name)=i.name
      and i.material<>'' and i.intended_use<>'' and i.form<>''
      and public.normalize_hs_search(r.material)=i.material
      and public.normalize_hs_search(r.intended_use)=i.intended_use
      and public.normalize_hs_search(coalesce(a.attributes->>'shape',a.attributes->>'form'))=i.form
), ranked as (
  select distinct on (c.code) c.* from combined c
  order by c.code,c.score desc,c.source,c.label,c.term
)
select left(r.code,6),case when length(r.code)=10 then r.code end,r.label,r.source,r.score,r.term
from ranked r order by r.score desc,r.code collate "C" limit 30;
$$;

revoke all on public.hs_search_aliases, public.hs_attribute_definitions from public, anon, authenticated, service_role;
revoke all on function public.normalize_hs_search(text), public.search_hs_candidates(text,text,boolean,text,text,text,text[])
  from public, anon, authenticated, service_role;
create function public.is_official_hs_candidate(p_version uuid,p_hs6 text,p_hsk10 text)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.hs_data_versions v join public.official_hs6 h on h.version_id=v.id
    where v.id=p_version and v.is_active and h.hs6=p_hs6
  ) and (p_hsk10 is null or (p_hsk10 ~ '^[0-9]{10}$' and left(p_hsk10,6)=p_hs6 and exists (
    select 1 from public.hsk_codes where version_id=p_version and code=p_hsk10
  )));
$$;
revoke all on function public.is_official_hs_candidate(uuid,text,text) from public,anon,authenticated,service_role;

commit;
