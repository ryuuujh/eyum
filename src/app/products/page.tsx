// 제품 목록 (Claude)
import Link from 'next/link';
import { FeatureScreen, type WorkspacePageProps } from '@/components/feature_screen';
import { AccessoryList } from '@/features/accessories/components/accessory_list';
import { HsDataBanner } from '@/features/products/hs_data_banner';
import { ExportToggle } from './export_toggle';
import { ui } from '@/components/ui';
import { get_product_detail, get_products } from '@/features/products/data';
import { build_detail_view } from '@/features/products/view';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: WorkspacePageProps) {
  const products = await get_products();
  const rows = await Promise.all(
    products.map(async (p) => {
      const d = await get_product_detail(p.code);
      const v = d ? build_detail_view(d) : null;
      return { p, components: d?.components.length ?? 0, total: v?.total ?? 0, waiting: v?.waiting.length ?? 0 };
    }),
  );

  // 공통 틀(사이드바 · 제목) 안에 제품 목록과 부속물품 목록을 둔다.
  return (
    <FeatureScreen slug="products" searchParams={searchParams}>
    <main className={ui.page}>
      <HsDataBanner />
      <div className="mb-6 flex items-center justify-end">
        <Link href="/products/new" className={ui.btnPrimary}>+ 새 제품 등록</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium" title="체크한 제품만 다른 탭(서류 등)에서 고를 수 있어요">수출</th>
              <th className="px-4 py-3 font-medium">제품</th>
              <th className="px-4 py-3 font-medium">내용량</th>
              <th className="px-4 py-3 font-medium">구성품</th>
              <th className="px-4 py-3 font-medium">남은 할 일</th>
              <th className="px-4 py-3 font-medium">수정일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, components, total, waiting }) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3"><ExportToggle code={p.code} selected={p.export_selected} /></td>
                <td className="px-4 py-3">
                  <Link href={`/products/${p.code}`} className="font-semibold text-[#2f5bd3] hover:underline">{p.name_ko}</Link>
                  {p.name_en && <div className="text-xs text-slate-500">{p.name_en}</div>}
                </td>
                <td className="px-4 py-3">{p.net_content_value ? `${p.net_content_value}${p.net_content_unit ?? ''}` : '—'}</td>
                <td className="px-4 py-3">{components}개</td>
                <td className="px-4 py-3">
                  {total === 0 ? <span className="text-emerald-700">없음</span> : <span className="font-semibold">{total}개</span>}
                  {waiting > 0 && <span className="ml-2 text-xs text-slate-500">(기다리는 중 {waiting})</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{p.updated_at.slice(0, 10)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">등록된 제품이 없어요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
    <AccessoryList />
    </FeatureScreen>
  );
}
