-- 부속물품 화면 · HS 찾기가 쓰는 함수 (Claude, 11/27)
-- GPT의 로컬 시안 어댑터(local_accessory_action)를 그대로 가져와 이름만 바꾸고,
-- 서류용 칸(영문명 · 설명 · 원산지 · 중량 · CTN)과 식품 HS 찾기를 더했다.
-- 팀 DB에는 권한을 열지 않는다. 로컬 확인은 supabase/local_only/accessory_screen_permissions.sql.
begin;

create function public.accessory_action(p jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare
  operation text := p->>'action';
  parent_id uuid := nullif(p->>'id','')::uuid;
  option_id uuid := nullif(p->>'optionId','')::uuid;
  attrs jsonb := jsonb_strip_nulls(jsonb_build_object('shape',nullif(p->>'shape',''),'size',nullif(p->>'size','')));
  parent public.accessories;
  target public.accessory_options;
  review public.hs_classifications;
  version_id uuid;
  results jsonb;
begin
  if operation='list' then
    return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.item_name,'nameEn',coalesce(a.item_name_en,''),
      'description',coalesce(a.description,''),'archived',a.status='archived',
      'options', coalesce((select jsonb_agg(jsonb_build_object(
        'optionId',o.id,'optionName',coalesce(o.option_name,''),'code',o.management_code,
        'isDefault',o.is_default,'archived',o.archived_at is not null,'material',coalesce(o.material,''),
        'exportSelected',o.export_selected,
        'unitPrice',o.unit_price,'currency',o.currency,
        'origin',coalesce(o.origin,''),'unitWeightG',o.unit_weight_g,'unitsPerCtn',o.units_per_ctn,
        'ctnNetKg',o.ctn_net_kg,'ctnGrossKg',o.ctn_gross_kg,'ctnLcm',o.ctn_l_cm,'ctnWcm',o.ctn_w_cm,'ctnHcm',o.ctn_h_cm,
        'hs6',o.hs6,'hsk10',o.hsk10,'hsCheckedAt',o.hs_checked_at,'hsConfirmedBy',o.hs_confirmed_by,
        'hsClassificationId',o.hs_classification_id,
        'purpose',coalesce(o.intended_use,''),'shape',coalesce(o.attributes->>'shape',o.attributes->>'form',''),
        'size',coalesce(o.attributes->>'size',''),
        'state',case when current_review.status='needs_review' then 'needs_review'
          else coalesce(fs.status,case when o.hs6 is null then 'missing' else 'confirmed' end) end,
        'history',coalesce((select jsonb_agg(jsonb_build_object('hs6',c.chosen_hs6,'hsk10',c.chosen_hsk10,
          'by',c.confirmed_by,'why',c.human_reason,'date',(c.confirmed_at at time zone 'Asia/Seoul')::date,
          'status',c.status,'reason',c.review_reason) order by (c.id=o.hs_classification_id) desc,c.confirmed_at desc)
          from public.hs_classifications c where c.item_type='accessory' and c.item_id=o.id and c.confirmed_at is not null),'[]'))
        order by o.is_default desc,o.created_at,o.id)
        from public.accessory_options o left join public.hs_classifications current_review on current_review.id=o.hs_classification_id
        left join public.field_status fs on fs.entity_type='accessory_option' and fs.entity_id=o.id and fs.field_key='hs6'
        where o.accessory_id=a.id),'[]')) order by a.created_at,a.id) from public.accessories a),'[]');
  end if;
  if operation='create' then
    insert into public.accessories(item_name,item_name_en,description,status)
      values (btrim(p->>'name'),nullif(btrim(p->>'nameEn'),''),nullif(btrim(p->>'description'),''),'active') returning id into parent_id;
    update public.accessory_options set material=nullif(p->>'material',''), intended_use=nullif(p->>'purpose',''),
      attributes=attrs where accessory_id=parent_id and is_default returning id into option_id;
  else
    select * into strict parent from public.accessories where id=parent_id for update;
    if operation in ('archive','restore') then
      perform public.change_accessory_archive(parent_id,option_id,operation='restore',nullif(p->>'replacement','')::uuid);
    elsif parent.status='archived' then
      raise exception 'Accessory is archived';
    elsif operation='rename' then
      update public.accessories set item_name=btrim(p->>'name'),
        item_name_en=case when p ? 'nameEn' then nullif(btrim(p->>'nameEn'),'') else item_name_en end,
        description=case when p ? 'description' then nullif(btrim(p->>'description'),'') else description end
        where id=parent_id;
    elsif operation='add_option' then
      if nullif(btrim(p->>'optionName'),'') is null then raise exception 'Option name is required'; end if;
      if nullif(btrim(p->>'defaultName'),'') is not null then
        update public.accessory_options set option_name=btrim(p->>'defaultName')
        where accessory_id=parent_id and is_default and option_name is null;
      end if;
      insert into public.accessory_options(accessory_id,option_name,material,intended_use,attributes,unit_price,currency)
        values(parent_id,btrim(p->>'optionName'),nullif(p->>'material',''),nullif(p->>'purpose',''),attrs,
          nullif(p->>'unitPrice','')::numeric,nullif(upper(btrim(p->>'currency')),''))
        returning id into option_id;
    else
      select * into strict target from public.accessory_options
        where id=option_id and accessory_id=parent_id and archived_at is null for update;
      if operation='edit_option' then
        update public.accessory_options set option_name=nullif(btrim(p->>'optionName'),''),
          management_code=btrim(p->>'code'), material=nullif(p->>'material',''), intended_use=nullif(p->>'purpose',''),
          attributes=(attributes-'shape'-'form'-'size')||attrs,
          unit_price=case when p ? 'unitPrice' then nullif(p->>'unitPrice','')::numeric else unit_price end,
          currency=case when p ? 'currency' then nullif(upper(btrim(p->>'currency')),'') else currency end
          where id=option_id;
      elsif operation='edit_shipping' then
        -- 서류(CI · PL)용 칸. 빈 칸은 null
        update public.accessory_options set
          origin=nullif(btrim(p->>'origin'),''),
          unit_weight_g=nullif(p->>'unitWeightG','')::numeric, units_per_ctn=nullif(p->>'unitsPerCtn','')::integer,
          ctn_net_kg=nullif(p->>'ctnNetKg','')::numeric, ctn_gross_kg=nullif(p->>'ctnGrossKg','')::numeric,
          ctn_l_cm=nullif(p->>'ctnLcm','')::numeric, ctn_w_cm=nullif(p->>'ctnWcm','')::numeric, ctn_h_cm=nullif(p->>'ctnHcm','')::numeric
          where id=option_id;
      elsif operation='export_selection' then
        perform public.set_accessory_export_selected(option_id,(p->>'selected')::boolean);
      elsif operation='search' then
        select id into strict version_id from public.hs_data_versions where is_active for share;
        select coalesce(jsonb_agg(to_jsonb(s) order by s.score desc,coalesce(s.hsk10,s.hs6) collate "C"),'[]')
          into results from public.search_hs_candidates('accessory',p->>'query',true,
            coalesce(nullif(p->'answers'->>'material',''),target.material),
            coalesce(nullif(p->'answers'->>'purpose',''),target.intended_use),
            coalesce(nullif(p->'answers'->>'shape',''),target.attributes->>'shape',target.attributes->>'form'),
            -- 이름 전체가 안 맞을 때를 위해 띄어쓰기 단위 낱말도 같이 찾는다 (예: "가상 카탈로그" → "카탈로그")
            array(select w from regexp_split_to_table(btrim(p->>'query'),'\s+') w where w<>'')) s;
        insert into public.hs_classifications(item_type,item_id,hs_data_version_id,candidates,input_snapshot)
          values('accessory',option_id,version_id,results,
            jsonb_build_object('option',public.accessory_option_review_input(option_id),'query',p->>'query','answers',p->'answers'))
          returning * into review;
        return jsonb_build_object('reviewId',review.id,'candidates',results);
      elsif operation='confirm' then
        select * into strict review from public.hs_classifications
        where id=(p->>'reviewId')::uuid and item_type='accessory' and item_id=option_id;
        if not exists (select 1 from jsonb_array_elements(review.candidates) c
          where c->>'hs6'=p->>'hs6' and (p->>'hsk10' is null or c->>'hsk10'=p->>'hsk10')) then
          raise exception 'Select a candidate from the current search';
        end if;
        perform public.confirm_hs_classification(review.id,p->>'hs6',p->>'hsk10',p->>'by',p->>'why');
      elsif operation='review' then
        perform public.mark_hs_classification_for_review(target.hs_classification_id,p->>'why');
      elsif operation='hold' then
        if target.hs_classification_id is null then
          insert into public.field_status(entity_type,entity_id,field_key,status,note,updated_at)
            values('accessory_option',option_id,'hs6','on_hold','Review deferred',now())
            on conflict(entity_type,entity_id,field_key) do update
              set status=excluded.status,note=excluded.note,updated_at=excluded.updated_at;
        end if;
      else
        raise exception 'Unknown action';
      end if;
    end if;
  end if;
  return jsonb_build_object('id',parent_id,'optionId',option_id);
end;
$$;

-- 식품(제품) HS 찾기: 후보 검색 → 담당자 확정. 확정은 confirm_hs_classification이 product_export와 field_status를 같이 바꾼다.
create function public.food_hs_action(p jsonb)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare
  operation text := p->>'action';
  product uuid := (p->>'productId')::uuid;
  review public.hs_classifications;
  version_id uuid;
  results jsonb;
begin
  perform 1 from public.products where id=product and status<>'archived';
  if not found then raise exception 'Product not found'; end if;
  if operation='search' then
    select id into strict version_id from public.hs_data_versions where is_active for share;
    select coalesce(jsonb_agg(to_jsonb(s) order by s.score desc,coalesce(s.hsk10,s.hs6) collate "C"),'[]')
      into results from public.search_hs_candidates('food',p->>'query',true,null,null,null,
        array(select w from regexp_split_to_table(btrim(p->>'query'),'\s+') w where w<>''
          union all select jsonb_array_elements_text(coalesce(p->'terms','[]'::jsonb)))) s;
    insert into public.hs_classifications(item_type,item_id,hs_data_version_id,candidates,input_snapshot)
      values('food',product,version_id,results,jsonb_build_object('query',p->>'query','answers',p->'answers','terms',p->'terms'))
      returning * into review;
    return jsonb_build_object('reviewId',review.id,'candidates',results);
  elsif operation='confirm' then
    select * into strict review from public.hs_classifications
      where id=(p->>'reviewId')::uuid and item_type='food' and item_id=product;
    if not exists (select 1 from jsonb_array_elements(review.candidates) c
      where c->>'hs6'=p->>'hs6' and (p->>'hsk10' is null or c->>'hsk10'=p->>'hsk10')) then
      raise exception 'Select a candidate from the current search';
    end if;
    select * into review from public.confirm_hs_classification(review.id,p->>'hs6',p->>'hsk10',p->>'by',p->>'why');
    return jsonb_build_object('hs6',review.chosen_hs6,'hsk10',review.chosen_hsk10,
      'hs_checked_at',(review.confirmed_at at time zone 'Asia/Seoul')::date,'hs_confirmed_by',review.confirmed_by,
      'hs_classification_id',review.id);
  end if;
  raise exception 'Unknown action';
end;
$$;

revoke all on function public.accessory_action(jsonb), public.food_hs_action(jsonb) from public, anon, authenticated, service_role;
commit;
