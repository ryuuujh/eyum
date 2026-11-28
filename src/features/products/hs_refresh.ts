// HS 데이터 갱신 작업자(scripts/hs_refresh_cli.py)를 부르는 곳 (Claude, 11/27)
// 승인 기능은 아직 공개하지 않는다: 로컬 Supabase + 비운영 + HS_REFRESH_DATABASE_URL이 있을 때만 켜짐.
// 로그인 · 권한이 정해지면 이 안전장치를 권한 검사로 바꾼다.
import 'server-only';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { accessory_db } from '@/features/accessories/data';

export type HsDiffRow = { code: string; kind: 'added' | 'removed' | 'changed' };
export type HsDifferences = {
  hsk: HsDiffRow[]; standard_names: HsDiffRow[]; candidate_snapshot: string;
  standard_link_audit_codes: string[]; review_codes: string[];
};
export type HsImpact = { item_type: 'food' | 'accessory'; item_id: string; item_label: string; hs6: string; hsk10: string | null;
  hs_classification_id: string | null; review_status: string | null; matched_codes: string[] };
export type HsCompare = { differences: HsDifferences; impacts: { review_codes: HsImpact[]; standard_link_audit_codes: HsImpact[] } };
export type HsUploadResult = (
  | { status: 'no_change'; expected_version: string; notice_resolved?: boolean }
  | ({ status: 'staged' | 'already_staged'; expected_version: string; candidate_version: string } & HsCompare)
  | { status: 'already_approved'; expected_version: string; candidate_version: string }
);
export type HsCheckRow = { id: number; dataset: 'hsk' | 'standard_names'; checked_at: string; next_check_at: string; ok: boolean;
  metadata: Record<string, string | null> | null; change_key: string | null; error_code: string | null };
export type HsApprovalRow = { version_id: string; previous_version_id: string; notice_id: string | null; approved_by: string;
  reason: string; approved_at: string; review_result: { count: number } };
export type HsHistory = { checks: HsCheckRow[]; approvals: HsApprovalRow[] };

export function hs_refresh_enabled() {
  return Boolean(accessory_db() && process.env.HS_REFRESH_DATABASE_URL);
}

// 작업자에게는 실행에 필요한 환경 변수만 넘긴다 (AI 키 등은 넘기지 않음)
const PASS_ENV = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PYTHONPATH', 'VIRTUAL_ENV'];
const pick_env = () => Object.fromEntries(PASS_ENV.filter((k) => process.env[k]).map((k) => [k, process.env[k] as string]));

const python = () => process.env.HS_REFRESH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

export function run_hs_worker<T>(request: Record<string, unknown>): Promise<T> {
  if (!hs_refresh_enabled()) return Promise.reject(new Error('갱신 작업자가 꺼져 있어요 (로컬 DB와 HS_REFRESH_DATABASE_URL 필요)'));
  const script = path.join(process.cwd(), 'scripts', 'hs_refresh_cli.py');
  return new Promise((resolve, reject) => {
    const child = execFile(python(), [script], {
      timeout: 180_000, maxBuffer: 50 * 1024 * 1024,
      env: { ...pick_env(), HS_REFRESH_DATABASE_URL: process.env.HS_REFRESH_DATABASE_URL, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } as unknown as NodeJS.ProcessEnv,
    }, (error: Error | null, stdout: string) => {
      const line = stdout.trim().split('\n').pop() ?? '';
      try {
        const out = JSON.parse(line) as { ok: boolean; result?: T; error?: string };
        if (out.ok) resolve(out.result as T);
        else reject(new Error(out.error ?? 'worker_failed'));
      } catch {
        reject(new Error(error ? `작업자 실행 실패: ${error.message.split('\n')[0]}` : '작업자 응답을 읽지 못했어요'));
      }
    });
    child.stdin?.end(JSON.stringify(request));
  });
}

/** 화면에 보여 준 비교 결과와 승인 직전 비교 결과가 같은지 확인하는 값 */
export const hs_diff_hash = (d: HsDifferences) => createHash('sha256').update(JSON.stringify(d)).digest('hex');

// 작업자 · DB 오류를 화면용 한국어로 (모르는 오류는 원문 그대로)
const ERROR_TEXT: [RegExp, string][] = [
  [/Notice missing or already resolved/, '알림이 이미 처리되었어요. 새로고침 후 다시 해 주세요'],
  [/Active version changed|Active or staged version changed/, '그사이 지금 쓰는 데이터가 바뀌었어요. 다시 올려 비교해 주세요'],
  [/Comparison changed/, '그사이 비교 결과가 바뀌었어요. 다시 확인해 주세요'],
  [/Candidate is not staged/, '이미 적용했거나 없는 파일이에요'],
  [/Candidate dataset incomplete/, '새 데이터가 비어 있어요. 파일을 다시 올려 주세요'],
  [/Approver and reason required/, '승인한 사람과 사유를 적어 주세요'],
  [/Uploaded file differs from active version/, '올린 파일이 지금 쓰는 파일과 달라요. 변경 없음으로 처리할 수 없어요'],
  [/Unexpected HSK (sheets|headers)|HSK sheets missing/, 'HS부호 단위별 품목명 파일 형식이 아니에요'],
  [/Unexpected standard-name headers/, '표준품명 파일 형식이 아니에요'],
  [/Invalid HS code|Ambiguous numeric HS code|Nonliteral HS code/, '파일 안에 HS 부호 형식이 맞지 않는 줄이 있어요'],
  [/ForeignKeyViolation|foreign key/i, '표준품명에 HS 코드표에 없는 부호가 있어요. 두 파일 기준일이 같은지 확인해 주세요'],
  [/Oversized workbook|exceeds 20 MB/, '파일이 너무 커요'],
  [/OperationalError|connection failed/, 'DB에 연결하지 못했어요'],
  [/ModuleNotFoundError/, '작업자 준비가 안 됐어요 (psycopg · openpyxl 설치 필요)'],
];
export const hs_error_text = (m: string) => ERROR_TEXT.find(([re]) => re.test(m))?.[1] ?? m;
