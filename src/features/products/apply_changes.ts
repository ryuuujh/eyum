// 올린 자료의 값을 입력 모델에 넣기 (Claude). 요청 목록 · AI 추출이 같이 쓴다.
import type { Change } from './import_request';
import { status_key, type ProductForm } from './form';
import { COMPOSITE_FIELDS } from './fields';

const first_num = (s: string) => s.replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0] ?? '';

/** key = entity_type:entity_id:field_key */
export function apply_change(f: ProductForm, c: Change, ai_note?: string) {
  const [entity, id, field] = c.key.split(':') as ['product' | 'component', string, string];
  const sk = status_key(entity, id, field);
  if (c.value == null) { f.answers[sk] = c.answer; return; }
  const v = c.value.trim();
  if (ai_note) (f.aiNotes ??= {})[sk] = ai_note;

  if (entity === 'component') {
    const comp = f.comps.find((x) => x.id === id);
    if (!comp) return;
    if (field === 'ingredients') comp.ingredients = split_list(v).join('\n');
    else if (field === 'animal_ingredient') {
      if (/^없/.test(v)) comp.animal_ingredient = '없음';
      else { comp.animal_ingredient = '있음'; comp.animal_ingredient_detail = v.replace(/^있음\s*[:(]?\s*/, '').replace(/\)$/, '') || comp.animal_ingredient_detail; }
    } else if (field === 'unit_weight_g') comp.unit_weight_g = first_num(v);
    else (comp as unknown as Record<string, string>)[field] = v;
    return;
  }
  if (field in COMPOSITE_FIELDS) {
    // "150 × 90 × 60" · "150x90x60mm" → 숫자 차례대로
    const nums = v.replace(/,/g, '').match(/\d+(\.\d+)?/g) ?? [];
    const target = (field === 'ctn_size' ? f.exp : f.p) as Record<string, string>;
    COMPOSITE_FIELDS[field].cols.forEach((k, i) => { if (nums[i] != null) target[k] = nums[i]; });
  } else if (field === 'date_type') {
    f.p.date_type = /품질/.test(v) ? '품질유지기한' : /소비/.test(v) ? '소비기한' : f.p.date_type;
  } else if (field === 'currency') {
    f.exp.currency = v.match(/USD|EUR|SGD|KRW/i)?.[0]?.toUpperCase() ?? f.exp.currency;
  } else if (field === 'packaging') {
    f.packaging = split_list(v).map((p) => { const [part, ...m] = p.split(/\s+/); return { part, material: m.join(' '), separable: '' as const }; });
  } else if (field === 'net_content_value') {
    f.p.net_content_value = first_num(v);
    const u = v.match(/(kg|mL|ml|L|g)\b/)?.[1]; if (u) f.p.net_content_unit = u === 'ml' ? 'mL' : u;
  } else if (field === 'halal') f.p.halal = /없|no/i.test(v) ? '없음' : '있음';
  else if (field === 'unit_price') {
    f.exp.unit_price = first_num(v);
    const cur = v.match(/USD|EUR|SGD|KRW/i)?.[0]; if (cur) f.exp.currency = cur.toUpperCase();
  } else if (field in f.exp) {
    (f.exp as Record<string, string>)[field] = ['hs6'].includes(field) ? v.replace(/\D/g, '').slice(0, 6) : first_num(v) || v;
  } else if (field in f.p) (f.p as Record<string, string>)[field] = v;
}

/** "귀리(캐나다산), 호박씨, 펙틴" → 줄 목록 (괄호 안 쉼표는 나누지 않음) */
export function split_list(v: string): string[] {
  if (v.includes('\n')) return v.split('\n').map((x) => x.trimEnd()).filter((x) => x.trim());
  const out: string[] = []; let depth = 0; let cur = '';
  for (const ch of v) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if ((ch === ',' || ch === '，') && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
