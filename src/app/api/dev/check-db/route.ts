// DB 연결 점검 (Claude). Supabase를 붙인 뒤 `npm run dev` 상태에서 /api/dev/check-db 를 한 번 열면
// 읽기 · 새 등록 · 수정 · 공용 통로가 실제 DB에서 도는지 순서대로 확인하고, 만든 점검용 제품은 지운다.
// 배포(production)에서는 열리지 않는다. DB가 없으면 예시 데이터로 같은 순서를 돌린다.
import { NextResponse } from 'next/server';
import { db, get_component_library, get_product_detail, get_products } from '@/features/products/data';
import { new_comp, to_form, to_rows, validate } from '@/features/products/form';
import { persist } from '@/features/products/persist';
import { to_shared } from '@/features/products/share';
import * as S from '@/features/products/sample';

function remove_from_sample(pid: string, comp_ids: string[]) {
  const drop = <T,>(arr: T[], gone: (x: T) => boolean) => { const keep = arr.filter((x) => !gone(x)); arr.length = 0; arr.push(...keep); };
  drop(S.sample_products, (p) => p.id === pid);
  drop(S.sample_links, (l) => l.product_id === pid);
  drop(S.sample_components, (c) => comp_ids.includes(c.id));
  drop(S.sample_ingredients, (i) => comp_ids.includes(i.component_id));
  drop(S.sample_packaging, (x) => x.product_id === pid);
  drop(S.sample_export, (e) => e.product_id === pid);
  drop(S.sample_status, (x) => x.entity_id === pid || comp_ids.includes(x.entity_id));
  for (const id of comp_ids) delete S.sample_nutrition[id];
}

type Step = { step: string; ok: boolean; detail?: string };

function test_form(code: string) {
  const f = to_form(null);
  f.code = code;
  f.p.name_ko = '점검용 제품';
  f.p.net_content_value = '120';
  const c = new_comp();
  c.name = '점검용 떡'; c.amount = '100'; c.manufacturer_name = '점검 제조사';
  c.ingredients = '쌀(국산)\n소스\n  간장\n정제소금';
  c.nutrition.kcal = '200'; c.nutrition.sodium_mg = '300';
  f.comps = [c];
  f.packaging = [{ part: '용기', material: 'PP', separable: '분리됨' }];
  f.exp.hs6 = '190230'; f.exp.units_per_ctn = '16';
  f.answers[`component:${c.id}:report_no`] = 'asking_supplier';
  return f;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: '배포 환경에서는 쓸 수 없어요.' }, { status: 404 });
  const code = `check-${Date.now().toString(36)}`;
  const f = test_form(code);
  const errs = validate(f);
  if (errs.length) return NextResponse.json({ ok: false, errors: errs }, { status: 500 });

  const client = db();

  const steps: Step[] = [];
  const run = async (step: string, fn: () => Promise<string | void>) => {
    try { const d = await fn(); steps.push({ step, ok: true, detail: d || undefined }); return true; }
    catch (e) { steps.push({ step, ok: false, detail: e instanceof Error ? e.message : JSON.stringify(e) }); return false; }
  };
  const check = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  await run('제품 목록 읽기', async () => `${(await get_products()).length}개`);
  await run('구성품 목록 읽기', async () => `${(await get_component_library()).length}개`);
  const first = (await get_products().catch(() => []))[0];
  if (first) await run(`제품 상세 읽기 (${first.code})`, async () => {
    const d = await get_product_detail(first.code); check(!!d, '없음');
    return `구성품 ${d!.components.length}개 · 원재료 ${d!.ingredients.length}줄 · 칸 상태 ${d!.statuses.length}개`;
  });

  const ok_new = await run('새 등록 저장', async () => { await persist(to_rows(f, null), f.id); });
  if (ok_new) {
    await run('새 등록 다시 읽기', async () => {
      const d = await get_product_detail(code); check(!!d, '저장한 제품을 못 읽었어요');
      check(d!.components.length === 1, '구성품 수가 달라요');
      check(d!.ingredients.length === 4, `원재료 줄 수가 달라요 (${d!.ingredients.length})`);
      check(d!.ingredients.some((i) => i.parent_id), '하위 원료가 저장되지 않았어요');
      check(Number(d!.components[0].nutrition?.kcal) === 200, '영양성분이 달라요');
      check(d!.packaging.length === 1 && d!.exportInfo?.hs6 === '190230', '포장 · 수출 정보가 달라요');
      const st = d!.statuses.find((s) => s.field_key === 'report_no');
      check(st?.status === 'missing' && st.wait_reason === 'asking_supplier', '기다리는 칸 상태가 달라요');
      check(d!.statuses.find((s) => s.field_key === 'manufacturer_name')?.status === 'confirmed', '사람이 적은 값이 확인됨이 아니에요');
    });
    await run('수정 저장 (이름 · 원재료 바꾸기)', async () => {
      const before = await get_product_detail(code);
      const e = to_form(before);
      e.p.name_ko = '점검용 제품 (수정)'; e.p.name_en = 'Check Product';
      e.comps[0].ingredients = '쌀(국산)\n정제소금';
      await persist(to_rows(e, before), e.id);
      const d = await get_product_detail(code);
      check(d!.product.name_ko === '점검용 제품 (수정)', '이름이 안 바뀌었어요');
      check(d!.ingredients.length === 2, `원재료가 안 바뀌었어요 (${d!.ingredients.length}줄)`);
      check(d!.statuses.find((s) => s.field_key === 'name_en')?.status === 'confirmed', '새로 적은 칸이 확인됨이 아니에요');
      check(d!.statuses.find((s) => s.field_key === 'report_no')?.wait_reason === 'asking_supplier', '손대지 않은 기다리는 칸이 바뀌었어요');
    });
    await run('다른 탭 통로 (라벨용)', async () => {
      const d = await get_product_detail(code);
      const s = to_shared(d!, { for: '라벨', external: true });
      return `칸 ${s.fields.length}개 · 바로 쓸 수 있는 값 ${s.summary.usable}개`;
    });
  }

  // 점검용 제품 지우기 (구성품은 이 제품만 쓰므로 같이 지움)
  await run('점검용 제품 지우기', async () => {
    if (!client) { remove_from_sample(f.id, f.comps.map((c) => c.id)); return; }
    const { data: p } = await client.from('products').select('id').eq('code', code).maybeSingle();
    if (!p) return '저장된 것이 없어요';
    const comp_ids = f.comps.map((c) => c.id);
    for (const r of [
      await client.from('field_status').delete().in('entity_id', [p.id, ...comp_ids]),
      await client.from('products').delete().eq('id', p.id),
      await client.from('components').delete().in('id', comp_ids),
    ]) if (r.error) throw r.error;
  });

  const ok = steps.every((s) => s.ok);
  return NextResponse.json({ connected: !!client, mode: client ? 'Supabase' : '예시 데이터 (NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 없음)', ok, steps }, { status: ok ? 200 : 500 });
}
