// [공용] AI로 보내기 전 민감정보 제거 (Claude 생성, 부속물품도 같이 사용)
// 원칙: 주소 · 연락처 · 단가 · 배합비는 AI로 보내지 않는다. 코드로만 지운다.
// 지운 자리는 [주소] 같은 표시로 바꿔서 AI가 "여기 뭔가 있었다"는 것만 알게 한다.
// 규칙을 추가할 때는 [공용] PR로 알린다.

export type SanitizeResult = { text: string; removed: Record<string, number> };

type Rule = { name: string; pattern: RegExp; replace: string };

const RULES: Rule[] = [
  // 연락처
  { name: '이메일', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: '[이메일]' },
  { name: '전화', pattern: /(?:\+?82[-\s]?)?0?\d{1,2}[-.\s)]\d{3,4}[-.\s]\d{4}/g, replace: '[전화]' },
  // 한국 주소: 시·도로 시작해서 로/길/동 + 번지까지
  {
    name: '주소',
    pattern:
      /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n,]{0,40}?(?:로|길|동|읍|면|리)\s?\d+(?:-\d+)?(?:[^\n]{0,30}?(?:층|호|동))?/g,
    replace: '[주소]',
  },
  // 영문으로 적은 한국 주소 (11/27 추가): Samsung-ro · Gangnam-gu · Gyeonggi-do 같은 낱말부터 줄 끝까지 (바로 앞 번지 숫자 포함)
  {
    name: '주소',
    pattern: /(?:\d[\w-]*,?\s+){0,2}[A-Z][a-z]+-(?:ro|gil|gu|si|do|dong|eup|myeon|ri)\b[^\n]{0,100}/g,
    replace: '[주소]',
  },
  // 해외 주소 (11/27 추가): Ward · District · Province + 번호, 또는 호찌민 · 하노이 같은 도시 이름 + City
  {
    name: '주소',
    pattern: /(?:[\w#.'-]+,?\s+){0,4}(?:\b(?:Ward|District|Dist\.|Province|Commune|Hamlet)\s+\d+|\b(?:Ho Chi Minh|Ha Noi|Hanoi|Da Nang|Hai Phong|Binh Duong|Dong Nai)\s+City\b)[^\n]{0,100}/g,
    replace: '[주소]',
  },
  // 사업자등록번호
  { name: '사업자번호', pattern: /\b\d{3}-\d{2}-\d{5}\b/g, replace: '[사업자번호]' },
  // 단가 · 금액 (통화 기호나 단위가 붙은 숫자)
  {
    name: '금액',
    pattern: /(?:US\$|\$|€|₩|USD|EUR|KRW|SGD)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:원|(?:USD|EUR|KRW|SGD)\b)/g,
    replace: '[금액]',
  },
  // 배합비: "배합비", "배합비율", "배합량" 뒤의 표 줄, 또는 "원료명 12.5%" 형태
  { name: '배합비', pattern: /(?:배합비율?|배합량|배합표)[^\n]*(?:\n(?![ \t]*\n)[^\n]*){0,40}/g, replace: '[배합비 제거됨]' },
];

export function sanitize(text: string): SanitizeResult {
  const removed: Record<string, number> = {};
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, () => {
      removed[rule.name] = (removed[rule.name] ?? 0) + 1;
      return rule.replace;
    });
  }
  return { text: out, removed };
}

// ---------------------------------------------------------------------------
// [공용] 가린 뒤 복원 (11/27, 강사님 제안 반영)
// "내부만" 정보(주소 · 연락처 · 단가 · 사업자번호)는 지우는 대신 [주소1] · [금액2] 같은 표시로 가려서 AI로 보내고,
// AI 답에 그 표시가 돌아오면 서버에서 원래 값으로 되돌린다. 원래 값(masks)은 AI로 보내지 않는다.
// "받지 않는" 정보(배합비)는 되돌리지 않고 그냥 지운다.

const RESTORABLE = new Set(['이메일', '전화', '주소', '사업자번호', '금액']);
const MASK_TOKEN = /\[(이메일|전화|주소|사업자번호|금액)(\d{1,3})\]/g;
const MAX_MASK_VALUE = 300;

export type MaskResult = { text: string; masks: Record<string, string>; removed: Record<string, number> };

/** 글 속 민감정보를 가린다. 같은 값은 같은 표시로 가린다 (AI가 "같은 주소"임을 알 수 있게) */
export function maskForAI(text: string): MaskResult {
  const removed: Record<string, number> = {};
  const masks: Record<string, string> = {};
  const by_value = new Map<string, string>();
  const count: Record<string, number> = {};
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (m) => {
      removed[rule.name] = (removed[rule.name] ?? 0) + 1;
      if (!RESTORABLE.has(rule.name)) return rule.replace;
      const v = m.trim();
      const key = `${rule.name}|${v}`;
      let token = by_value.get(key);
      if (!token) {
        count[rule.name] = (count[rule.name] ?? 0) + 1;
        token = `[${rule.name}${count[rule.name]}]`;
        by_value.set(key, token);
        masks[token] = v;
      }
      return token;
    });
  }
  return { text: out, masks, removed };
}

/** 화면에서 되돌아온 masks를 믿기 전에 모양을 확인한다 (표시 이름 · 값 길이) */
export function checkMasks(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x !== 'string' || x.length > MAX_MASK_VALUE) continue;
    if (!new RegExp(`^${MASK_TOKEN.source}$`).test(k)) continue;
    out[k] = x;
  }
  return out;
}

/** AI 답 속 [주소1] 같은 표시를 원래 값으로 되돌린다. 모르는 표시는 그대로 둔다 */
export function restoreMasks(text: string, masks: Record<string, string>): { text: string; restored: string[] } {
  const restored: string[] = [];
  const t = text.replace(MASK_TOKEN, (m) => {
    if (!(m in masks)) return m;
    restored.push(m);
    return masks[m];
  });
  return { text: t, restored };
}

/** 표 데이터(엑셀 등)는 열 이름으로 먼저 거른다. 배합비 · 단가 · 주소 열은 통째로 뺀다. */
const BLOCKED_COLUMNS = /배합|함량\s*\(%\)|비율|단가|가격|금액|price|주소|address|전화|tel|phone|e-?mail/i;

export function sanitizeTable(rows: Record<string, unknown>[]): { rows: Record<string, unknown>[]; droppedColumns: string[] } {
  const cols = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => cols.add(k)));
  const dropped = [...cols].filter((c) => BLOCKED_COLUMNS.test(c));
  const clean = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (dropped.includes(k)) continue;
      o[k] = typeof v === 'string' ? sanitize(v).text : v;
    }
    return o;
  });
  return { rows: clean, droppedColumns: dropped };
}

// ---------------------------------------------------------------------------
// [공용] AI 호출 전 안전 검사 (11/26 추가). 지우기 규칙으로 못 지운 흔적이 남아 있으면 AI를 부르지 않는다.
// 지울 수 있는 것은 위 RULES가 지우고, "지웠다고 확신할 수 없는 것"은 여기서 막는다.

export type Leftover = { name: string; sample: string };

const LEFTOVER_RULES: { name: string; pattern: RegExp; percent?: true }[] = [
  // 영문 · 해외 주소 (Rd, Street, #12-34, Singapore 123456 등)
  { name: '해외 주소', pattern: /\b\d{1,5}\s+[A-Za-z .'-]{2,40}\b(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Lane|Ln|Dr|Drive|Way)\b\.?|#\d{1,3}-\d{1,4}\b|\b(?:Singapore|Paris|France)\s+\d{5,6}\b/gi },
  // 영문 주소 낱말이 남은 경우 (11/27 추가)
  { name: '해외 주소', pattern: /\b[A-Z][a-z]+-(?:ro|gil|gu|si|do|dong|eup|myeon)\b|\b(?:Ward|District|Province)\s+\d+/g },
  // 단가 · 가격이라는 말 옆의 숫자 (통화 표시 없이 적은 경우)
  { name: '단가', pattern: /(?:단가|공급가|가격|금액|price|cost)\s*[:：]?\s*\d[\d,.]*/gi },
  // 배합비로 보이는 퍼센트 (원료 이름 + 숫자%)
  { name: '배합비(%)', pattern: /[가-힣A-Za-z)]\s*[:：]?\s*\d{1,3}(?:\.\d+)?\s?%/g, percent: true },
  // 주소 낱말이 남은 줄 (시·도 없이 적은 한국 주소)
  { name: '주소', pattern: /[가-힣\d]+(?:로|길)\s?\d+(?:-\d+)?(?:번길)?/g },
  // 전화 · 계좌로 보이는 숫자: 하이픈 낀 9자리 이상, 11자리 이상, 010 같은 휴대전화 (HS · HSK 코드는 아래에서 먼저 가림)
  { name: '긴 숫자', pattern: /(?<![\d.])(?:\d+-[\d-]{6,}\d|\d{11,}|01[016789]\d{7,8})(?![\d.])/g },
  // 사람 이름 표시 (담당자 · 대표 뒤의 이름)
  { name: '담당자 이름', pattern: /(?:담당자?|대표(?:자|이사)?|manager|contact)\s*[:：]\s*(?!\[)[가-힣A-Za-z]{2,}/gi },
];

/** 지우기 규칙을 거친 글에 민감정보 흔적이 남았는지 본다. 비어 있으면 통과.
 *  allowPercent: 숫자% 를 허용 (부속물품 재질 "면 100%", 제품 라벨에 표기된 함량처럼 공개 정보일 때) */
export type LeftoverOptions = { allowPercent?: boolean };
// 공개 번호 (HS · HSK 코드, 품목보고번호, 바코드)는 긴 숫자로 보지 않는다
const PUBLIC_NUMBER_CONTEXT = /(?:HSK?|HS\s?코드|세번|품목(?:제조)?보고번호|품목번호|바코드|GTIN|EAN)\s*[:：]?\s*(?:지금 값\s*[:：]\s*)?[\d.\- ]{4,20}/gi;

export function findLeftovers(text: string, opt: LeftoverOptions = {}): Leftover[] {
  const out: Leftover[] = [];
  text = text.replace(PUBLIC_NUMBER_CONTEXT, '[공개 번호]');
  text = text.replace(MASK_TOKEN, '[가림]');   // [금액1] 같은 가린 표시의 숫자는 흔적이 아님
  for (const r of LEFTOVER_RULES) if (!(r.percent && opt.allowPercent)) for (const m of text.matchAll(r.pattern)) out.push({ name: r.name, sample: m[0].slice(0, 40) });
  return out;
}

/** AI로 보내도 되는 칸 (품목 종류별). 여기 없는 칸은 값이 있어도 보내지 않는다 */
export type ItemType = 'food' | 'accessory';
export const AI_ALLOWED_FIELDS: Record<ItemType, readonly string[]> = {
  // 식품: 품명 · 식품유형 · 원재료 이름(순서) · 가공 형태 · 포장 형태. 함량 % · 제조원 · 단가 · 주소는 보내지 않음
  food: ['item_name', 'item_name_en', 'description', 'existing_classification', 'food_type', 'main_ingredients', 'processing', 'packaging_form', 'storage'],
  // 부속물품: 품명 · 재질 · 용도 · 형태 · 크기 · 인쇄 여부. 단가 · 가액 · 공급처 · 수량은 보내지 않음
  accessory: ['item_name', 'item_name_en', 'description', 'existing_classification', 'material', 'purpose', 'shape', 'size', 'printed', 'components'],
};

/** 칸 안의 객체 · 배열에 이런 이름의 하위 칸이 있으면 차단한다 (값이 비어 있으면 무시) */
const BLOCKED_KEYS = /배합|함량|비율|ratio|formula|단가|가격|금액|가액|price|cost|amount|value_usd|주소|address|addr|전화|연락|tel|phone|mobile|fax|e-?mail|담당|contact|manager|공급처|supplier|vendor|제조원|manufacturer|계좌|account|사업자|business_no/i;
const MAX_DEPTH = 4;

/** 객체 · 배열을 "경로: 값" 줄로 편다. 막힌 하위 칸 이름은 blocked에 모은다 */
function flatten(v: unknown, path: string, out: string[], blocked: string[], depth = 0): void {
  if (v == null || v === '') return;
  if (depth > MAX_DEPTH) { blocked.push(`${path} (너무 깊음)`); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => flatten(x, `${path}[${i}]`, out, blocked, depth + 1)); return; }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (BLOCKED_KEYS.test(k) && x != null && x !== '') { blocked.push(`${path}.${k}`); continue; }
      flatten(x, `${path}.${k}`, out, blocked, depth + 1);
    }
    return;
  }
  out.push(`${path}: ${String(v)}`);
}

/**
 * 기존 분류 코드 검사. HS6(6자리) · HSK10(10자리)만 받는다. "1902.30" · "1902.30-9000" 처럼 점 · 하이픈 · 칸은 허용.
 * 문자열 하나, 문자열 배열, 또는 { hs6, hsk10 } 객체. isKnownCode를 주면 공식 코드표에 있는 코드만 통과.
 */
export function checkClassification(v: unknown, isKnownCode?: (code: string) => boolean): { ok: true; text: string } | { ok: false; reason: string } {
  const codes: { kind: 'HS6' | 'HSK10'; code: string }[] = [];
  const bad: string[] = [];
  const take = (x: unknown, expect?: 'HS6' | 'HSK10') => {
    if (x == null || x === '') return;
    if (typeof x !== 'string' && typeof x !== 'number') { bad.push(JSON.stringify(x).slice(0, 30)); return; }
    const raw = String(x).trim();
    const d = raw.replace(/[.\-\s]/g, '');
    const kind = /^\d{6}$/.test(d) ? 'HS6' : /^\d{10}$/.test(d) ? 'HSK10' : null;
    if (!kind || (expect && kind !== expect) || /[^\d.\-\s]/.test(raw)) { bad.push(raw.slice(0, 30)); return; }
    if (isKnownCode && !isKnownCode(d)) { bad.push(`${raw} (코드표에 없음)`); return; }
    codes.push({ kind, code: d });
  };
  if (Array.isArray(v)) v.forEach((x) => take(x));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'hs6') take(x, 'HS6'); else if (k === 'hsk10') take(x, 'HSK10');
      else if (x != null && x !== '') bad.push(`${k} 칸`);
    }
  } else take(v);
  if (bad.length) return { ok: false, reason: `기존 분류 코드에는 HS 6자리 · HSK 10자리 코드만 넣을 수 있어요 (받지 않은 값: ${bad.join(', ')}).` };
  // HS6와 HSK10을 같이 주면 앞 6자리가 같아야 한다
  const h6 = codes.filter((c) => c.kind === 'HS6').map((c) => c.code);
  const h10 = codes.filter((c) => c.kind === 'HSK10').map((c) => c.code);
  if (h6.length && h10.length && h10.some((c) => !h6.includes(c.slice(0, 6)))) return { ok: false, reason: 'HS 6자리와 HSK 10자리의 앞 6자리가 서로 달라요.' };
  return { ok: true, text: codes.map((c) => `${c.kind} ${c.code}`).join(', ') };
}

export type AIInput = { item_type: ItemType; fields: Record<string, unknown> };
export type PrepareOptions = { isKnownCode?: (code: string) => boolean };
export type PrepareResult =
  | { ok: true; fields: Record<string, string>; removed: Record<string, number>; droppedFields: string[] }
  | { ok: false; reason: string; leftovers: Leftover[]; droppedFields: string[] };

/**
 * AI 호출 직전에 반드시 거치는 함수. ok가 false면 AI를 부르지 말고 reason을 사람에게 보여 준다.
 * 1) 허용 칸만 남김  2) 객체 · 배열은 펴서 하위 칸 이름 검사  3) 칸마다 sanitize  4) 남은 흔적 검사 → 하나라도 있으면 차단
 * existing_classification은 HS6 · HSK10 코드만 통과 (opt.isKnownCode로 코드표 확인 가능)
 */
export function prepareForAI(input: AIInput, opt: PrepareOptions = {}): PrepareResult {
  const allowed = AI_ALLOWED_FIELDS[input?.item_type];
  if (!allowed) return { ok: false, reason: `알 수 없는 품목 종류예요: ${String(input?.item_type)}`, leftovers: [], droppedFields: [] };
  const droppedFields: string[] = [];
  const fields: Record<string, string> = {};
  const removed: Record<string, number> = {};
  const leftovers: Leftover[] = [];
  const reasons: string[] = [];
  for (const [k, v] of Object.entries(input.fields ?? {})) {
    if (!allowed.includes(k)) { droppedFields.push(k); continue; }
    if (v == null || v === '') continue;
    if (k === 'existing_classification') {
      const c = checkClassification(v, opt.isKnownCode);
      if (c.ok) { if (c.text) fields[k] = c.text; } else reasons.push(c.reason);
      continue;
    }
    let raw: string;
    if (typeof v === 'object') {
      const lines: string[] = []; const blocked: string[] = [];
      flatten(v, k, lines, blocked);
      if (blocked.length) { leftovers.push(...blocked.map((b) => ({ name: `${k} · 보내면 안 되는 하위 칸`, sample: b }))); continue; }
      // 경로 표시는 하위 칸 이름만 남긴다: "main_ingredients[0]: 쌀떡" → "쌀떡", "attrs.color: 빨강" → "color: 빨강"
      const parts = lines.map((l) => {
        const i = l.indexOf(': '); const path = l.slice(0, i).replace(/\[\d+\]/g, ''); const val = l.slice(i + 2);
        const key = path.split('.').slice(1).join('.');
        return key ? `${key}: ${val}` : val;
      });
      raw = parts.every((x) => !x.includes(': ')) ? parts.join(', ') : parts.join('; ');
    } else raw = String(v);
    const s = sanitize(raw);
    for (const [n, c] of Object.entries(s.removed)) removed[n] = (removed[n] ?? 0) + c;
    for (const l of findLeftovers(s.text, { allowPercent: input.item_type === 'accessory' })) leftovers.push({ name: `${k} · ${l.name}`, sample: l.sample });
    fields[k] = s.text;
  }
  if (leftovers.length) reasons.unshift(`지우지 못한 민감정보가 남아 있어 AI로 보내지 않았어요 (${[...new Set(leftovers.map((l) => l.name))].join(', ')}). 해당 내용을 지우고 다시 시도해 주세요.`);
  if (reasons.length) return { ok: false, reason: reasons.join(' '), leftovers, droppedFields };
  return { ok: true, fields, removed, droppedFields };
}

/** 이미 하나의 글로 만든 경우(메일 · PDF)에 쓰는 검사. 흔적이 있으면 오류를 던져 AI 호출을 막는다 */
export class UnsafeForAIError extends Error {
  leftovers: Leftover[];
  constructor(leftovers: Leftover[]) {
    super(`지우지 못한 민감정보가 남아 있어 AI로 보내지 않았어요: ${[...new Set(leftovers.map((l) => `${l.name}(${l.sample})`))].join(', ')}`);
    this.leftovers = leftovers;
  }
}
export function assertSafeForAI(text: string, opt: LeftoverOptions = {}): string {
  const s = sanitize(text).text;
  const left = findLeftovers(s, opt);
  if (left.length) throw new UnsafeForAIError(left);
  return s;
}
