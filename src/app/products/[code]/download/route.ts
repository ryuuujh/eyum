// 엑셀 내려받기 (Claude): ?type=summary|request&external=1
import { get_product_detail } from '@/features/products/data';
import { request_workbook, summary_workbook } from '@/features/products/excel';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = await get_product_detail(code);
  if (!d) return new Response('제품을 찾을 수 없어요.', { status: 404 });
  const url = new URL(req.url);
  const external = url.searchParams.get('external') === '1';
  const parts = url.searchParams.get('parts')?.split(',').filter(Boolean);
  const { buffer, name } = url.searchParams.get('type') === 'request'
    ? await request_workbook(d, external, parts)
    : await summary_workbook(d, external, parts);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${code}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}
