// 기업이 채워 돌려준 "자료 요청 목록" 엑셀 읽기 (Claude). AI를 쓰지 않는다.
// 숨긴 J열(칸 ID)로 어느 칸인지 찾고, H열(답변) · I열(기업 기입란)을 읽는다.
import 'server-only';
import ExcelJS from 'exceljs';
import type { ProductDetail } from './data';
import type { Answer } from './form';
import { build_detail_view } from './view';

export type Change = {
  key: string; scope: string; label: string;
  current: string | null;     // 지금 값
  value: string | null;       // 기업이 적은 값 (없으면 null)
  answer: Answer;             // 값이 없을 때의 답변
  evidence?: string;          // AI가 읽은 근거 (자료 속 문장)
  restored?: true;            // 가린 값([주소1] 등)을 서버에서 원래 값으로 되돌림
};

const ANSWER: Record<string, Answer> = {
  '제조사에 확인 중': 'asking_supplier', '아직 정하지 않음': 'undecided', '해당 없음': 'not_applicable', '모름': 'unknown',
};

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((t) => t.text).join('').trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export async function read_request_file(buf: ArrayBuffer, d: ProductDetail): Promise<{ changes: Change[]; warnings: string[] }> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch { return { changes: [], warnings: ['엑셀 파일을 열 수 없어요. 내려받은 요청 목록 파일인지 확인해 주세요.'] }; }
  const ws = wb.worksheets[0];
  const view = build_detail_view(d);
  const items = new Map(view.info.flatMap((s) => s.items).map((t) => [t.key, t]));
  const changes: Change[] = []; const warnings: string[] = [];
  let header = 0; let foreign = 0;

  ws.eachRow((row, n) => {
    if (text(row.getCell(10).value) === '칸 ID') { header = n; return; }
    if (!header || n <= header) return;
    const key = text(row.getCell(10).value);
    if (!key) return;
    const item = items.get(key);
    if (!item) { foreign++; return; }
    const ans = text(row.getCell(8).value);
    const raw_val = text(row.getCell(9).value);
    const val = item.def.key === 'currency' ? raw_val.toUpperCase() : raw_val;   // 'usd' → 'USD' (저장할 때와 같게 미리보기에도)
    if (!ans && !val) return;
    if (val) changes.push({ key, scope: item.scope, label: item.def.label, current: item.value, value: val, answer: '' });
    else if (ANSWER[ans] && (ANSWER[ans] === item.row?.wait_reason || (ANSWER[ans] === 'not_applicable' && item.status === 'not_applicable'))) return;   // 그대로인 답변
    else if (ANSWER[ans]) changes.push({ key, scope: item.scope, label: item.def.label, current: item.value, value: null, answer: ANSWER[ans] });
    else if (ans === '값 적음' && item.value) changes.push({ key, scope: item.scope, label: item.def.label, current: item.value, value: null, answer: 'confirm' });
    else if (ans === '값 적음') warnings.push(`${item.scope} · ${item.def.label}: "값 적음"을 골랐지만 기입란이 비어 있어요.`);
  });

  if (!header) warnings.unshift('요청 목록 양식이 아니에요. 화면에서 내려받은 "자료 요청 목록" 파일을 올려 주세요.');
  if (foreign) warnings.push(`다른 제품의 칸 ${foreign}개는 건너뛰었어요.`);
  return { changes, warnings };
}
