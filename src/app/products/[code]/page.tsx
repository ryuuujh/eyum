// 제품 상세 (Claude): 할 일 / 제품 정보
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, get_product_detail } from '@/features/products/data';
import { build_hs_picker_input } from '@/features/products/hs_picker_input';
import { confirm_food_hs, search_food_hs } from '@/features/products/hs_actions';
import { HsPickerClient } from '@/features/accessories/components/hs_picker_client';
import { format_hs_code } from '@/features/products/hs_format';
import { build_detail_view } from '@/features/products/view';
import { calc_nutrition } from '@/features/products/nutrition';
import { DetailTabs } from './detail_tabs';
import { PageHeader, ui } from '@/components/ui';
import { DownloadMenu } from './download_menu';
import { ExportToggle } from '../export_toggle';
import { LABEL_ITEMS, LABEL_PACK_LABEL } from '@/features/products/types';
import { SUMMARY_PARTS, request_parts } from '@/features/products/excel';

export const dynamic = 'force-dynamic';

const LANGUAGE_LABEL: Record<string, string> = { ko: '한국어', en: '영어', vi: '베트남어', fr: '프랑스어', zh: '중국어', ja: '일본어' };

export default async function ProductDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = await get_product_detail(code);
  if (!d) notFound();
  const view = build_detail_view(d);
  const nutrition = calc_nutrition(d.components, d.product.servings_per_pack);
  const p = d.product;

  return (
    <main className={ui.page}>
      <PageHeader
        back={{ href: '/products', label: '제품 목록' }}
        title={p.name_ko}
        sub={[p.net_content_value && `${p.net_content_value}${p.net_content_unit ?? ''}`, p.serving_desc && `${p.serving_desc} × ${p.servings_per_pack ?? '?'}`,
          d.components.map((c) => c.component.name).join(' · ')].filter(Boolean).join('  |  ')}
        actions={<>
          <ExportToggle code={p.code} selected={p.export_selected} label />
          <Link href={`/products/${p.code}/import`} className={ui.btnSecondary}>자료 올리기</Link>
          <DownloadMenu code={p.code} summaryParts={[...SUMMARY_PARTS]} requestParts={request_parts(d)} />
          <Link href={`/products/${p.code}/edit`} className={ui.btnPrimary}>수정하기</Link>
        </>}
      />
      <DetailTabs code={code} view={view} nutrition={nutrition} components={d.components.map((c) => ({ name: c.component.name, amount: c.amount, unit: c.unit, quantity: c.quantity }))} />
      <section className="mt-8" id="hs">
        <h2 className="mb-2 text-base font-semibold">HS 코드 찾기</h2>
        <p className={ui.note}>{d.exportInfo?.hs6
          ? <>현재 <b>{format_hs_code(d.exportInfo.hsk10 ?? d.exportInfo.hs6)}</b>{d.exportInfo.hs_confirmed_by ? ` · ${d.exportInfo.hs_confirmed_by} · ${d.exportInfo.hs_checked_at ?? ''}` : ' · 직접 입력한 값 (검토 기록 없음)'}</>
          : '아직 HS가 없어요. 후보를 찾아 담당자가 확정하면 수출 · 물류의 HS 칸에 들어가요.'}</p>
        {db() ? (
          <div className="mt-3">
            <HsPickerClient {...build_hs_picker_input(d)} search={search_food_hs} confirm={confirm_food_hs.bind(null, p.code, p.id)} />
          </div>
        ) : <p className={ui.hint}>예시 데이터 모드에서는 HS 찾기를 쓸 수 없어요 (DB 연결 필요).</p>}
      </section>
      {d.labelTexts.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold">기존 라벨 문구 <span className="text-sm font-normal text-slate-500">(원문 그대로)</span></h2>
          {/* 언어별로 묶어서 보여 준다 (같은 언어 안에서는 포장 단위 → 항목 순서 그대로) */}
          {[...new Set(d.labelTexts.map((x) => x.language))].map((lang) => (
            <div key={lang} className="mt-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">{LANGUAGE_LABEL[lang.toLowerCase()] ?? lang}</h3>
              <table className="w-full text-sm">
                <thead><tr>{['포장', '항목', '원문', '출처'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {d.labelTexts.filter((x) => x.language === lang).map((x) => (
                    <tr key={x.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{LABEL_PACK_LABEL[x.pack_level]}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{LABEL_ITEMS[x.item_key]}</td>
                      <td className="px-3 py-2">{x.text}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{x.source ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
