// [공용] 제품 목록 (다른 탭에서 제품 고르기용)
import { NextResponse } from 'next/server';
import { list_shared_products } from '@/features/products/share';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await list_shared_products());
}
