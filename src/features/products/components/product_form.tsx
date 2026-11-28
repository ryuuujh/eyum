'use client';
// 제품 등록 · 수정 화면 (Claude): 가로 탭 5개 + 탭마다 빈 칸 수
import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import { Field, TabBar, ui } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { LABEL_ITEMS, LABEL_PACK_LABEL, NUTRIENT_KEYS, type LabelItemKey, type LabelPackLevel, type Nutrition, type ProductComponent } from '@/features/products/types';
import { ANSWER_LABEL, composite_text, new_comp, status_key, tracked_fields, type Answer, type CompForm, type ProductForm as Form } from '@/features/products/form';
import { COMPONENT_FIELDS, EXPORT_FIELDS, PRODUCT_FIELDS, FORM_TAB_LABEL, form_tab_of, type FieldDef, type FormTab } from '@/features/products/fields';
import { calc_nutrition } from '@/features/products/nutrition';
import { save_product } from '@/features/products/save';

type TabKey = FormTab;
const TABS = Object.entries(FORM_TAB_LABEL) as [TabKey, string][];
const tab_of = form_tab_of;

// 제품 칸과 구성품 칸은 이름이 겹칠 수 있어(manufacturer_name) 따로 찾는다
const DEF: Record<string, FieldDef> = Object.fromEntries([...PRODUCT_FIELDS, ...EXPORT_FIELDS].map((d) => [d.key, d]));
const CDEF: Record<string, FieldDef> = Object.fromEntries(COMPONENT_FIELDS.map((d) => [d.key, d]));
const NUT_LABEL: Record<keyof Nutrition, string> = {
  kcal: '열량 (kcal)', sodium_mg: '나트륨 (mg)', carb_g: '탄수화물 (g)', sugar_g: '당류 (g)', fat_g: '지방 (g)', sat_fat_g: '포화지방 (g)',
  trans_fat_g: '트랜스지방 (g)', cholesterol_mg: '콜레스테롤 (mg)', protein_g: '단백질 (g)', fiber_g: '식이섬유 (g)',
};

export type StatusHint = Record<string, { status: string; note: string | null }>;

const input = ui.input;

type Ctx = { f: Form; hints: StatusHint; setA: (k: string, a: Answer) => void; setP: (k: keyof Form['p'], v: string) => void; setE: (k: keyof Form['exp'], v: string) => void };
const FormCtx = createContext<Ctx | null>(null);
const useCtx = () => useContext(FormCtx)!;

/** 칸 아래 안내: 비었으면 찾아볼 곳 + 답변 선택, 확인 필요면 메모 + "맞아요" */
function Under({ entity, id, k, value }: { entity: 'product' | 'component'; id: string; k: string; value: string }) {
  const { f, hints, setA } = useCtx();
  const key = status_key(entity, id, k);
  const a = f.answers[key] ?? '';
  const h = hints[key];
  const def = entity === 'component' ? CDEF[k] : DEF[k];
  if (value.trim() === '' || value === '미확인') {
    if (def?.optional) return null;   // 선택 칸은 빈 칸 답변을 묻지 않음
    const where = def?.hint?.split(' · ').slice(1).join(' · ');
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {where && a === '' && <span>{where}</span>}
        <select value={a === 'confirm' ? '' : a} onChange={(e) => setA(key, e.target.value as Answer)}
          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600">
          <option value="">바로 못 채우면 선택</option>
          {Object.entries(ANSWER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    );
  }
  if (h?.status === 'needs_check') {
    return (
      <label className="mt-1.5 flex items-start gap-2 text-xs text-amber-700">
        <input type="checkbox" checked={a === 'confirm'} onChange={(e) => setA(key, e.target.checked ? 'confirm' : '')} />
        <span className="whitespace-nowrap">맞아요</span>{h.note && <span className="text-slate-500">· 확인할 점: {h.note}</span>}
      </label>
    );
  }
  return null;
}

const ph = (k: string) => DEF[k]?.hint?.split(' · ')[0];
function PText({ k, label, span, area, optional }: { k: keyof Form['p']; label: string; span?: 1 | 2 | 3; area?: boolean; optional?: boolean }) {
  const { f, setP } = useCtx();
  return (
  <Field label={label} span={span} optional={optional}>
    {area
      ? <textarea rows={2} className={input} value={f.p[k]} placeholder={ph(k)} onChange={(e) => setP(k, e.target.value)} />
      : <input className={input} value={f.p[k]} placeholder={ph(k)} onChange={(e) => setP(k, e.target.value)} />}
    {DEF[k] && <Under entity="product" id={f.id} k={k} value={f.p[k]} />}
  </Field>
  );
}
function ENum({ k, label, unit }: { k: keyof Form['exp']; label: string; unit?: string }) {
  const { f, setE } = useCtx();
  return (
  <Field label={label} optional={!DEF[k]}>
    <div className="flex items-center gap-2">
      <input className={input} inputMode="decimal" value={f.exp[k]} onChange={(e) => setE(k, e.target.value)} />
      {unit && <span className="text-sm text-slate-500">{unit}</span>}
    </div>
    {DEF[k] && <Under entity="product" id={f.id} k={k} value={f.exp[k]} />}
  </Field>
  );
}


export type LibraryItem = { id: string; name: string; usedBy: { code: string; name: string }[]; form: CompForm; hints: StatusHint };

export function ProductForm({ initial, hints: initialHints, library = [], initialTab = 'basic' }: { initial: Form; hints: StatusHint; library?: LibraryItem[]; initialTab?: FormTab }) {
  const [f, setF] = useState(initial);
  const [hints, setHints] = useState(initialHints);
  const [pick, setPick] = useState('');
  const others = (id: string) => library.find((l) => l.id === id)?.usedBy.filter((u) => u.code !== f.code) ?? [];
  const available = library.filter((l) => !f.comps.some((c) => c.id === l.id));
  const add_from_library = (id: string) => {
    const l = library.find((x) => x.id === id); if (!l) return;
    setF((x) => ({ ...x, comps: [...x.comps.filter((c) => c.name.trim() || c.amount.trim() || !c.isNew), { ...l.form }] }));
    setHints((h) => ({ ...h, ...l.hints }));
    setPick('');
  };
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  const tracked = useMemo(() => tracked_fields(f), [f]);
  const empty_by_tab = useMemo(() => {
    const m: Record<TabKey, number> = { basic: 0, comps: 0, nutrition: 0, label: 0, export: 0 };
    for (const t of tracked) {
      const a = f.answers[status_key(t.entity, t.id, t.def.key)];
      if (t.value === '' && a !== 'not_applicable' && !t.def.optional) m[tab_of(t.entity, t.def.key)]++;
    }
    for (const c of f.comps) if (NUTRIENT_KEYS.slice(0, 6).concat('protein_g').some((k) => c.nutrition[k] === '')) m.nutrition++;
    return m;
  }, [tracked, f]);

  const set_p = (k: keyof Form['p'], v: string) => setF((x) => ({ ...x, p: { ...x.p, [k]: v } }));
  const set_e = (k: keyof Form['exp'], v: string) => setF((x) => ({ ...x, exp: { ...x.exp, [k]: v } }));
  const set_c = (i: number, patch: Partial<CompForm>) => setF((x) => ({ ...x, comps: x.comps.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const set_a = (key: string, a: Answer) => setF((x) => ({ ...x, answers: { ...x.answers, [key]: a } }));

  const nutrition_preview = useMemo(() => {
    const items: ProductComponent[] = f.comps.filter((c) => Number(c.amount) > 0).map((c, i) => ({
      component: { id: c.id, name: c.name, unit_weight_g: c.unit_weight_g ? Number(c.unit_weight_g) : null } as ProductComponent['component'],
      nutrition: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, c.nutrition[k] === '' ? null : Number(c.nutrition[k])])) as unknown as Nutrition,
      amount: Number(c.amount), unit: c.unit, quantity: Number(c.quantity) || 1, sort_order: i,
    }));
    return calc_nutrition(items, f.p.servings_per_pack ? Number(f.p.servings_per_pack) : null);
  }, [f.comps, f.p.servings_per_pack]);

  const submit = () => start(async () => {
    setErrors([]);
    const r = await save_product(f);
    if (!r.ok) { setErrors(r.errors); return; }
    router.push(`/products/${r.code}`);
    router.refresh();
  });

  return (
    <FormCtx.Provider value={{ f, hints, setA: set_a, setP: set_p, setE: set_e }}>
      <TabBar tabs={TABS.map(([k, label]) => ({ key: k, label, count: empty_by_tab[k] > 0 ? `빈 칸 ${empty_by_tab[k]}` : undefined }))} value={tab} onChange={setTab} />

      <div className="mt-6 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        {tab === 'basic' && (
          <div className="grid gap-5 sm:grid-cols-3">
            <PText k="name_ko" label="제품명" />
            <PText k="name_en" label="영문 제품명" span={2} />
            <Field label="총 내용량">
              <div className="flex gap-2">
                <input className={input} inputMode="decimal" value={f.p.net_content_value} onChange={(e) => set_p('net_content_value', e.target.value)} />
                <select className={`${input} w-24`} value={f.p.net_content_unit} onChange={(e) => set_p('net_content_unit', e.target.value)}>
                  {['g', 'kg', 'mL', 'L'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <Under entity="product" id={f.id} k="net_content_value" value={f.p.net_content_value} />
            </Field>
            <PText optional k="net_content_note" label="내용량 비고" />
            <div />
            <PText optional k="serving_desc" label="1회 제공량" />
            <PText optional k="servings_per_pack" label="한 봉 몇 회 제공량" />
            <div />
            <Field label="보관 조건">
              <select className={input} value={f.p.storage_condition} onChange={(e) => set_p('storage_condition', e.target.value)}>
                <option value="">선택</option>{['상온', '냉장', '냉동'].map((v) => <option key={v}>{v}</option>)}
              </select>
              <Under entity="product" id={f.id} k="storage_condition" value={f.p.storage_condition} />
            </Field>
            <Field label="기한 종류">
              <select className={input} value={f.p.date_type} onChange={(e) => set_p('date_type', e.target.value)}>
                <option value="">선택</option>{['소비기한', '품질유지기한'].map((v) => <option key={v}>{v}</option>)}
              </select>
              <Under entity="product" id={f.id} k="date_type" value={f.p.date_type} />
            </Field>
            <PText k="date_period" label="기한" />
            <PText k="manufacturer_name" label="완제품 제조원" span={2} />
            <PText k="finished_country" label="완제품 제조국" />
          </div>
        )}

        {tab === 'comps' && (
          <div className="space-y-8">
            {f.comps.map((c, i) => (
              <div key={c.id} className={i ? 'border-t border-slate-200 pt-8' : ''}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{c.name || `구성품 ${i + 1}`}</h3>
                    {others(c.id).length > 0 && (
                      <p className="mt-0.5 text-xs text-amber-700">{others(c.id).map((u) => u.name).join(', ')}에도 쓰는 구성품이에요. 여기서 고치면 같이 바뀌어요. (양 · 봉 수는 제품마다 따로)</p>
                    )}
                  </div>
                  {f.comps.length > 1 && <button className="text-sm text-slate-500 hover:text-rose-600" onClick={() => setF((x) => ({ ...x, comps: x.comps.filter((_, j) => j !== i) }))}>빼기</button>}
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="구성품 이름"><input className={input} value={c.name} placeholder="예: 조랭이떡" onChange={(e) => set_c(i, { name: e.target.value })} /></Field>
                  <Field label="한 봉 양">
                    <div className="flex gap-2">
                      <input className={input} inputMode="decimal" value={c.amount} onChange={(e) => set_c(i, { amount: e.target.value })} />
                      <select className={`${input} w-20`} value={c.unit} onChange={(e) => set_c(i, { unit: e.target.value as 'g' | 'mL' })}><option>g</option><option>mL</option></select>
                    </div>
                  </Field>
                  <Field label="들어가는 봉 수"><input className={input} inputMode="numeric" value={c.quantity} onChange={(e) => set_c(i, { quantity: e.target.value })} /></Field>
                  <Field label="구성품 제조원" span={2} optional>
                    <input className={input} value={c.manufacturer_name} onChange={(e) => set_c(i, { manufacturer_name: e.target.value })} />
                    <Under entity="component" id={c.id} k="manufacturer_name" value={c.manufacturer_name} />
                  </Field>
                  <Field label="라벨에 제조원 표시">
                    <select className={input} value={c.manufacturer_public} onChange={(e) => set_c(i, { manufacturer_public: e.target.value as CompForm['manufacturer_public'] })}>
                      <option value="">모름</option><option value="yes">표시함</option><option value="no">표시 안 함 (내부만)</option>
                    </select>
                  </Field>
                  <Field label="품목보고번호">
                    <input className={input} value={c.report_no} onChange={(e) => set_c(i, { report_no: e.target.value })} />
                    <Under entity="component" id={c.id} k="report_no" value={c.report_no} />
                  </Field>
                  <Field label="식품유형">
                    <input className={input} value={c.food_type_kr} placeholder="예: 떡류" onChange={(e) => set_c(i, { food_type_kr: e.target.value })} />
                    <Under entity="component" id={c.id} k="food_type_kr" value={c.food_type_kr} />
                  </Field>
                  {c.unit === 'mL' ? (
                    <Field label="한 포 실중량 (g)">
                      <input className={input} inputMode="decimal" value={c.unit_weight_g} onChange={(e) => set_c(i, { unit_weight_g: e.target.value })} />
                      <Under entity="component" id={c.id} k="unit_weight_g" value={c.unit_weight_g} />
                    </Field>
                  ) : <div />}
                  <Field label="원재료 (한 줄에 하나, 라벨 순서대로)" span={3}>
                    <textarea rows={4} className={`${input} font-mono`} value={c.ingredients} placeholder={'쌀가루(태국산) / Rice flour\n기장가루(프랑스산) / Millet flour'} onChange={(e) => set_c(i, { ingredients: e.target.value })} />
                    <p className="mt-1 text-xs text-slate-500">영문 원재료명은 선택이에요. 이름 뒤에 &quot; / Rice flour&quot;처럼 적어요. 하위 원료는 앞에 칸을 띄우거나 &quot;-&quot;로 시작해요.</p>
                    <Under entity="component" id={c.id} k="ingredients" value={c.ingredients} />
                  </Field>
                  <Field label="동물성 원료">
                    <select className={input} value={c.animal_ingredient} onChange={(e) => set_c(i, { animal_ingredient: e.target.value as CompForm['animal_ingredient'] })}>
                      {['미확인', '없음', '있음'].map((v) => <option key={v}>{v}</option>)}
                    </select>
                    <Under entity="component" id={c.id} k="animal_ingredient" value={c.animal_ingredient} />
                  </Field>
                  {c.animal_ingredient === '있음'
                    ? <Field label="동물성 원료 내용" optional><input className={input} value={c.animal_ingredient_detail} placeholder="예: 우유(유청분말)" onChange={(e) => set_c(i, { animal_ingredient_detail: e.target.value })} /></Field>
                    : <div />}
                  <Field label="교차접촉 알레르기"><input className={input} value={c.cross_contact} placeholder="예: 같은 시설에서 대두·밀 사용" onChange={(e) => set_c(i, { cross_contact: e.target.value })} />
                    <Under entity="component" id={c.id} k="cross_contact" value={c.cross_contact} /></Field>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-[#2f5bd3] hover:text-[#2f5bd3]"
                onClick={() => setF((x) => ({ ...x, comps: [...x.comps, new_comp()] }))}>+ 새 구성품</button>
              {available.length > 0 && (
                <select value={pick} onChange={(e) => add_from_library(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                  <option value="">+ 기존 구성품 불러오기</option>
                  {available.map((l) => <option key={l.id} value={l.id}>{l.name}{l.usedBy.length ? ` (${l.usedBy.map((u) => u.name).join(', ')})` : ''}</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        {tab === 'nutrition' && (
          <div>
            <p className="mb-4 text-sm text-slate-500">시험성적서 값을 구성품별로 100g(액체는 100mL) 기준으로 넣으면 제품 값은 자동으로 합산돼요.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">성분</th>
                    {f.comps.map((c) => <th key={c.id} className="px-2 py-2 font-medium">{c.name || '구성품'} <span className="font-normal">({c.unit === 'mL' ? '100mL' : '100g'}당)</span></th>)}
                    <th className="whitespace-nowrap px-2 py-2 font-medium text-[#2f5bd3]">제품 전체</th>
                  </tr>
                </thead>
                <tbody>
                  {NUTRIENT_KEYS.map((k) => (
                    <tr key={k} className="border-t border-slate-100">
                      <td className="whitespace-nowrap py-1.5 pr-3 text-slate-600">{NUT_LABEL[k]}</td>
                      {f.comps.map((c, i) => (
                        <td key={c.id} className="px-2 py-1.5">
                          <input className={`${input} py-1.5`} inputMode="decimal" value={c.nutrition[k]} onChange={(e) => set_c(i, { nutrition: { ...c.nutrition, [k]: e.target.value } })} />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 font-semibold">{nutrition_preview.total[k] == null ? '—' : Math.round(nutrition_preview.total[k]! * 100) / 100}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200">
                    <td className="py-3 pr-3 align-top text-slate-600">영양성분 자료</td>
                    {f.comps.map((c, i) => (
                      <td key={c.id} className="px-2 py-3 align-top">
                        <input className={`${input} py-1.5`} value={c.nutrition_source} placeholder="예: 시험성적서 · 기관 · 날짜" onChange={(e) => set_c(i, { nutrition_source: e.target.value })} />
                        <Under entity="component" id={c.id} k="nutrition_source" value={c.nutrition_source} />
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            {nutrition_preview.heldReasons.length > 0 && <p className="mt-3 text-xs text-amber-700">100g당 값은 보류돼요: {nutrition_preview.heldReasons.join(' / ')}</p>}
          </div>
        )}

        {tab === 'label' && (
          <div className="grid gap-5 sm:grid-cols-3">
            <PText k="gtin" label="바코드" />
            <Field label="할랄 인증">
              <select className={input} value={f.p.halal} onChange={(e) => set_p('halal', e.target.value)}>
                {['미확인', '없음', '있음'].map((v) => <option key={v}>{v}</option>)}
              </select>
              <Under entity="product" id={f.id} k="halal" value={f.p.halal} />
            </Field>
            <div />
            <PText k="storage_text" label="보관 방법" span={3} />
            <PText k="cooking_en" label="조리방법" span={3} area />
            <PText optional k="caution_en" label="주의 문구" span={3} area />
            <PText optional k="claims" label="강조 표시 · 인증 마크" span={3} />
            <div className="sm:col-span-3">
              <div className="mb-1 text-sm font-medium text-slate-700">포장 재질 <span className="font-normal text-slate-400">(선택)</span></div>
              <p className="mb-2 text-xs text-slate-500">부위별로 적어 주세요. 분리배출 표시가 필요한 나라에서 써요.</p>
              {f.packaging.map((x, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_10rem_auto] gap-2">
                  <input className={input} placeholder="부위 (예: 용기)" value={x.part} onChange={(e) => setF((y) => ({ ...y, packaging: y.packaging.map((z, j) => (j === i ? { ...z, part: e.target.value } : z)) }))} />
                  <input className={input} placeholder="재질 (예: PP)" value={x.material} onChange={(e) => setF((y) => ({ ...y, packaging: y.packaging.map((z, j) => (j === i ? { ...z, material: e.target.value } : z)) }))} />
                  <select className={input} value={x.separable} onChange={(e) => setF((y) => ({ ...y, packaging: y.packaging.map((z, j) => (j === i ? { ...z, separable: e.target.value as '' } : z)) }))}>
                    <option value="">개봉 시 분리</option><option>분리됨</option><option>붙어 있음</option>
                  </select>
                  <button className="px-2 text-sm text-slate-400 hover:text-rose-600" onClick={() => setF((y) => ({ ...y, packaging: y.packaging.filter((_, j) => j !== i) }))}>빼기</button>
                </div>
              ))}
              <button className="text-sm text-[#2f5bd3]" onClick={() => setF((y) => ({ ...y, packaging: [...y.packaging, { part: '', material: '', separable: '' }] }))}>+ 부위 추가</button>
            </div>
            <Field label="포장 크기 (가로 × 세로 × 높이 mm)" span={2}>
              <div className="flex gap-2">
                {(['pack_w_mm', 'pack_d_mm', 'pack_h_mm'] as const).map((k) => <input key={k} className={input} inputMode="decimal" value={f.p[k]} onChange={(e) => set_p(k, e.target.value)} />)}
              </div>
              <Under entity="product" id={f.id} k="pack_size" value={composite_text(f.p, 'pack_size')} />
            </Field>
            <Field label="라벨 부착 면적 (가로 × 세로 mm)">
              <div className="flex gap-2">
                {(['label_w_mm', 'label_h_mm'] as const).map((k) => <input key={k} className={input} inputMode="decimal" value={f.p[k]} onChange={(e) => set_p(k, e.target.value)} />)}
              </div>
              <Under entity="product" id={f.id} k="label_size" value={composite_text(f.p, 'label_size')} />
            </Field>
            <Field label="외박스 라벨 부착 면적 (가로 × 세로 mm)" optional>
              <div className="flex gap-2">
                {(['outer_label_w_mm', 'outer_label_h_mm'] as const).map((k) => <input key={k} className={input} inputMode="decimal" value={f.p[k]} onChange={(e) => set_p(k, e.target.value)} />)}
              </div>
            </Field>
            <div className="sm:col-span-3">
              <div className="mb-1 text-sm font-medium text-slate-700">기존 라벨 문구 <span className="font-normal text-slate-400">(선택)</span></div>
              <p className="mb-2 text-xs text-slate-500">이미 만든 라벨(영어 · 중국어 등)의 문구를 항목별로 그대로 붙여 넣어 주세요. 라벨 탭이 번역 · 비교에 써요. 제조원 · 수출자 · 수입자 문구(주소)는 외부 공유와 AI 전송에서 빠져요.</p>
              {f.labels.map((x, i) => {
                const set_l = (patch: Partial<Form['labels'][number]>) => setF((y) => ({ ...y, labels: y.labels.map((z, j) => (j === i ? { ...z, ...patch } : z)) }));
                return (
                  <div key={i} className="mb-2 grid grid-cols-[7rem_7rem_9rem_1fr_9rem_auto] gap-2">
                    <input className={input} placeholder="언어 (예: 영어)" value={x.language} onChange={(e) => set_l({ language: e.target.value })} />
                    <select className={input} value={x.pack_level} onChange={(e) => set_l({ pack_level: e.target.value as LabelPackLevel })}>
                      {Object.entries(LABEL_PACK_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select className={input} value={x.item_key} onChange={(e) => set_l({ item_key: e.target.value as LabelItemKey })}>
                      {Object.entries(LABEL_ITEMS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <textarea rows={1} className={input} placeholder="라벨 원문" value={x.text} onChange={(e) => set_l({ text: e.target.value })} />
                    <input className={input} placeholder="출처 (예: 테스트용 영문 라벨)" value={x.source} onChange={(e) => set_l({ source: e.target.value })} />
                    <button className="px-2 text-sm text-slate-400 hover:text-rose-600" onClick={() => setF((y) => ({ ...y, labels: y.labels.filter((_, j) => j !== i) }))}>빼기</button>
                  </div>
                );
              })}
              <button className="text-sm text-[#2f5bd3]" onClick={() => setF((y) => ({ ...y, labels: [...y.labels, { language: y.labels.at(-1)?.language ?? '영어', pack_level: 'unit', item_key: 'product_name', text: '', source: y.labels.at(-1)?.source ?? '' }] }))}>+ 문구 추가</button>
            </div>
          </div>
        )}

        {tab === 'export' && (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="HS 6자리">
              <input className={input} inputMode="numeric" maxLength={6} value={f.exp.hs6} placeholder="예: 190190" onChange={(e) => set_e('hs6', e.target.value)} />
              <Under entity="product" id={f.id} k="hs6" value={f.exp.hs6} />
            </Field>
            <Field label="단가 (내부만)">
              <div className="flex gap-2">
                <input className={input} inputMode="decimal" value={f.exp.unit_price} onChange={(e) => set_e('unit_price', e.target.value)} />
                <select className={`${input} w-24`} value={f.exp.currency} onChange={(e) => set_e('currency', e.target.value)}>
                  <option value="">통화</option>{['USD', 'EUR', 'SGD', 'KRW'].map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <Under entity="product" id={f.id} k="unit_price" value={f.exp.unit_price} />
              <Under entity="product" id={f.id} k="currency" value={f.exp.currency} />
            </Field>
            <ENum k="units_per_ctn" label="입수 (1 CTN)" unit="개" />
            <ENum k="unit_gross_g" label="1개당 총중량 (포장 포함)" unit="g" />
            <ENum k="ctn_net_kg" label="CTN 순중량" unit="kg" />
            <ENum k="ctn_gross_kg" label="CTN 총중량" unit="kg" />
            <Field label="CTN 크기 (가로 × 세로 × 높이 cm)" span={2}>
              <div className="flex gap-2">
                {(['ctn_l_cm', 'ctn_w_cm', 'ctn_h_cm'] as const).map((k) => <input key={k} className={input} inputMode="decimal" value={f.exp[k]} onChange={(e) => set_e(k, e.target.value)} />)}
              </div>
              <Under entity="product" id={f.id} k="ctn_size" value={composite_text(f.exp, 'ctn_size')} />
            </Field>
            <div />
            <Field label="팔레트 (가로 × 세로 cm · 단수)" span={2} optional>
              <div className="flex gap-2">
                {(['pallet_l_cm', 'pallet_w_cm', 'pallet_layers'] as const).map((k) => <input key={k} className={input} inputMode="decimal" value={f.exp[k]} onChange={(e) => set_e(k, e.target.value)} />)}
              </div>
            </Field>
            <ENum k="pallet_ctn_count" label="팔레트 적재" unit="상자" />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="mt-6 flex items-center justify-end gap-3">
        <span className="text-xs text-slate-500">비어 있어도 저장할 수 있어요.</span>
        <button onClick={() => router.back()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">취소</button>
        <button onClick={submit} disabled={pending} className="rounded-md bg-[#2f5bd3] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? '저장 중…' : '저장'}
        </button>
      </div>
    </FormCtx.Provider>
  );
}
