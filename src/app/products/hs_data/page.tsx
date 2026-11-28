// 공식 HS 데이터 확인 · 갱신 (Claude, 11/27). 임시 화면: 메뉴 위치 · 디자인은 통합 때 정한다.
// 흐름: 수동 확인 → 공식 엑셀 올리기 → 바뀐 부호 · 영향 품목 보기 → 승인(한 번에 적용, 실패하면 지금 데이터 유지)
// 승인은 로그인 · 권한이 정해지기 전까지 로컬 DB + 비운영 + HS_REFRESH_DATABASE_URL일 때만 보인다.
import { PageHeader, ui } from '@/components/ui';
import { format_hs_code } from '@/features/products/hs_format';
import { get_hs_data_status, HS_DATASET_LABEL, HS_OFFICIAL_LINKS } from '@/features/products/hs_data';
import { approve_hs_update, check_hs_now, mark_hs_notice_no_change, read_hs_notice } from '@/features/products/hs_data_actions';
import { hs_diff_hash, hs_error_text, hs_refresh_enabled, run_hs_worker, type HsCompare, type HsHistory } from '@/features/products/hs_refresh';

export const dynamic = 'force-dynamic';

const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—');
const meta = (m: Record<string, unknown>, k: string) => (m[k] == null ? '—' : String(m[k]));
const code = (c: string) => (c.length >= 6 ? format_hs_code(c) : c);
const KIND = { added: '추가', removed: '삭제', changed: '이름 바뀜' } as const;
const MSG: Record<string, string> = {
  check_baseline: '처음 확인이라 지금 정보를 기준으로 기록했어요.',
  check_unchanged: '공식 정보가 그대로예요.',
  check_changed: '공식 정보가 바뀌었어요. 아래 알림을 확인해 주세요.',
  check_failed: '자동 확인에 실패했어요. 공공데이터포털에서 직접 확인해 주세요.',
  no_change: '지금 쓰는 파일과 같아요. 바뀐 것이 없어요.',
  no_change_resolved: '지금 쓰는 파일과 같아서 알림을 "변경 없음"으로 처리했어요.',
  already_approved: '이미 적용했던 파일이에요.',
  staged: '새 파일을 넣었어요(아직 적용 전). 아래 바뀐 내용을 보고 승인해 주세요.',
  already_staged: '이미 올려 둔 파일이에요(아직 적용 전). 아래 바뀐 내용을 보고 승인해 주세요.',
};

type Search = Promise<{ msg?: string; error?: string; candidate?: string; count?: string }>;

export default async function HsDataPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const s = await get_hs_data_status().catch(() => null);
  const worker = hs_refresh_enabled();
  const history = worker ? await run_hs_worker<HsHistory>({ action: 'history' }).catch(() => null) : null;
  let cmp: HsCompare | null = null;
  let cmp_error: string | null = null;
  if (worker && s?.active && q.candidate) {
    cmp = await run_hs_worker<HsCompare>({ action: 'compare', expected: s.active.id, candidate: q.candidate })
      .catch((e: Error) => { cmp_error = e.message; return null; });
  }
  const open_notices = s?.notices.filter((n) => !n.resolution) ?? [];
  const last = (dataset: string) => history?.checks.find((c) => c.dataset === dataset) ?? null;

  return (
    <main className={ui.page}>
      <PageHeader back={{ href: '/products', label: '제품 목록' }} title="공식 HS 데이터" sub="식품 제품과 부속물품이 함께 쓰는 관세청 HS 코드표" />
      {!s ? (
        <p className={`mt-6 ${ui.note}`}>로컬 Supabase에 연결했을 때만 보여요. (로그인 기능이 생기기 전 안전장치)</p>
      ) : (
        <div className="mt-6 space-y-6">
          {q.error && <p className={ui.error} role="alert">{q.error}</p>}
          {q.msg && <p className={ui.note} role="status">{q.msg === 'approved' ? `새 데이터를 적용했어요. 재검토로 바뀐 품목 ${q.count ?? 0}개.` : MSG[q.msg] ?? q.msg}</p>}

          <section className={ui.card}>
            <h2 className="mb-3 font-bold">지금 쓰는 데이터</h2>
            {s.active ? (
              <table className="w-full text-sm"><tbody>
                <tr className={ui.tr}><th className={ui.th}>HSK 파일</th><td className={ui.td}>{meta(s.active.metadata, 'hsk_file')}</td></tr>
                <tr className={ui.tr}><th className={ui.th}>표준품명 파일</th><td className={ui.td}>{meta(s.active.metadata, 'standard_file')}</td></tr>
                <tr className={ui.tr}><th className={ui.th}>HS 부호 수</th><td className={ui.td}>{s.active.hskRows.toLocaleString()}개</td></tr>
                <tr className={ui.tr}><th className={ui.th}>적용</th><td className={ui.td}>{day(s.active.approvedAt)} · {s.active.approvedBy}</td></tr>
              </tbody></table>
            ) : <p className={ui.warn}>아직 공식 데이터가 없어요. HS 찾기를 쓰려면 먼저 넣어야 해요.</p>}
            <p className={ui.hint}>HS를 넣은 품목: 식품 {s.items.food}개 · 부속물품 옵션 {s.items.accessory}개 (검토 이력 없이 직접 넣은 것 {s.items.withoutReview}개 포함) · 재검토 필요 {s.items.needsReview}개</p>
          </section>

          <section className={ui.card}>
            <h2 className="mb-3 font-bold">알림</h2>
            {s.notices.length === 0 ? <p className="text-sm text-slate-500">알림이 없어요.</p> : (
              <ul className="space-y-3">
                {s.notices.map((n) => (
                  <li key={n.id} className="rounded-md border border-slate-200 p-3 text-sm" data-notice={n.id}>
                    <div className="font-semibold">{HS_DATASET_LABEL[n.dataset]} · {day(n.detectedAt)}</div>
                    <p className="mt-1">{n.message}</p>
                    <p className={ui.hint}>
                      {n.resolution === 'applied' ? `새 데이터 적용 완료 (${n.resolvedBy}, ${day(n.resolvedAt)})`
                        : n.resolution === 'no_change' ? `변경 없음으로 확인 (${n.resolvedBy}, ${day(n.resolvedAt)})`
                        : n.readAt ? `읽음 (${n.readBy}) · 아직 처리 안 됨` : '안 읽음 · 아직 처리 안 됨'}
                    </p>
                    {!n.resolution && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {!n.readAt && <form action={read_hs_notice.bind(null, n.id)} className="flex gap-2">
                          <input name="by" required placeholder="확인한 사람" className={`${ui.input} w-32`} /><button className={ui.btnSmallSecondary}>읽음</button></form>}
                        <form action={mark_hs_notice_no_change.bind(null, n.id)} className="flex gap-2">
                          <input name="by" required placeholder="확인한 사람" className={`${ui.input} w-32`} /><button className={ui.btnSmallSecondary}>공식 파일을 보니 변경 없음</button></form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="update" className={ui.card}>
            <h2 className="mb-3 font-bold">확인 · 갱신</h2>
            {!worker ? (
              <p className="text-sm text-slate-500">갱신 작업자가 꺼져 있어요. 로컬 점검 때 .env.local에 HS_REFRESH_DATABASE_URL을 넣으면 켜져요. (승인 기능은 권한이 정해진 뒤 공개)</p>
            ) : (
              <div className="space-y-5 text-sm">
                <table className="w-full"><thead><tr>{['데이터', '마지막 확인', '결과', '다음 확인', ''].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead><tbody>
                  {HS_OFFICIAL_LINKS.map((l) => { const c = last(l.dataset); return (
                    <tr key={l.dataset} className={ui.tr}>
                      <td className={ui.td}><a href={l.href} target="_blank" rel="noreferrer" className="text-[#2f5bd3] hover:underline">{l.label}</a><div className="text-xs text-slate-500">{l.cycle} · 공식 파일 받기</div></td>
                      <td className={ui.td}>{day(c?.checked_at)}</td>
                      <td className={ui.td}>{!c ? '—' : c.ok ? `정상${c.metadata?.dateModified ? ` (수정일 ${c.metadata.dateModified})` : ''}` : `실패 (${c.error_code})`}</td>
                      <td className={ui.td}>{day(c?.next_check_at)}</td>
                      <td className={ui.td}><form action={check_hs_now.bind(null, l.dataset)}><button className={ui.btnSmallSecondary}>지금 확인</button></form></td>
                    </tr>); })}
                </tbody></table>

                <form action="/products/hs_data/upload" method="post" encType="multipart/form-data" className="space-y-3 rounded-md border border-slate-200 p-3">
                  <div className="font-semibold">공식 엑셀 올리기</div>
                  <label className="block">HS부호 단위별 품목명 (.xlsx) <input type="file" name="hsk" accept=".xlsx" className="mt-1 block" /></label>
                  <label className="block">표준품명 (.xlsx) <input type="file" name="standard" accept=".xlsx" className="mt-1 block" /></label>
                  <p className={ui.hint}>둘 중 하나만 올려도 돼요(나머지는 지금 데이터를 그대로 씀). 올려도 승인 전에는 적용되지 않아요.</p>
                  {open_notices.length > 0 && (
                    <label className="block">같은 파일이면 이 알림을 ‘변경 없음’으로 처리
                      <select name="notice" className={`${ui.input} mt-1`}><option value="">처리 안 함</option>
                        {open_notices.map((n) => <option key={n.id} value={n.id}>{HS_DATASET_LABEL[n.dataset]} · {day(n.detectedAt)}</option>)}</select></label>)}
                  <input name="by" placeholder="확인한 사람" className={`${ui.input} w-40`} />
                  <div><button className={ui.btnPrimary}>올리고 비교하기</button> <span className={ui.hint}>표준품명 파일은 검사에 20초쯤 걸려요.</span></div>
                </form>

                {q.candidate && cmp_error && <p className={ui.error}>비교하지 못했어요: {hs_error_text(cmp_error)}</p>}
                {cmp && s.active && q.candidate && <Compare cmp={cmp} expected={s.active.id} candidate={q.candidate} notices={open_notices.map((n) => ({ id: n.id, label: `${HS_DATASET_LABEL[n.dataset]} · ${day(n.detectedAt)}` }))} />}

                {history && history.approvals.length > 0 && (
                  <div><div className="mb-1 font-semibold">승인 기록</div>
                    <ul className="space-y-1">{history.approvals.map((a) => <li key={a.version_id}>{day(a.approved_at)} · {a.approved_by} · {a.reason} · 재검토 {a.review_result.count}개</li>)}</ul></div>)}
              </div>
            )}
          </section>

          {s.versions.length > 1 && (
            <section className={ui.card}>
              <h2 className="mb-3 font-bold">버전 기록</h2>
              <table className="w-full text-sm"><thead><tr>{['넣은 날', 'HSK 파일', '상태'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead><tbody>
                {s.versions.map((v) => <tr key={v.id} className={ui.tr}><td className={ui.td}>{day(v.createdAt)}</td><td className={ui.td}>{meta(v.metadata, 'hsk_file')}</td>
                  <td className={ui.td}>{v.active ? '사용 중' : v.approvedAt ? `지난 버전 (${v.approvedBy})` : '승인 전'}</td></tr>)}
              </tbody></table>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function Compare({ cmp, expected, candidate, notices }: { cmp: HsCompare; expected: string; candidate: string; notices: { id: string; label: string }[] }) {
  const d = cmp.differences;
  const count = (k: keyof typeof KIND) => d.hsk.filter((r) => r.kind === k).length;
  const impacts = cmp.impacts.review_codes;
  const audit = cmp.impacts.standard_link_audit_codes;
  return (
    <div className="space-y-3 rounded-md border border-amber-300 p-3" data-testid="hs-compare">
      <div className="font-semibold">바뀐 내용 (아직 적용 전)</div>
      <p>HS 부호: 추가 {count('added')}개 · 삭제 {count('removed')}개 · 이름 바뀜 {count('changed')}개 / 표준품명: 바뀐 부호 {d.standard_names.length}개</p>
      {d.hsk.length > 0 && (
        <table className="w-full"><thead><tr>{['부호', '바뀐 것'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead><tbody>
          {d.hsk.slice(0, 50).map((r) => <tr key={r.code} className={ui.tr}><td className={ui.td}>{code(r.code)}</td><td className={ui.td}>{KIND[r.kind]}</td></tr>)}
        </tbody></table>)}
      {d.hsk.length > 50 && <p className={ui.hint}>그 밖에 {d.hsk.length - 50}개</p>}
      <div className="font-semibold">재검토로 바뀔 품목 {impacts.length}개</div>
      {impacts.length === 0 ? <p className="text-slate-500">확정한 품목 중 영향받는 것이 없어요.</p> : (
        <table className="w-full"><thead><tr>{['구분', '품목', '지금 HS', '관련 부호', '검토 이력'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead><tbody>
          {impacts.map((i) => <tr key={i.item_id} className={ui.tr}><td className={ui.td}>{i.item_type === 'food' ? '식품' : '부속물품'}</td><td className={ui.td}>{i.item_label}</td>
            <td className={ui.td}>{code(i.hsk10 ?? i.hs6)}</td><td className={ui.td}>{i.matched_codes.map(code).join(', ')}</td>
            <td className={ui.td}>{i.hs_classification_id ? '있음' : '없음(직접 입력)'}</td></tr>)}
        </tbody></table>)}
      {audit.length > 0 && <p className={ui.hint}>표준품명이 다른 부호로 옮겨진 것 같은 품목 {audit.length}개는 자동으로 재검토하지 않아요. 직접 확인해 주세요: {audit.map((i) => i.item_label).join(', ')}</p>}
      <p className={ui.hint}>{impacts.length > 0 ? '승인하면 새 데이터로 바뀌고 위 품목만 ‘재검토 필요’가 돼요. 확정한 HS 값 · 확정자 · 이력은 그대로 남아요.' : '승인하면 새 데이터로 바뀌어요. 재검토로 바뀌는 품목은 없어요.'} 중간에 실패하면 아무것도 바뀌지 않아요.</p>
      <form action={approve_hs_update} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="expected" value={expected} />
        <input type="hidden" name="candidate" value={candidate} />
        <input type="hidden" name="diff_hash" value={hs_diff_hash(d)} />
        {notices.length > 0 && <select name="notice" className={`${ui.input} w-64`}><option value="">관련 알림 없음</option>
          {notices.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>}
        <input name="by" required placeholder="승인한 사람" className={`${ui.input} w-36`} />
        <input name="reason" required placeholder="사유 (예: 2026-12 개정)" className={`${ui.input} w-56`} />
        <button className={ui.btnPrimary}>승인하고 적용</button>
      </form>
    </div>
  );
}
