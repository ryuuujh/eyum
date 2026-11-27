// [공용] 제품 관리 알림 (홈 탭에서 모아 보기용)
// GET /api/products/notices        처리 안 된 알림만
// GET /api/products/notices?all=1  처리한 것까지 (최근 30개)
// 로그인 전에는 로컬 Supabase에서만 채워짐. 아니면 { available: false, unresolved: 0, notices: [] }
import { NextResponse } from 'next/server';
import { list_product_notices } from '@/features/products/notice_passage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get('all') === '1';
  return NextResponse.json(await list_product_notices({ all }));
}
