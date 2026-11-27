// 제품 수정 (Claude)
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get_product_detail } from '@/features/products/data';
import { status_key, to_form } from '@/features/products/form';
import { ProductForm, type StatusHint } from '@/features/products/components/product_form';
import { library_items } from '@/features/products/library';

export const dynamic = 'force-dynamic';

const TABS = ['basic', 'comps', 'nutrition', 'label', 'export'] as const;

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { code } = await params;
  const { tab } = await searchParams;
  const initial_tab = TABS.find((t) => t === tab) ?? 'basic';
  const d = await get_product_detail(code);
  if (!d) notFound();
  const hints: StatusHint = Object.fromEntries(d.statuses.map((s) => [status_key(s.entity_type as 'product' | 'component', s.entity_id, s.field_key), { status: s.status, note: s.note }]));
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/products/${code}`} className="text-sm text-slate-500 hover:underline">← {d.product.name_ko}</Link>
      <h1 className="mt-2 text-2xl font-bold">{d.product.name_ko} 수정</h1>
      <ProductForm initial={to_form(d)} hints={hints} library={await library_items()} initialTab={initial_tab} />
    </main>
  );
}
