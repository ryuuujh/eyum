// 제품 목록 화면 아래 부속물품 목록 (Claude, 11/27). 옵션마다 한 줄, "서류 포함" 체크.
import Link from 'next/link';
import { Empty, StatusText, ui } from '@/components/ui';
import { format_hs_code } from '@/features/products/hs_format';
import { list_accessories } from '../data';
import { ExportSelectionCheckbox } from '../export_selection_checkbox';

export async function AccessoryList() {
  const items = await list_accessories().catch(() => null);
  return (
    <section id="accessories" className={ui.page}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">부속물품</h2>
        {items && <Link href="/products/accessories/new" className={ui.btnPrimary}>+ 새 부속물품</Link>}
      </div>
      {!items ? (
        <p className={ui.note}>부속물품은 로컬 Supabase에 연결했을 때만 보여요. (로그인 기능이 생기기 전 안전장치)</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{['서류', '물품', '옵션', 'HS', '확인 상태', '관리 코드'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead>
            <tbody>
              {items.filter((a) => !a.archived).flatMap((a) => a.options.filter((o) => !o.archived).map((o) => (
                <tr key={o.optionId} className={ui.tr}>
                  <td className={ui.td}><ExportSelectionCheckbox option_id={o.optionId} selected={o.exportSelected} archived={false} label={`${a.name} ${o.optionName}`} /></td>
                  <td className={ui.td}><Link href={`/products/accessories/${a.id}?option=${o.optionId}`} className="font-semibold text-[#2f5bd3] hover:underline">{a.name}</Link>
                    {a.nameEn && <div className="text-xs text-slate-500">{a.nameEn}</div>}</td>
                  <td className={ui.td}>{o.optionName || (a.options.filter((x) => !x.archived).length > 1 ? '기본' : <Empty />)}</td>
                  <td className={ui.td}>{o.hs6 ? format_hs_code(o.hsk10 ?? o.hs6) : <Empty />}</td>
                  <td className={ui.td}>{o.state === 'needs_review' ? <span className="text-amber-700">재검토 필요</span> : <StatusText status={o.state} />}</td>
                  <td className={`${ui.td} text-slate-500`}>{o.code}</td>
                </tr>
              )))}
              {items.filter((a) => !a.archived).length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">등록된 부속물품이 없어요.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {items && items.some((a) => a.archived) && (
        <p className={ui.hint}>보관한 물품: {items.filter((a) => a.archived).map((a, i) => <span key={a.id}>{i > 0 && ' · '}<Link href={`/products/accessories/${a.id}`} className="hover:underline">{a.name}</Link></span>)}</p>
      )}
    </section>
  );
}
