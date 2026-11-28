// 공식 엑셀 올리기 (Claude, 11/27). 파일은 서버 임시 폴더에만 두고 처리 후 지운다. AI로 보내지 않음.
// 서버 액션 기본 크기 제한(1MB)보다 큰 공식 파일 때문에 일반 요청 처리기로 받는다.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { hs_error_text, hs_refresh_enabled, run_hs_worker, type HsUploadResult } from '@/features/products/hs_refresh';

const MAX = 20_000_000;
const back = (req: Request, q: Record<string, string>) =>
  NextResponse.redirect(new URL(`/products/hs_data?${new URLSearchParams(q)}#update`, req.url), 303);

export async function POST(req: Request) {
  if (!hs_refresh_enabled()) return back(req, { error: '갱신 작업자가 꺼져 있어요' });
  const form = await req.formData();
  const files = (['hsk', 'standard'] as const)
    .map((key) => [key, form.get(key)] as const)
    .filter((e): e is readonly ['hsk' | 'standard', File] => e[1] instanceof File && e[1].size > 0);
  if (files.length === 0) return back(req, { error: '올릴 파일을 하나 이상 골라 주세요' });
  if (files.some(([, f]) => f.size > MAX)) return back(req, { error: '파일 하나는 20MB까지 올릴 수 있어요' });
  if (files.some(([, f]) => !f.name.toLowerCase().endsWith('.xlsx'))) return back(req, { error: '엑셀(.xlsx) 파일만 올릴 수 있어요' });
  const notice = String(form.get('notice') ?? '') || null;
  const by = String(form.get('by') ?? '').trim();
  if (notice && !by) return back(req, { error: '알림을 같이 처리하려면 확인한 사람 이름을 적어 주세요' });

  const dir = await mkdtemp(path.join(os.tmpdir(), 'heyum-hs-'));
  try {
    const paths: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const [key, file] of files) {
      paths[key] = path.join(dir, `${key}.xlsx`);
      await writeFile(paths[key], Buffer.from(await file.arrayBuffer()));
      names[key] = path.basename(file.name);
    }
    const r = await run_hs_worker<HsUploadResult>({ action: 'upload', files: paths, names, notice, by });
    if (r.status === 'no_change') return back(req, { msg: r.notice_resolved ? 'no_change_resolved' : 'no_change' });
    if (r.status === 'already_approved') return back(req, { msg: 'already_approved' });
    return back(req, { candidate: r.candidate_version, msg: r.status });
  } catch (e) {
    return back(req, { error: hs_error_text((e as Error).message) });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
