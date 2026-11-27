// 메일 · 사양서 글을 AI가 읽어 칸 값 뽑기 (Claude)
// 순서: ① 코드로 주소 · 연락처 · 단가 · 배합비 지우기 → ② 칸 목록(이름만, ID 없이)과 함께 AI에 보내기
//       → ③ 돌아온 값을 미리보기로 → 사람이 고른 것만 저장 (상태는 "확인 필요")
// AI: OpenAI (팀 결정 11/26). 환경 설정에 OPENAI_API_KEY · OPENAI_MODEL. AI를 바꾸면 callModel()만 고친다.
import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { extractText, getDocumentProxy } from 'unpdf';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { findLeftovers, sanitize, sanitizeTable } from '@/lib/sanitize';
import type { ProductDetail } from './data';
import type { Change } from './import_request';
import { build_detail_view } from './view';

const Result = z.object({
  mentioned_products: z.array(z.string()).describe('자료에 나오는 제품 이름들'),
  fields: z.array(z.object({
    id: z.string().describe('칸 번호 (예: f3)'),
    value: z.string(),
    evidence: z.string().describe('값을 찾은 자료 속 문장 그대로, 40자 이내'),
  })),
});
export type ExtractResult = z.infer<typeof Result>;

const SYSTEM = `너는 식품 수출 서류 담당자를 돕는다. 제조사 등에서 받은 메일 · 사양서 글에서 제품 정보 칸에 들어갈 값을 찾아 준다.
규칙:
- 자료에 분명히 적힌 값만 적는다. 추측하거나 계산하지 않는다. 없으면 그 칸은 빼고 보낸다.
- [주소] [전화] [금액] [배합비 제거됨] 같은 표시는 일부러 지운 자리다. 그 자리의 값을 짐작하지 않는다.
- 구성품이 여러 개면 칸의 구성품 이름을 보고 맞는 구성품의 값만 넣는다.
- 원재료는 많이 든 순서대로 한 줄에 하나씩 적고, 원산지는 괄호에 넣는다. 하위 원료는 줄 앞에 "  - "를 붙인다. 함량(%)은 자료에 라벨 표기로 적혀 있을 때만 남긴다.
- 숫자 칸은 단위까지 적는다 (예: 7 g, 24개).`;

export type Catalog = { id: string; key: string; scope: string; label: string; current: string | null }[];

export function catalog_for(d: ProductDetail): Catalog {
  const items = build_detail_view(d).info.flatMap((s) => s.items).filter((t) => !t.def.internal);   // 단가 같은 내부 칸은 AI에 묻지 않음
  return items.map((t, i) => ({ id: `f${i + 1}`, key: t.key, scope: t.scope, label: t.def.label, current: t.value }));
}

/** 올린 파일 → 글. 표는 막힌 열(배합 · 단가 · 주소 등)을 먼저 뺀다 */
export async function file_to_text(name: string, buf: ArrayBuffer): Promise<{ text: string; dropped: string[] }> {
  if (/\.xlsx$/i.test(name)) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const parts: string[] = []; const dropped: string[] = [];
    wb.eachSheet((ws) => {
      const rows: Record<string, unknown>[] = []; let head: string[] = [];
      ws.eachRow((row, n) => {
        const vals = (row.values as unknown[]).slice(1).map((v) => (v == null ? '' : typeof v === 'object' && v && 'richText' in v ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('') : String(v)));
        if (n === 1) head = vals.map((v, i) => v || `열${i + 1}`);
        else rows.push(Object.fromEntries(head.map((h, i) => [h, vals[i] ?? ''])));
      });
      const t = sanitizeTable(rows); dropped.push(...t.droppedColumns);
      parts.push(`# ${ws.name}\n` + t.rows.map((r) => Object.entries(r).filter(([, v]) => v !== '').map(([k, v]) => `${k}: ${v}`).join(' | ')).join('\n'));
    });
    return { text: parts.join('\n\n'), dropped };
  }
  if (/\.pdf$/i.test(name)) {
    // 글자가 들어 있는 PDF만 코드로 글을 뽑아 지운 뒤 보낸다. PDF 파일 자체는 AI로 보내지 않음
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    if (text.replace(/\s/g, '').length < 20 * totalPages) throw new ScannedPdfError();
    return { text, dropped: [] };
  }
  return { text: new TextDecoder('utf-8').decode(buf), dropped: [] };
}

/** 스캔본(사진으로 된 PDF)은 글자를 뽑을 수 없어 주소를 지울 수 없음 → 받지 않음 */
export class ScannedPdfError extends Error {
  constructor() { super('이 PDF는 사진(스캔본)으로 되어 있어 글자를 읽을 수 없어요. 주소를 지울 수 없어서 AI로 보내지 않았어요. 필요한 부분을 글로 복사해 붙여 넣어 주세요.'); }
}

async function call_model(text: string, catalog: Catalog, product_name: string): Promise<ExtractResult> {
  const client = new OpenAI();
  const list = catalog.map((c) => `${c.id} | ${c.scope} | ${c.label}${c.current ? ` | 지금 값: ${c.current}` : ''}`).join('\n');
  const res = await client.responses.parse({
    model: process.env.OPENAI_MODEL!,
    instructions: SYSTEM,
    input: `제품: ${product_name}\n\n칸 목록 (번호 | 구성품 | 항목):\n${list}\n\n<자료>\n${text}\n</자료>`,
    text: { format: zodTextFormat(Result, 'product_fields') },
    store: false,                       // 보낸 자료를 OpenAI 쪽에 저장하지 않음
  });
  if (!res.output_parsed) throw new Error('AI 답을 읽지 못했어요. 다시 해 주세요.');
  return res.output_parsed;
}

/** AI 답 → 미리보기용 변경 목록 (없는 칸 번호 · 같은 값은 버림) */
export function to_changes(r: ExtractResult, catalog: Catalog): Change[] {
  const by_id = new Map(catalog.map((c) => [c.id, c]));
  const out: Change[] = [];
  for (const f of r.fields) {
    const c = by_id.get(f.id.trim());
    const v = f.value.trim();
    if (!c || !v || v === c.current || out.some((x) => x.key === c.key)) continue;
    out.push({ key: c.key, scope: c.scope, label: c.label, current: c.current, value: v, answer: '', evidence: f.evidence.slice(0, 80) });
  }
  return out;
}

export async function extract_from_text(raw: string, d: ProductDetail, dropped: string[] = []) {
  const s = sanitize(raw);
  const removed = Object.entries(s.removed).map(([k, n]) => `${k} ${n}곳`);
  if (dropped.length) removed.push(`표의 열 ${dropped.join(', ')}`);
  const warnings: string[] = [];
  if (!s.text.trim()) return { changes: [] as Change[], warnings: ['읽을 글이 없어요.'], removed };
  // 지우지 못한 흔적(해외 주소 · 통화 없는 단가 등)이 있으면 AI를 부르지 않는다. 라벨 표기 함량(%)은 공개 정보라 허용
  const left = findLeftovers(s.text, { allowPercent: true });
  if (left.length) return { changes: [] as Change[], warnings: [`지우지 못한 민감정보가 있어 AI로 보내지 않았어요: ${[...new Set(left.map((l) => `${l.name} "${l.sample}"`))].join(', ')}. 글에서 지우고 다시 보내 주세요.`], removed };
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return { changes: [] as Change[], warnings: ['AI 키가 아직 설정되지 않았어요. 환경 설정에 OPENAI_API_KEY와 OPENAI_MODEL(쓸 모델 이름)을 넣어 주세요.'], removed };
  const catalog = catalog_for(d);
  let r: ExtractResult;
  try { r = await call_model(s.text, catalog, d.product.name_ko); }
  catch (e) {
    const msg = e instanceof OpenAI.AuthenticationError ? 'AI 키가 맞지 않아요. 환경 설정의 OPENAI_API_KEY를 확인해 주세요.'
      : e instanceof OpenAI.RateLimitError ? 'AI 사용량이 잠시 꽉 찼어요. 조금 뒤에 다시 해 주세요.'
      : e instanceof OpenAI.APIConnectionError ? 'AI에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.'
      : e instanceof Error && e.message.startsWith('AI 답') ? e.message : 'AI 읽기에 실패했어요. 다시 해 주세요.';
    return { changes: [] as Change[], warnings: [msg], removed };
  }
  const others = r.mentioned_products.filter((n) => n && !n.includes(d.product.name_ko) && !d.components.some((c) => n.includes(c.component.name)));
  if (others.length) warnings.push(`자료에 다른 제품(${others.join(', ')})도 나와요. 이 제품 값이 맞는지 꼭 확인해 주세요.`);
  return { changes: to_changes(r, catalog), warnings, removed };
}
