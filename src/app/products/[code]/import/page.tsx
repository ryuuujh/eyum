// 자료 올리기 (Claude): 채운 요청 목록 엑셀 · 메일 · 자료 글(AI)
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get_product_detail } from '@/features/products/data';
import { ImportRequest } from './import_request_form';

export const dynamic = 'force-dynamic';

export default async function ImportPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { code } = await params;
  const { mode } = await searchParams;
  const d = await get_product_detail(code);
  if (!d) notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/products/${code}`} className="text-sm text-slate-500 hover:underline">← {d.product.name_ko}</Link>
      <h1 className="mt-2 text-2xl font-bold">자료 올리기</h1>
      <p className="mt-1 text-sm text-slate-500">올린 자료에서 읽은 값을 저장 전에 먼저 보여드려요. 체크한 줄만 저장돼요.</p>
      <div className="mt-6"><ImportRequest code={code} initialMode={mode === 'text' ? 'text' : 'request'} /></div>
    </main>
  );
}
