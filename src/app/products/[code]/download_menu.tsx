'use client';
// 제품 상세 내려받기 메뉴 (Claude): 파일 종류 → 넣을 항목 선택 → 외부 공유용 → 내려받기
import { useEffect, useRef, useState } from 'react';

export type Part = { key: string; label: string; count?: number };
type Kind = 'summary' | 'request';

export function DownloadMenu({ code, summaryParts, requestParts }: { code: string; summaryParts: Part[]; requestParts: Part[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('summary');
  const [external, setExternal] = useState(false);
  const [picked, setPicked] = useState<Record<Kind, string[]>>({ summary: summaryParts.map((p) => p.key), request: requestParts.map((p) => p.key) });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const parts = kind === 'summary' ? summaryParts : requestParts;
  const sel = picked[kind];
  const all = sel.length === parts.length;
  const toggle = (k: string) => setPicked((x) => ({ ...x, [kind]: x[kind].includes(k) ? x[kind].filter((y) => y !== k) : parts.map((p) => p.key).filter((y) => y === k || x[kind].includes(y)) }));
  const href = `/products/${code}/download?type=${kind}${all ? '' : `&parts=${sel.join(',')}`}${external ? '&external=1' : ''}`;

  const KINDS: [Kind, string, string][] = [
    ['summary', '제품 정보 정리본', '값만 깔끔하게 정리돼요. 보관하거나 다른 곳에 보낼 때 써요.'],
    ['request', '자료 요청 목록', '비어 있거나 확인이 필요한 칸만 모아요. 제조사나 담당자가 노란 칸을 채워 돌려주면 다시 올려요.'],
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((x) => !x)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">내려받기 ▾</button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-lg">
          <div className="space-y-1">
            {KINDS.map(([k, label, desc]) => (
              <label key={k} className={`flex cursor-pointer gap-2.5 rounded-md px-3 py-2.5 ${kind === k ? 'bg-[#2f5bd3]/5 ring-1 ring-[#2f5bd3]/40' : 'hover:bg-slate-50'}`}>
                <input type="radio" name="kind" className="mt-1" checked={kind === k} onChange={() => setKind(k)} />
                <span><span className="font-semibold">{label} (엑셀)</span><span className="mt-0.5 block text-xs text-slate-500">{desc}</span></span>
              </label>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">넣을 항목</span>
              <button className="text-xs text-[#2f5bd3]" onClick={() => setPicked((x) => ({ ...x, [kind]: all ? [] : parts.map((p) => p.key) }))}>
                {all ? '모두 해제' : '모두 선택'}
              </button>
            </div>
            {parts.length === 0 ? (
              <p className="text-xs text-slate-500">요청할 칸이 없어요.</p>
            ) : (
              <div className="grid gap-1.5">
                {parts.map((p) => (
                  <label key={p.key} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={sel.includes(p.key)} onChange={() => toggle(p.key)} />
                    <span>{p.label}</span>
                    {p.count != null && <span className="text-xs text-slate-400">{p.count}칸</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="mt-4 flex cursor-pointer gap-2 border-t border-slate-100 pt-3">
            <input type="checkbox" className="mt-0.5" checked={external} onChange={(e) => setExternal(e.target.checked)} />
            <span>
              <span className="font-medium">외부 공유용으로 내려받기</span>
              <span className="mt-0.5 block text-xs text-slate-500">단가와 라벨에 나오지 않는 위탁 제조사 이름을 빼고 내려받아요. 바이어 · 인증기관 등 회사 밖으로 보낼 때 켜 주세요.</span>
            </span>
          </label>

          {sel.length === 0 ? (
            <div className="mt-4 rounded-md bg-slate-100 py-2.5 text-center text-sm text-slate-400">항목을 하나 이상 골라 주세요</div>
          ) : (
            <a download href={href} onClick={() => setOpen(false)}
              className="mt-4 block rounded-md bg-[#2f5bd3] py-2.5 text-center text-sm font-semibold text-white">
              {all ? '전체 내려받기' : `${sel.length}개 항목 내려받기`}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
