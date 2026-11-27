// [공용] 제품 하나: 칸마다 값 + 확인 상태
// GET /api/products/ttok-ez?for=라벨&external=1
//   for: 규제 | 라벨 | 서류 (없으면 전체 칸)   external=1: 내부용 칸 · 비공개 제조사 이름 빼기
import { NextResponse } from 'next/server';
import { USE_TABS, get_shared_product } from '@/features/products/share';
import type { UseTab } from '@/features/products/fields';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const q = new URL(req.url).searchParams;
  const f = q.get('for');
  if (f && !USE_TABS.includes(f as UseTab)) return NextResponse.json({ error: 'for는 규제 · 라벨 · 서류 중 하나예요.' }, { status: 400 });
  const p = await get_shared_product(code, { for: (f as UseTab) || null, external: q.get('external') === '1' });
  if (!p) return NextResponse.json({ error: '제품을 찾을 수 없어요.' }, { status: 404 });
  return NextResponse.json(p);
}
