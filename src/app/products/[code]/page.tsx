// 제품 상세 (Claude): 할 일 / 제품 정보
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get_product_detail } from '@/features/products/data';
import { build_detail_view } from '@/features/products/view';
import { calc_nutrition } from '@/features/products/nutrition';
import { DetailTabs } from './detail_tabs';
import { PageHeader, ui } from '@/components/ui';
import { DownloadMenu } from './download_menu';
import { ExportToggle } from '../export_toggle';
import { LABEL_ITEMS, LABEL_PACK_LABEL } from '@/features/products/types';
import { SUMMARY_PARTS, request_parts } from '@/features/products/excel';

export const dynamic = 'force-dynamic';

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
      {d.labelTexts.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold">기존 라벨 문구 <span className="text-sm font-normal text-slate-500">(원문 그대로)</span></h2>
          <table className="w-full text-sm">
            <thead><tr>{['언어', '포장', '항목', '원문', '출처'].map((h) => <th key={h} className={ui.th}>{h}</th>)}</tr></thead>
            <tbody>
              {d.labelTexts.map((x) => (
                <tr key={x.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{x.language}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{LABEL_PACK_LABEL[x.pack_level]}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{LABEL_ITEMS[x.item_key]}</td>
                  <td className="px-3 py-2">{x.text}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{x.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
