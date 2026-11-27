// 공식 HS 데이터 확인 화면이 DB를 읽는 곳 (Claude, 11/27). DB 함수 hs_data_action 하나만 부른다.
// 부속물품 화면과 같은 안전장치: 로컬 Supabase이고 운영 모드가 아닐 때만 켜진다.
import 'server-only';
import { accessory_db } from '@/features/accessories/data';

export type HsDataVersion = {
  id: string; metadata: Record<string, unknown>; approvedAt: string | null; approvedBy: string | null; createdAt: string; active?: boolean;
};
export type HsDataNotice = {
  id: string; dataset: 'hsk' | 'standard_names'; kind: 'metadata_changed' | 'check_failed'; message: string; detectedAt: string;
  readAt: string | null; readBy: string | null; resolution: 'applied' | 'no_change' | null; resolvedAt: string | null; resolvedBy: string | null;
};
export type HsDataStatus = {
  active: (HsDataVersion & { hskRows: number }) | null;
  versions: HsDataVersion[];
  notices: HsDataNotice[];
  items: { food: number; accessory: number; withoutReview: number; needsReview: number };
};

export const HS_DATASET_LABEL: Record<HsDataNotice['dataset'], string> = { hsk: '관세청 HSK(HS부호 단위별 품목명)', standard_names: '관세청 표준품명' };
export const HS_OFFICIAL_LINKS = [
  { dataset: 'hsk', label: 'HS부호 단위별 품목명', href: 'https://www.data.go.kr/data/15130660/fileData.do', cycle: '주 1회 확인' },
  { dataset: 'standard_names', label: '표준품명', href: 'https://www.data.go.kr/data/15049721/fileData.do', cycle: '월 1회 확인' },
] as const;

export async function hs_data_action<T = { id: string }>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const client = accessory_db();
  if (!client) throw new Error('local_db_required');
  const { data, error } = await client.rpc('hs_data_action', { p: { action, ...values } });
  if (error) throw new Error(error.message);
  return data as T;
}

/** 로컬 DB가 없으면 null */
export async function get_hs_data_status(): Promise<HsDataStatus | null> {
  if (!accessory_db()) return null;
  return hs_data_action<HsDataStatus>('status');
}
