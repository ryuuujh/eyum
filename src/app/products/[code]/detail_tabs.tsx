'use client';
// 제품 상세 하위 탭 (Claude)
import { useState } from 'react';
import Link from 'next/link';
import { Section, Table, UseTabs as Uses, ui } from '@/components/ui';
import { FORM_TAB_LABEL, form_tab_of, type FormTab } from '@/features/products/fields';
import { STATUS_LABEL, WAIT_REASON_LABEL, type Nutrition } from '@/features/products/types';
import type { DetailView, TodoItem } from '@/features/products/view';
import type { NutritionResult } from '@/features/products/nutrition';

type Comp = { name: string; amount: number; unit: string; quantity: number };



const td = ui.td;

const btn = ui.btnSmall;
/** 할 일 한 줄에서 바로 채우기: 아무 자료나 올리기(AI가 칸을 찾음) 또는 그 칸이 있는 수정 화면 탭으로.
 *  한 줄의 칸이 여러 탭에 나뉘어 있으면 탭마다 버튼을 하나씩 둔다. */
function FillButtons({ code, items }: { code: string; items: TodoItem[] }) {
  const tabs = [...new Set(items.map((it) => { const [entity, , key] = it.key.split(':'); return form_tab_of(entity, key); }))] as FormTab[];
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <Link href={`/products/${code}/import?mode=text`} className={`${btn} border-[#2f5bd3] text-center text-[#2f5bd3] hover:bg-[#eef2fc]`}>자료 올리기</Link>
      {tabs.map((t) => (
        <Link key={t} href={`/products/${code}/edit?tab=${t}`} className={`${btn} border-slate-300 text-center text-slate-700 hover:bg-slate-50`}>
          {tabs.length > 1 ? `직접 입력 · ${FORM_TAB_LABEL[t]}` : '직접 입력'}
        </Link>
      ))}
    </div>
  );
}

export function DetailTabs({ code, view, nutrition, components }: { code: string; view: DetailView; nutrition: NutritionResult; components: Comp[] }) {
  const [tab, setTab] = useState<'todo' | 'info'>('todo');
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const empty_count = view.requests.reduce((n, r) => n + r.fields.length, 0);

  return (
    <>
      <div className="mt-6 flex gap-6 border-b border-slate-200 text-sm">
        {([['todo', `할 일 (${view.total})`], ['info', '제품 정보']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-2.5 font-semibold ${tab === k ? 'border-[#2f5bd3] text-[#2f5bd3]' : 'border-transparent text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'todo' ? (
        <div>
          <p className="mt-6 rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
            아직 끝나지 않은 일이 <b>{view.total}개</b> 있어요. 비어 있는 칸 {empty_count}개는 자료를 모아 채워야 하고,
            값이 있는 {view.checks.length}개는 맞는지 확인하면 돼요.
            {view.waiting.length > 0 && <> 나머지 {view.waiting.length}개는 답을 기다리는 중이에요.</>}
          </p>

          <Section step="먼저" title="모아야 할 자료" count={view.requests.length}>
            <p className="-mt-1 mb-3 text-xs text-slate-500">갖고 있는 자료가 있으면 아무 파일이나 올리고, 없으면 직접 입력해요. ⓘ를 누르면 어떤 자료에 있는지 예시가 보여요.</p>
            <Table head={['필요한 내용', '채워지는 칸', '필요한 탭', '채우기']}>
              {view.requests.map((r) => (
                <tr key={r.title} className="border-t border-slate-100">
                  <td className={`${td} w-56`}>
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold">{r.title}</span>
                      <button type="button" aria-label="어떤 자료에 있는지 보기" aria-expanded={openInfo === r.title}
                        onClick={() => setOpenInfo(openInfo === r.title ? null : r.title)}
                        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border text-[10px] font-bold leading-none ${openInfo === r.title ? 'border-[#2f5bd3] bg-[#2f5bd3] text-white' : 'border-slate-400 text-slate-500 hover:border-[#2f5bd3] hover:text-[#2f5bd3]'}`}>i</button>
                    </div>
                    {openInfo === r.title && (
                      <p className="mt-1.5 rounded bg-slate-50 px-2 py-1.5 text-xs leading-relaxed text-slate-600">이런 자료에 있어요 (예시): {r.where}</p>
                    )}
                  </td>
                  <td className={td}>{r.fields.join(', ')}</td>
                  <td className={td}><Uses uses={r.uses} /></td>
                  <td className={`${td} w-36`}><FillButtons code={code} items={r.items} /></td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section step="다음" title="확인이 필요한 값" count={view.checks.length}>
            <Table head={['구성품', '항목', '지금 값', '확인할 점', '필요한 탭', '']}>
              {view.checks.map((t) => (
                <tr key={t.scope + t.def.key} className="border-t border-slate-100">
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{t.scope}</td>
                  <td className={`${td} whitespace-nowrap font-semibold`}>{t.def.label}</td>
                  <td className={td}>{t.value}</td>
                  <td className={`${td} text-slate-600`}>{t.row?.note ?? '값이 맞는지 확인'}</td>
                  <td className={td}><Uses uses={t.def.uses} /></td>
                  <td className={`${td} w-28`}><Link href={`/products/${code}/edit?tab=${form_tab_of(t.key.split(':')[0], t.key.split(':')[2])}`} className={`${btn} block border-slate-300 text-center text-slate-700 hover:bg-slate-50`}>확인하러 가기</Link></td>
                </tr>
              ))}
            </Table>
          </Section>

          {view.waiting.length > 0 && (
            <Section title="기다리는 중" count={view.waiting.length}>
              <div className="rounded-lg border border-dashed border-slate-300 bg-white">
                <table className="w-full text-sm">
                  <thead><tr>{['구성품', '항목', '지금 값', '누구에게', '요청한 날'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {view.waiting.map((t) => (
                      <tr key={t.scope + t.def.key} className="border-t border-dashed border-slate-200">
                        <td className={`${td} text-slate-600`}>{t.scope}</td>
                        <td className={`${td} font-semibold`}>{t.def.label}</td>
                        <td className={td}>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">비어 있음</span>
                          {t.row?.wait_reason && <span className="ml-2 text-slate-600">{WAIT_REASON_LABEL[t.row.wait_reason]}</span>}
                        </td>
                        <td className={td}>{t.row?.wait_who ?? '—'}</td>
                        <td className={`${td} text-slate-600`}>{t.row?.requested_at ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">요청한 지 7일이 지나면 다시 위 목록으로 올라와요.</p>
            </Section>
          )}
        </div>
      ) : (
        <div>
          {view.info.map((sec, i) => (
            <Section key={sec.scope + i} title={i === 0 ? `${sec.scope} 기본 정보` : sec.scope} count={sec.items.length}>
              <Table head={['항목', '값', '상태']}>
                {sec.items.map((t) => <InfoRow key={t.def.key} t={t} />)}
              </Table>
            </Section>
          ))}
          <NutritionTable n={nutrition} components={components} />
        </div>
      )}
    </>
  );
}

function InfoRow({ t }: { t: TodoItem }) {
  const color = t.status === 'confirmed' ? 'text-emerald-700' : t.status === 'not_applicable' ? 'text-slate-400' : 'text-amber-700';
  return (
    <tr className="border-t border-slate-100">
      <td className={`${td} w-40 whitespace-nowrap text-slate-600`}>{t.def.label}</td>
      <td className={td}>{t.value ?? <span className="text-slate-400">—</span>}</td>
      <td className={`${td} w-28 whitespace-nowrap ${color}`}>{STATUS_LABEL[t.status]}</td>
    </tr>
  );
}


const NUT_ROWS: [keyof Nutrition, string, string][] = [
  ['kcal', '열량', 'kcal'], ['sodium_mg', '나트륨', 'mg'], ['carb_g', '탄수화물', 'g'], ['sugar_g', '당류', 'g'],
  ['fat_g', '지방', 'g'], ['sat_fat_g', '포화지방', 'g'], ['trans_fat_g', '트랜스지방', 'g'], ['cholesterol_mg', '콜레스테롤', 'mg'],
  ['protein_g', '단백질', 'g'],
];
const fmt = (v: number | null | undefined) => (v == null ? '—' : Math.round(v * 100) / 100);

function NutritionTable({ n, components }: { n: NutritionResult; components: Comp[] }) {
  return (
    <Section title="영양성분 (구성품 합산)" count={NUT_ROWS.length}>
      <p className="mb-2 text-xs text-slate-500">
        {components.map((c) => `${c.name} ${c.amount}${c.unit}${c.quantity > 1 ? `×${c.quantity}` : ''}`).join(' + ')}
      </p>
      <Table head={['성분', '제품 전체', '1회 제공량', '100g당']}>
        {NUT_ROWS.map(([k, label, unit]) => (
          <tr key={k} className="border-t border-slate-100">
            <td className={`${td} text-slate-600`}>{label} ({unit})</td>
            <td className={td}>{fmt(n.total[k])}</td>
            <td className={td}>{fmt(n.perServing[k])}</td>
            <td className={td}>{n.per100g ? fmt(n.per100g[k]) : <span className="text-amber-700">보류</span>}</td>
          </tr>
        ))}
      </Table>
      {n.heldReasons.length > 0 && <p className="mt-2 text-xs text-amber-700">100g당 보류: {n.heldReasons.join(' / ')}</p>}
    </Section>
  );
}
