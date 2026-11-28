// 제품 목록 위 알림 줄 (Claude, 11/27). 처리 안 된 공식 HS 데이터 알림이 있을 때만 보인다.
import Link from 'next/link';
import { ui } from '@/components/ui';
import { get_hs_data_status, HS_DATASET_LABEL } from './hs_data';

export async function HsDataBanner() {
  const status = await get_hs_data_status().catch(() => null);
  const open = status?.notices.filter((n) => !n.resolution) ?? [];
  if (open.length === 0) return null;
  return (
    <div className={`mb-4 ${ui.warn}`}>
      {open.map((n) => <div key={n.id}>{HS_DATASET_LABEL[n.dataset]}: {n.kind === 'check_failed' ? '자동 확인에 실패했어요. 직접 확인이 필요해요.' : '수정 정보가 바뀌었어요. 아직 새 데이터는 적용되지 않았어요.'}</div>)}
      <Link href="/products/hs_data" className="mt-1 inline-block font-semibold hover:underline">공식 HS 데이터 확인하러 가기</Link>
    </div>
  );
}
