// [공용] 제품 목록 (다른 탭에서 제품 고르기용)
// GET /api/products             전체
// GET /api/products?selected=1  "수출할 제품"으로 체크한 것만 (없으면 [])
import { NextResponse } from 'next/server';
import { list_shared_products } from '@/features/products/share';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const selected = new URL(req.url).searchParams.get('selected') === '1';
  return NextResponse.json(await list_shared_products({ selected }));
}
