// 엑셀 내려받기 2종 (Claude)
// ① 제품 정보 정리본: 값만 (상태 · 근거 · 칸 ID 없음). 기업 보관 · 외부 공유용
// ② 기업 요청 목록: 비어 있거나 확인이 필요한 칸만. 답변 선택 + 기입란, 숨긴 칸 ID로 다시 올리기
// external = 외부 공유용: 단가 · 라벨에 안 나오는 위탁 제조사를 뺀다 (주소는 제품 칸에 저장하지 않음)
import 'server-only';
import ExcelJS from 'exceljs';
import { STATUS_LABEL, WAIT_REASON_LABEL, type Nutrition } from '@/features/products/types';
import type { ProductDetail } from './data';
import { calc_nutrition } from './nutrition';
import { build_detail_view, type TodoItem } from './view';
import { format_hs_code } from './hs_format';

const FONT = '맑은 고딕';
const NAVY = 'FF1D2B4F', GREY = 'FF5D6574', LINE = 'FFE1E5ED', INPUT = 'FFFFF8E1', SUM = 'FFF1F4F9';
const DASH = '—';
const HIDDEN = '외부 공유용이라 뺐어요';

type Cell = string | number | null | undefined;
const v = (x: Cell) => (x == null || x === '' || x === '미확인' ? DASH : x);
const today = () => new Date().toISOString().slice(0, 10);
const r2 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 100) / 100);

function title(ws: ExcelJS.Worksheet, text: string, sub?: string) {
  ws.addRow([text]).font = { name: FONT, size: 14, bold: true };
  if (sub) ws.addRow([sub]).font = { name: FONT, size: 9, color: { argb: GREY } };
  ws.addRow([]);
}

function table(ws: ExcelJS.Worksheet, headers: string[], rows: Cell[][], widths: number[], opt: { group?: number; num?: number[] } = {}) {
  const h = ws.addRow(headers);
  h.eachCell((c) => { c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; });
  h.height = 20;
  const header_row = h.number;
  let prev: Cell = undefined;
  for (const r of rows) {
    const vals = r.map((x, i) => (opt.num?.includes(i) && typeof x === 'number' ? x : v(x)));
    if (opt.group != null) { const g = vals[opt.group]; if (g === prev) vals[opt.group] = ''; else prev = g; }
    const row = ws.addRow(vals);
    row.eachCell({ includeEmpty: true }, (c, i) => {
      c.font = { name: FONT, size: 10, bold: opt.group === i - 1 && c.value !== '' };
      c.alignment = { vertical: 'top', wrapText: true, horizontal: opt.num?.includes(i - 1) && typeof c.value === 'number' ? 'right' : undefined };
      c.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      if (opt.num?.includes(i - 1) && typeof c.value === 'number') c.numFmt = '#,##0.00';
    });
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: header_row, showGridLines: false }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
}

const file_name = (d: ProductDetail, kind: string) => `${d.product.name_ko}_${kind}_${today().replace(/-/g, '')}.xlsx`;

// ---------- ① 정리본 ----------
export const SUMMARY_PARTS = [
  { key: 'basic', label: '기본 정보' }, { key: 'comps', label: '구성품' }, { key: 'ingredients', label: '원재료' },
  { key: 'nutrition', label: '영양성분' }, { key: 'label', label: '표시 정보' }, { key: 'export', label: '수출 · 물류' },
] as const;

/** parts: 넣을 시트 key 목록 (없으면 전부) */
export async function summary_workbook(d: ProductDetail, external: boolean, parts?: string[]) {
  const want = (k: string) => !parts?.length || parts.includes(k);
  const p = d.product;
  const e = d.exportInfo;
  const wb = new ExcelJS.Workbook();
  const sub = `${today()} 기준${external ? ' · 외부 공유용' : ''}`;
  const comps = d.components;
  const mfr = (c: (typeof comps)[number]['component']) => (external && c.manufacturer_public === false ? HIDDEN : c.manufacturer_name);
  const amt = (pc: (typeof comps)[number]) => `${pc.amount} ${pc.unit} × ${pc.quantity}`;

  let ws: ExcelJS.Worksheet;
  if (want('basic')) {
  ws = wb.addWorksheet('기본 정보');
  title(ws, `${p.name_ko} 기본 정보`, sub);
  table(ws, ['항목', '내용'], [
    ['제품명 (국문)', p.name_ko], ['제품명 (영문)', p.name_en],
    ['구성', comps.map((c) => `${c.component.name} ${amt(c)}`).join(' · ')],
    ['총 내용량', p.net_content_value != null ? `${p.net_content_value} ${p.net_content_unit ?? ''}${p.net_content_note ? ` (${p.net_content_note})` : ''}` : null],
    ['1회 제공량', p.serving_desc ? `${p.serving_desc}${p.servings_per_pack ? ` (총 ${p.servings_per_pack}회)` : ''}` : null],
    ['보관 조건', p.storage_condition], ['기한', p.date_period ? `${p.date_type ?? ''} ${p.date_period}`.trim() : null],
    ['완제품 제조원', p.manufacturer_name], ['완제품 제조국', p.finished_country], ['바코드 (GTIN)', p.gtin], ['할랄 인증', p.halal],
  ], [22, 64]);

  }
  if (want('comps')) {
  ws = wb.addWorksheet('구성품');
  title(ws, '구성품 정보', sub);
  table(ws, ['구성품', '항목', '내용'], comps.flatMap(({ component: c, ...pc }) => [
    [c.name, '중량 · 수량', amt({ component: c, ...pc })], [c.name, '제조원', mfr(c)], [c.name, '품목보고번호', c.report_no],
    [c.name, '식품유형', c.food_type_kr], [c.name, '동물성 가공원료', c.animal_ingredient === '있음' ? `있음 (${c.animal_ingredient_detail ?? ''})` : c.animal_ingredient],
    [c.name, '교차접촉 알레르기', c.cross_contact],
    ...(pc.unit === 'mL' ? [[c.name, '한 포 실중량', c.unit_weight_g != null ? `${c.unit_weight_g} g` : null]] : []),
    [c.name, '영양성분 자료', c.nutrition_source],
  ]), [18, 22, 48], { group: 0 });

  }
  if (want('ingredients')) {
  ws = wb.addWorksheet('원재료');
  title(ws, '원재료 (구성품별, 많이 든 순)', sub);
  table(ws, ['구성품', '순서', '원재료', '원산지', '첨가물 용도 · INS', '알레르기'], comps.flatMap(({ component: c }) => {
    const list = d.ingredients.filter((i) => i.component_id === c.id && !i.parent_id).sort((a, b) => a.seq - b.seq);
    if (!list.length) return [[c.name, null, null, null, null, null]];
    const all = d.ingredients.filter((i) => i.component_id === c.id);
    const line = (i: (typeof all)[number], no: string, name: string) => [c.name, no, name, i.origin, [i.additive_function, i.ins_no && `INS ${i.ins_no}`].filter(Boolean).join(' · '), i.allergens.join(', ')];
    return list.flatMap((i) => [line(i, String(i.seq), i.name),
      ...all.filter((k) => k.parent_id === i.id).sort((a, b) => a.seq - b.seq).map((k) => line(k, `${i.seq}-${k.seq}`, `  └ ${k.name}`))]);
  }), [18, 8, 20, 14, 24, 16], { group: 0 });

  }
  if (want('nutrition')) {
  ws = wb.addWorksheet('영양성분');
  title(ws, '영양성분', sub);
  const n = calc_nutrition(comps, p.servings_per_pack);
  const keys: (keyof Nutrition)[] = ['kcal', 'sodium_mg', 'carb_g', 'sugar_g', 'fat_g', 'sat_fat_g', 'trans_fat_g', 'cholesterol_mg', 'protein_g'];
  const num = keys.map((_, i) => i + 2);
  const rows: Cell[][] = [
    ...comps.map((pc) => [pc.component.name, pc.unit === 'mL' ? '100mL당' : '100g당', ...keys.map((k) => r2(pc.nutrition?.[k]))]),
    ['제품 전체', '합산', ...keys.map((k) => r2(n.total[k]))],
    ...(p.servings_per_pack ? [[p.serving_desc ?? '1회 제공량', `합산 ÷ ${p.servings_per_pack}`, ...keys.map((k) => r2(n.perServing[k]))]] : []),
    ...(n.per100g ? [['100g당', '합산 ÷ 총중량', ...keys.map((k) => r2(n.per100g![k]))]] : []),
  ];
  table(ws, ['구분', '기준', '열량 kcal', '나트륨 mg', '탄수화물 g', '당류 g', '지방 g', '포화지방 g', '트랜스지방 g', '콜레스테롤 mg', '단백질 g'], rows, [14, 13, 10, 10, 11, 9, 9, 10, 11, 12, 10], { num });
  ws.eachRow((row, i) => { if (i > 4 + comps.length) row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUM } }; c.font = { name: FONT, size: 10, bold: true }; }); });
  ws.addRow([]);
  ws.addRow([`참고: 구성품 시험성적서 값을 합산한 값이에요. 법정 표시용 확정값은 아니에요.${n.heldReasons.length ? ` 100g당 보류: ${n.heldReasons.join(' / ')}` : ''}`]).font = { name: FONT, size: 9, color: { argb: GREY } };


  }
  const join = (xs: Cell[], sep: string, unit = '') => (xs.every((x) => x == null) ? null : xs.map((x) => x ?? '?').join(sep) + unit);
  if (want('label')) {
    ws = wb.addWorksheet('표시 정보');
    title(ws, '표시 정보', sub);
    table(ws, ['항목', '내용'], [
      ['보관 방법', p.storage_text], ['조리방법', p.cooking_en], ['주의 문구', p.caution_en],
      ['강조 표시 · 인증 마크', p.claims],
      ['포장 부위 · 재질 · 개봉 시 분리', d.packaging.map((x) => [x.part, x.material, x.separable].filter(Boolean).join(' ')).join(' / ') || null],
      ['포장 크기 (mm)', join([p.pack_w_mm, p.pack_d_mm, p.pack_h_mm], ' × ')],
      ['라벨 부착 면적 (mm)', join([p.label_w_mm, p.label_h_mm], ' × ')],
    ], [34, 56]);
  }
  if (want('export')) {
    ws = wb.addWorksheet('수출 · 물류');
    title(ws, '수출 · 물류', sub);
    table(ws, ['항목', '내용'], [
      ['HS 6자리 / HSK 10자리', join([format_hs_code(e?.hs6), format_hs_code(e?.hsk10)], ' / ')],
      ['단가', external ? HIDDEN : e?.unit_price != null ? `${e.unit_price} ${e.currency ?? ''}`.trim() : null],
      ['입수 (개/CTN)', e?.units_per_ctn],
      ['CTN 순중량 / 총중량 (kg)', join([e?.ctn_net_kg, e?.ctn_gross_kg], ' / ')],
      ['CTN 규격 (cm)', join([e?.ctn_l_cm, e?.ctn_w_cm, e?.ctn_h_cm], ' × ')],
      ['1개당 포장 포함 중량 (g)', e?.unit_gross_g],
      ['팔레트 적재', e?.pallet_ctn_count != null ? `${join([e.pallet_l_cm, e.pallet_w_cm], ' × ', 'cm') ?? ''} ${e.pallet_layers ? `${e.pallet_layers}단 ` : ''}${e.pallet_ctn_count}상자`.trim() : null],
    ], [34, 56]);
  }

  return { buffer: await wb.xlsx.writeBuffer(), name: file_name(d, external ? '제품정보_외부공유용' : '제품정보_정리본') };
}

// ---------- ② 기업 요청 목록 ----------
const STATUS_COLOR: Partial<Record<string, [string, string]>> = { needs_check: ['FFFDEBD8', 'FF8A3D00'], missing: ['FFECEEF2', 'FF4A5263'], on_hold: ['FFECE6F7', 'FF5A3D99'] };

export const ANSWER_OPTIONS = ['값 적음', '제조사에 확인 중', '아직 정하지 않음', '해당 없음', '모름'];

/** 요청 목록에서 고를 수 있는 묶음: g0, g1 … (받을 자료) · wait · check */
export function request_parts(d: ProductDetail) {
  const view = build_detail_view(d);
  return [
    ...view.requests.map((r, i) => ({ key: `g${i}`, label: r.title, count: r.items.length })),
    ...(view.waiting.length ? [{ key: 'wait', label: '답을 기다리는 칸', count: view.waiting.length }] : []),
    ...(view.checks.length ? [{ key: 'check', label: '기존 값 확인', count: view.checks.length }] : []),
  ];
}

export async function request_workbook(d: ProductDetail, external: boolean, parts?: string[]) {
  const want = (k: string) => !parts?.length || parts.includes(k);
  const view = build_detail_view(d);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('요청 목록');
  ws.views = [{ showGridLines: false }];
  ws.addRow([`${d.product.name_ko} 자료 요청 목록`]).font = { name: FONT, size: 16, bold: true };
  ws.addRow([`노란 칸에 답변을 고르고 값을 적어 주세요. 예시에 적힌 것과 비슷한 자료가 있으면 같이 보내 주셔도 돼요. 자료 이름은 달라도 괜찮아요. 배합비는 필요 없어요. (${today()} 기준)`]).font = { name: FONT, size: 10, color: { argb: GREY } };
  ws.addRow([]);

  const shown = (t: TodoItem) => (external && t.def.internal ? HIDDEN : t.value);
  type R = { no: number; title: string; where: string; t: TodoItem; answer: string };
  const rows: R[] = [];
  let no = 0;
  view.requests.forEach((r, i) => {
    if (!want(`g${i}`)) return;
    no++;
    r.items.forEach((t) => rows.push({ no, title: r.title, where: r.where, t, answer: '' }));
  });
  if (view.waiting.length && want('wait')) {
    no++;
    view.waiting.forEach((t) => rows.push({ no, title: '답을 기다리는 칸', where: '', t, answer: t.row?.wait_reason ? WAIT_REASON_LABEL[t.row.wait_reason] : '' }));
  }
  if (view.checks.length && want('check')) {
    no++;
    view.checks.forEach((t) => rows.push({ no, title: '기존 값 확인', where: '', t, answer: '' }));
  }

  const h = ws.addRow(['번호', '필요한 내용', '이런 자료에 있어요 (예시)', '구성품', '항목', '지금 값', '상태', '답변', '기입란', '칸 ID']);
  const start = h.number;
  h.eachCell((c) => { c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; });
  let prev_no = 0;
  for (const r of rows) {
    const first = r.no !== prev_no; prev_no = r.no;
    const note = r.t.row?.note;
    const row = ws.addRow([
      first ? r.no : '', first ? r.title : '', first ? (r.where ? `예: ${r.where}` : '') : '', r.t.scope,
      r.t.def.label + (r.t.status === 'needs_check' && note ? `\n(${note})` : ''), shown(r.t) ?? DASH,
      STATUS_LABEL[r.t.status], r.answer, '', r.t.key,
    ]);
    row.eachCell({ includeEmpty: true }, (c, i) => {
      c.font = { name: FONT, size: i === 3 ? 9 : 10, bold: i === 2, color: i === 3 ? { argb: GREY } : undefined };
      c.alignment = { vertical: 'top', wrapText: i !== 10, horizontal: i === 1 ? 'center' : undefined };
      c.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      if (i === 8 || i === 9) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } };
    });
    const sc = STATUS_COLOR[r.t.status];
    if (sc) { const c = row.getCell(7); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc[0] } }; c.font = { name: FONT, size: 10, bold: true, color: { argb: sc[1] } }; }
    row.getCell(8).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${ANSWER_OPTIONS.join(',')}"`] };
  }
  [7, 22, 30, 14, 34, 16, 10, 18, 32, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(10).hidden = true;     // 다시 올릴 때 어느 칸인지 찾는 용도
  ws.views = [{ state: 'frozen', ySplit: start, showGridLines: false }];
  ws.addRow([]);
  ws.addRow(['', '답변: 값을 적었으면 "값 적음", 바로 모르면 나머지 중 하나를 골라 주세요. "제조사에 확인 중" · "아직 정하지 않음"도 빈 칸으로 남아 있다가 값이 오면 채워져요.']).getCell(2).font = { name: FONT, size: 9, color: { argb: GREY } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  return { buffer: await wb.xlsx.writeBuffer(), name: file_name(d, external ? '자료요청목록_외부공유용' : '자료요청목록') };
}
