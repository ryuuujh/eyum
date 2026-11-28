// 홈 탭 등 다른 탭이 제품 관리 알림을 받아 가는 모양 (Claude, 11/27)
// 공통 알림 기능이 아니라 "응답 모양"만 정한 것. 다른 탭 알림도 같은 모양이면 홈이 한 번에 모아 보여 줄 수 있다.
import 'server-only';
import { get_hs_data_status, HS_DATASET_LABEL } from './hs_data';

export type TabNoticeState = 'unread' | 'read' | 'resolved';
export type TabNotice = {
  id: string;
  source_tab: string;        // 알림을 낸 탭 (예: '제품 관리')
  kind: string;              // 탭 안 알림 종류 (예: 'hs_data')
  title: string;
  message: string;
  detected_at: string;       // ISO 시각
  state: TabNoticeState;     // 읽음과 처리 완료는 따로. 처리 완료 전까지는 홈에서도 계속 보여 줄 것
  link: string;              // 눌렀을 때 갈 화면
};
export type TabNoticeList = { available: boolean; unresolved: number; notices: TabNotice[] };

export async function list_product_notices({ all = false } = {}): Promise<TabNoticeList> {
  const status = await get_hs_data_status().catch(() => null);
  if (!status) return { available: false, unresolved: 0, notices: [] };
  const notices: TabNotice[] = status.notices
    .filter((n) => all || !n.resolution)
    .map((n) => ({
      id: n.id,
      source_tab: '제품 관리',
      kind: 'hs_data',
      title: `${HS_DATASET_LABEL[n.dataset]} ${n.kind === 'check_failed' ? '자동 확인 실패' : '변경 감지'}`,
      message: n.message,
      detected_at: n.detectedAt,
      state: n.resolution ? 'resolved' : n.readAt ? 'read' : 'unread',
      link: '/products/hs_data',
    }));
  return { available: true, unresolved: status.notices.filter((n) => !n.resolution).length, notices };
}
