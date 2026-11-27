// 저장 (Claude): DB에 쓰는 곳은 여기 하나. 서버 액션이 아니라 서버 안에서만 부른다.
import 'server-only';
import { db } from './data';
import type { SaveRows } from './form';
import * as S from './sample';

/** 저장 한 번 = DB 함수 한 번 (중간에 실패하면 전부 취소). DB가 없으면 예시 데이터에 저장 */
export async function persist(r: SaveRows, product_id: string) {
  const client = db();
  if (!client) { save_to_sample(r, product_id); return; }
  const { error } = await client.rpc('save_product', { payload: r });
  if (error) throw error;
}

function replace<T>(arr: T[], keep: (x: T) => boolean, add: T[]) {
  const rest = arr.filter(keep); arr.length = 0; arr.push(...rest, ...add);
}

function save_to_sample(r: SaveRows, product_id: string) {
  const now = new Date().toISOString();
  const old = S.sample_products.find((p) => p.id === product_id);
  replace(S.sample_products, (p) => p.id !== product_id, [{ ...r.product, created_at: old?.created_at ?? now, updated_at: now }]);
  const ids = r.components.map((c) => c.id);
  replace(S.sample_components, (c) => !ids.includes(c.id), r.components);
  replace(S.sample_links, (l) => l.product_id !== product_id, r.links);
  replace(S.sample_ingredients, (i) => !ids.includes(i.component_id), r.ingredients);
  for (const n of r.nutrition) { const { component_id, ...v } = n; S.sample_nutrition[component_id] = v; }
  replace(S.sample_packaging, (x) => x.product_id !== product_id, r.packaging.map((x) => ({ ...x, product_id: product_id })));
  replace(S.sample_label_texts, (x) => x.product_id !== product_id, r.labelTexts.map((x) => ({ ...x, product_id: product_id })));
  if (r.exportInfo) replace(S.sample_export, (e) => e.product_id !== product_id, [r.exportInfo as (typeof S.sample_export)[number]]);
  for (const st of r.statuses) {
    const k = (x: { entity_type: string; entity_id: string; field_key: string }) => `${x.entity_type}|${x.entity_id}|${x.field_key}`;
    replace(S.sample_status, (x) => k(x) !== k(st), [{ ...st, id: `${st.entity_id}-${st.field_key}`, updated_at: now }]);
  }
}
