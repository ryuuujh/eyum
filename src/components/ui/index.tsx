// [공용] 화면 기본 부품 (Claude). 제품 관리 · 부속물품 · HS 화면이 같이 쓴다.
// 새 모양이 필요하면 여기에 더하고 [공용] PR로 알린다. 화면 파일 안에서 같은 모양을 다시 만들지 않는다.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { STATUS_LABEL, type FieldStatusValue } from '@/features/products/types';

// ---- 색 · 글자 · 모양 (Tailwind 클래스) ----
export const BRAND = '#2f5bd3';
export const ui = {
  page: 'mx-auto max-w-5xl px-4 py-8',                         // 모든 화면의 바깥 틀
  h1: 'text-2xl font-bold',                                     // 화면 제목 (목록 화면은 text-xl)
  sub: 'mt-1 text-sm text-slate-500',                           // 제목 아래 한 줄 요약
  back: 'text-sm text-slate-500 hover:underline',               // ← 돌아가기 링크
  card: 'rounded-lg bg-white p-5 ring-1 ring-slate-200',        // 입력 칸을 담는 흰 상자
  note: 'rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-slate-200',  // 한 줄 요약 상자
  btnPrimary: 'rounded-md bg-[#2f5bd3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2849ad] disabled:opacity-60',
  btnSecondary: 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50',
  btnSmall: 'whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium',   // 표 안 버튼 (테두리 색은 따로)
  btnSmallPrimary: 'whitespace-nowrap rounded-md border border-[#2f5bd3] px-2.5 py-1 text-xs font-medium text-[#2f5bd3] hover:bg-[#eef2fc]',
  btnSmallSecondary: 'whitespace-nowrap rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50',
  input: 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2f5bd3] focus:ring-1 focus:ring-[#2f5bd3]',
  label: 'mb-1 text-sm font-medium text-slate-700',
  hint: 'mt-1.5 text-xs text-slate-500',
  error: 'rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700',
  warn: 'rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800',
  th: 'px-4 py-2.5 text-left font-medium text-slate-500',
  td: 'px-4 py-3 align-top',
  tr: 'border-t border-slate-100',
  formGrid: 'grid gap-5 sm:grid-cols-3',                        // 입력 칸은 3열 격자
} as const;

// ---- 화면 머리 ----
export function PageHeader({ back, title, sub, actions }: { back?: { href: string; label: string }; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      {back && <Link href={back.href} className={ui.back}>← {back.label}</Link>}
      <div className={`${back ? 'mt-2' : ''} flex flex-wrap items-end justify-between gap-3`}>
        <div>
          <h1 className={ui.h1}>{title}</h1>
          {sub && <p className={ui.sub}>{sub}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </>
  );
}

// ---- 가로 탭 (밑줄형). count가 있으면 이름 옆에 작게 ----
export function TabBar<K extends string>({ tabs, value, onChange, className = 'mt-6' }: { tabs: { key: K; label: string; count?: string }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={`${className} flex gap-6 overflow-x-auto border-b border-slate-200 text-sm`}>
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 font-semibold ${value === t.key ? 'border-[#2f5bd3] text-[#2f5bd3]' : 'border-transparent text-slate-500'}`}>
          {t.label}{t.count && <span className="ml-1.5 text-xs font-normal text-slate-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- 구역 제목: [먼저] 모아야 할 자료 3개 ----
export function Section({ step, title, count, children }: { step?: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-baseline gap-2 text-base font-bold">
        {step && <span className="text-sm font-semibold text-[#2f5bd3]">[{step}]</span>}
        {title}{count != null && <span className="text-sm font-normal text-slate-500">{count}개</span>}
      </h2>
      {children}
    </section>
  );
}

// ---- 표: 흰 바탕 · 회색 머리 · 줄 사이 옅은 선 ----
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr>{head.map((h, i) => <th key={h + i} className={ui.th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ---- 입력 칸 묶음: 이름 + (선택) + 입력 + 아래 안내 ----
export function Field({ label, children, span = 1, optional }: { label: string; children: ReactNode; span?: 1 | 2 | 3; optional?: boolean }) {
  return (
    <div className={span === 3 ? 'sm:col-span-3' : span === 2 ? 'sm:col-span-2' : ''}>
      <div className={ui.label}>{label}{optional && <span className="ml-1 font-normal text-slate-400">(선택)</span>}</div>
      {children}
    </div>
  );
}

// ---- 확인 상태 글자 (칩 · 배경 없이 글자색만) ----
export const STATUS_COLOR: Record<FieldStatusValue, string> = {
  confirmed: 'text-emerald-700', needs_check: 'text-amber-700', missing: 'text-amber-700', on_hold: 'text-amber-700', not_applicable: 'text-slate-400',
};
export function StatusText({ status }: { status: FieldStatusValue }) {
  return <span className={`whitespace-nowrap ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

// ---- 필요한 탭 표시: 규제 · 라벨 · 서류 (글자색만) ----
export const USE_TAB_COLOR: Record<string, string> = { 규제: 'text-rose-700', 라벨: 'text-amber-700', 서류: 'text-sky-700' };
export function UseTabs({ uses }: { uses: string[] }) {
  return <span className="whitespace-nowrap">{uses.map((u, i) => <span key={u} className={USE_TAB_COLOR[u]}>{i ? ' · ' : ''}{u}</span>)}</span>;
}

// ---- 빈 값 ----
export const Empty = () => <span className="text-slate-400">—</span>;
