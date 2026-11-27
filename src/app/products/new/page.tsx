// 새 제품 등록 (Claude)
import Link from 'next/link';
import { to_form } from '@/features/products/form';
import { ProductForm } from '@/features/products/components/product_form';
import { library_items } from '@/features/products/library';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/products" className="text-sm text-slate-500 hover:underline">← 제품 목록</Link>
      <h1 className="mt-2 text-2xl font-bold">새 제품 등록</h1>
      <ProductForm initial={to_form(null)} hints={{}} library={await library_items()} />
    </main>
  );
}
