'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apply_imported, prepare_text, preview_request_file, send_to_ai } from '@/features/products/save';
import type { Change } from '@/features/products/import_request';

const ANSWER_LABEL: Record<string, string> = {
  asking_supplier: '제조사에 확인 중', undecided: '아직 정하지 않음', not_applicable: '해당 없음', unknown: '모름', confirm: '지금 값이 맞음',
};

export function ImportRequest({ code, initialMode = 'request' }: { code: string; initialMode?: 'request' | 'text' }) {
  const [mode, setMode] = useState<'request' | 'text'>(initialMode);
  const [text, setText] = useState('');
  const [removed, setRemoved] = useState<string[]>([]);
  const [clean, setClean] = useState<string | null>(null);   // 지운 뒤 AI로 보낼 글 (사람이 확인 · 수정)
  const [masks, setMasks] = useState<Record<string, string>>({});   // 가린 표시 → 원래 값 (AI로 안 보냄, 답을 되돌릴 때만)
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  const on_file = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    start(async () => {
      const r = await preview_request_file(code, fd);
      setChanges(r.changes); setWarnings(r.warnings); setPicked(r.changes.map((c) => c.key)); setErrors([]);
    });
  };
  const read_text = (file?: File) => {
    const fd = new FormData(); fd.append('text', text); if (file) fd.append('file', file);
    start(async () => {
      const r = await prepare_text(code, fd);
      setClean(r.clean || null); setMasks(r.masks); setRemoved(r.removed); setWarnings(r.warnings); setChanges(null); setErrors([]);
    });
  };
  const send = () => start(async () => {
    const r = await send_to_ai(code, clean ?? '', masks);
    // AI를 부르지 못했으면(키 없음 · 차단 등) "저장 전 확인할 내용 0개" 대신 안내만 보여 준다
    setChanges(r.changes.length === 0 && r.warnings.length > 0 ? null : r.changes); setWarnings(r.warnings); setPicked(r.changes.map((c) => c.key)); setErrors([]);
  });
  const switch_mode = (m: 'request' | 'text') => { setMode(m); setChanges(null); setWarnings([]); setRemoved([]); setClean(null); setMasks({}); };
  const apply = () => start(async () => {
    const r = await apply_imported(code, (changes ?? []).filter((c) => picked.includes(c.key)), mode === 'text' ? 'ai' : 'company');
    if (!r.ok) { setErrors(r.errors); return; }
    router.push(`/products/${code}`); router.refresh();
  });

  return (
    <div className="mt-6">
      <div className="flex gap-6 border-b border-slate-200 text-sm">
        {([['request', '채운 요청 목록'], ['text', '메일 · 자료 글 (AI가 읽기)']] as const).map(([k, l]) => (
          <button key={k} onClick={() => switch_mode(k)}
            className={`-mb-px border-b-2 pb-2.5 font-semibold ${mode === k ? 'border-[#2f5bd3] text-[#2f5bd3]' : 'border-transparent text-slate-500'}`}>{l}</button>
        ))}
      </div>

      {mode === 'request' ? (
        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center hover:border-[#2f5bd3]">
          <span className="font-semibold">{pending && !changes ? '읽는 중…' : '요청 목록 엑셀 고르기'}</span>
          <span className="mt-1 text-xs text-slate-500">.xlsx · 화면에서 내려받은 파일 그대로 (노란 칸만 채우면 돼요)</span>
          <input type="file" accept=".xlsx" className="hidden" onChange={(e) => on_file(e.target.files?.[0])} />
        </label>
      ) : clean === null ? (
        <div className="mt-5 rounded-lg bg-white p-5 ring-1 ring-slate-200">
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="제조사에서 받은 메일 본문이나 사양서 내용을 붙여 넣어 주세요."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2f5bd3]" />
          <p className="mt-2 text-xs text-slate-500">먼저 코드가 주소 · 연락처 · 단가를 가리고 배합비를 지운 글을 보여드려요. 확인하고 직접 고친 뒤에 AI로 보내요. 스캔본 PDF · 사진은 받지 않아요.</p>
          <ForbiddenNotice />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="cursor-pointer text-sm text-[#2f5bd3]">
              또는 파일 고르기 (PDF · 엑셀 · .txt · .eml)
              <input type="file" accept=".pdf,.xlsx,.csv,.txt,.eml,.md" className="hidden" onChange={(e) => read_text(e.target.files?.[0])} />
            </label>
            <button disabled={pending || !text.trim()} onClick={() => read_text()} className="rounded-md bg-[#2f5bd3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? '지우는 중…' : '지운 글 확인하기'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-base font-bold">AI로 보낼 글 확인</h2>
          <p className="mt-1 text-sm text-slate-600">
            아래 글만 AI로 보내요. 주소 · 연락처 · 단가는 [주소1] · [금액1]처럼 가려져 있고, AI가 그 표시를 칸에 넣으면 저장 전 확인 화면에서 원래 값으로 되돌려 보여드려요. 원래 값은 AI로 보내지 않아요.
            <b> 지워지지 않은 기밀(해외 주소, 통화 표시 없는 가격, 함량 % 등)이 보이면 여기서 직접 지워 주세요.</b>
          </p>
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">코드가 가리거나 지운 것: {removed.length ? removed.join(', ') : '없음'}</p>
          <textarea rows={12} value={clean} onChange={(e) => { setClean(e.target.value); setChanges(null); }}
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-[#2f5bd3]" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <button onClick={() => { setClean(null); setMasks({}); setChanges(null); setRemoved([]); }} className="text-sm text-slate-500 hover:underline">← 다른 자료 고르기</button>
            <button disabled={pending || !clean.trim()} onClick={send} className="rounded-md bg-[#2f5bd3] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? 'AI가 읽는 중…' : '확인했어요, AI로 보내기'}
            </button>
          </div>
        </div>
      )}

      {mode === 'request' && removed.length > 0 && <p className="mt-4 text-xs text-slate-500">지운 것: {removed.join(', ')}</p>}
      {warnings.length > 0 && <ul className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      {changes && (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-bold">저장 전 확인할 내용 <span className="text-sm font-normal text-slate-500">{changes.length}개</span></h2>
          {changes.length === 0 ? (
            <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">채워진 칸이 없어요.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={picked.length === changes.length} onChange={(e) => setPicked(e.target.checked ? changes.map((c) => c.key) : [])} /></th>
                    {['구성품', '항목', '지금 값', '새 값', ...(mode === 'text' ? ['자료 속 근거'] : [])].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.key} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3"><input type="checkbox" checked={picked.includes(c.key)} onChange={() => setPicked((x) => (x.includes(c.key) ? x.filter((k) => k !== c.key) : [...x, c.key]))} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{c.scope}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{c.label}</td>
                      <td className="px-4 py-3 text-slate-500">{c.current ?? '—'}</td>
                      <td className="whitespace-pre-line px-4 py-3">
                        {c.value ?? <span className="text-slate-600">{ANSWER_LABEL[c.answer]}</span>}
                        {c.restored && <span className="mt-1 block text-xs text-slate-500">가렸던 값을 되돌렸어요</span>}
                      </td>
                      {mode === 'text' && <td className="px-4 py-3 text-xs text-slate-500">{c.evidence}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors.length > 0 && <ul className="mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {changes.length > 0 && (
            <div className="mt-4 flex items-center justify-end gap-3">
              <span className="text-xs text-slate-500">{mode === 'text' ? 'AI가 읽은 값은 ‘확인 필요’로 저장돼요. 할 일 탭에서 확인해 주세요.' : '적용한 값은 ‘확인됨’이 돼요.'}</span>
              <button disabled={pending || picked.length === 0} onClick={apply} className="rounded-md bg-[#2f5bd3] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pending ? '적용 중…' : `${picked.length}개 적용`}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** 올리면 안 되는 자료 안내 (기밀 업로드 방지, 11/27 채채 결정) */
function ForbiddenNotice() {
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">이런 내용은 올리지 마세요</p>
      <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed">
        <li>배합비 · 원료별 정확한 함량(%) (라벨에 표기된 함량은 괜찮아요)</li>
        <li>원료 공급처 · 제조 방법 · 공정 조건</li>
        <li>원가 계산표 · 거래 조건 (단가 한 줄은 코드가 가려요)</li>
        <li>품목제조보고서 (배합비가 들어 있어요)</li>
      </ul>
      <p className="mt-2 text-xs leading-relaxed">
        꼭 필요한 자료에 이런 내용이 섞여 있으면 먼저 가려 주세요.
        엑셀 · 글 파일은 그 줄 · 열을 지운 사본을 올려 주세요. PDF 위에 검은 상자나 마스킹을 덧그리면 글자가 그대로 남아 코드가 읽어요. 이럴 땐 필요한 부분만 복사해 붙여 넣어 주세요.
        종이 자료는 해당 부분을 마스킹 테이프로 가린 뒤 필요한 글만 옮겨 적어 주세요 (사진 · 스캔본은 받지 않아요).
      </p>
    </div>
  );
}
