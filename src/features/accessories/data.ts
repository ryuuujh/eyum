// 부속물품 화면이 DB를 읽고 쓰는 곳 (Claude, 11/27). DB 함수 accessory_action 하나만 부른다.
// 로그인 전 안전장치(부속물품 통로와 같음): 로컬 Supabase(localhost)이고 운영 모드가 아닐 때만 켜진다.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { FieldStatusValue } from '@/features/products/types';

export type HsHistory = { hs6: string; hsk10: string | null; by: string; why: string; date: string; status: string; reason: string | null };
export type AccessoryOption = {
  optionId: string; optionName: string; code: string; isDefault: boolean; archived: boolean;
  material: string; purpose: string; shape: string; size: string;
  exportSelected: boolean; unitPrice: number | null; currency: string | null;
  origin: string; unitWeightG: number | null; unitsPerCtn: number | null; ctnNetKg: number | null; ctnGrossKg: number | null;
  ctnLcm: number | null; ctnWcm: number | null; ctnHcm: number | null;
  hs6: string | null; hsk10: string | null; hsCheckedAt: string | null; hsConfirmedBy: string | null; hsClassificationId: string | null;
  state: FieldStatusValue | 'needs_review'; history: HsHistory[];
};
export type Accessory = { id: string; name: string; nameEn: string; description: string; archived: boolean; options: AccessoryOption[] };

const LOCAL = ['localhost', '127.0.0.1', '[::1]'];

export function accessory_db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || process.env.NODE_ENV === 'production' || !LOCAL.includes(new URL(url).hostname)) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export class AccessoryDbMissing extends Error {}

export async function accessory_action<T = { id: string; optionId: string | null }>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const client = accessory_db();
  if (!client) throw new AccessoryDbMissing('local_accessory_db_required');
  const { data, error } = await client.rpc('accessory_action', { p: { action, ...values } });
  if (error) throw new Error(error.message.includes('accessory_options_management_code') ? 'duplicate_code' : error.message);
  return data as T;
}

/** 목록. 로컬 DB가 없으면 null (화면에 "로컬 DB 연결 필요" 안내) */
export async function list_accessories(): Promise<Accessory[] | null> {
  if (!accessory_db()) return null;
  return accessory_action<Accessory[]>('list');
}

export async function get_accessory(id: string) {
  const all = await list_accessories();
  return all?.find((a) => a.id === id) ?? null;
}
