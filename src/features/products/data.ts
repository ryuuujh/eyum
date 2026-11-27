// 제품 데이터 읽기 (Claude). 화면은 DB를 직접 읽지 않고 이 함수만 쓴다.
// NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 있으면 Supabase에서, 없으면 예시 데이터에서 읽는다.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Component, FieldStatus, Ingredient, Nutrition, Product, ProductComponent, ProductExport } from '@/features/products/types';
import * as S from './sample';

export type PackagingPart = { id: string; part: string; material: string | null; separable: string | null; sort_order: number };

export type ProductDetail = {
  product: Product;
  components: ProductComponent[];
  ingredients: Ingredient[];
  exportInfo: ProductExport | null;
  packaging: PackagingPart[];
  statuses: FieldStatus[];
};

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function get_products(): Promise<Product[]> {
  const client = db();
  if (!client) return S.sample_products;
  const { data, error } = await client.from('products').select('*').neq('status', 'archived').order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Product[];
}

export async function get_product_detail(code: string): Promise<ProductDetail | null> {
  const client = db();
  if (!client) return sample_detail(code);

  const { data: product, error } = await client.from('products').select('*').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!product) return null;

  const { data: links, error: e1 } = await client
    .from('product_components')
    .select('amount, unit, quantity, sort_order, component:components(*, nutrition:component_nutrition(*))')
    .eq('product_id', product.id)
    .order('sort_order');
  if (e1) throw e1;

  type Row = { amount: number; unit: 'g' | 'mL'; quantity: number; sort_order: number; component: Component & { nutrition: Nutrition | Nutrition[] | null } };
  const components: ProductComponent[] = ((links ?? []) as unknown as Row[]).map((r) => {
    const { nutrition, ...component } = r.component;
    return { component, nutrition: Array.isArray(nutrition) ? nutrition[0] ?? null : nutrition, amount: r.amount, unit: r.unit, quantity: r.quantity, sort_order: r.sort_order };
  });
  const component_ids = components.map((c) => c.component.id);

  const [ing, exp, pack, st] = await Promise.all([
    client.from('component_ingredients').select('*').in('component_id', component_ids).order('seq'),
    client.from('product_export').select('*').eq('product_id', product.id).maybeSingle(),
    client.from('product_packaging_parts').select('*').eq('product_id', product.id).order('sort_order'),
    client.from('field_status').select('*').in('entity_id', [product.id, ...component_ids]),
  ]);
  for (const r of [ing, exp, pack, st]) if (r.error) throw r.error;

  return {
    product: product as Product,
    components,
    ingredients: (ing.data ?? []) as Ingredient[],
    exportInfo: (exp.data ?? null) as ProductExport | null,
    packaging: (pack.data ?? []) as PackagingPart[],
    statuses: (st.data ?? []) as FieldStatus[],
  };
}

function sample_detail(code: string): ProductDetail | null {
  const product = S.sample_products.find((p) => p.code === code);
  if (!product) return null;
  const components = S.sample_links
    .filter((l) => l.product_id === product.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      component: S.sample_components.find((c) => c.id === l.component_id)!,
      nutrition: S.sample_nutrition[l.component_id] ?? null,
      amount: l.amount, unit: l.unit, quantity: l.quantity, sort_order: l.sort_order,
    }));
  const ids = components.map((c) => c.component.id);
  return {
    product,
    components,
    ingredients: S.sample_ingredients.filter((i) => ids.includes(i.component_id)),
    exportInfo: S.sample_export.find((e) => e.product_id === product.id) ?? null,
    packaging: S.sample_packaging.filter((x) => x.product_id === product.id).sort((a, b) => a.sort_order - b.sort_order),
    statuses: S.sample_status.filter((s) => s.entity_id === product.id || ids.includes(s.entity_id)),
  };
}

export type LibraryComponent = { component: Component; nutrition: Nutrition | null; ingredients: Ingredient[]; statuses: FieldStatus[]; usedBy: { code: string; name: string }[] };

/** 등록된 모든 구성품 (기존 구성품 불러오기 · 같이 쓰는 제품 안내용) */
export async function get_component_library(): Promise<LibraryComponent[]> {
  const client = db();
  if (!client) {
    return S.sample_components.map((c) => ({
      component: c, nutrition: S.sample_nutrition[c.id] ?? null,
      ingredients: S.sample_ingredients.filter((i) => i.component_id === c.id),
      statuses: S.sample_status.filter((s) => s.entity_type === 'component' && s.entity_id === c.id),
      usedBy: S.sample_links.filter((l) => l.component_id === c.id).map((l) => S.sample_products.find((p) => p.id === l.product_id)!).filter(Boolean).map((p) => ({ code: p.code, name: p.name_ko })),
    }));
  }
  const [comps, links, ing, st] = await Promise.all([
    client.from('components').select('*, nutrition:component_nutrition(*)').order('name'),
    client.from('product_components').select('component_id, product:products(code, name_ko, status)'),
    client.from('component_ingredients').select('*').order('seq'),
    client.from('field_status').select('*').eq('entity_type', 'component'),
  ]);
  for (const r of [comps, links, ing, st]) if (r.error) throw r.error;
  type L = { component_id: string; product: { code: string; name_ko: string; status: string } | null };
  return ((comps.data ?? []) as (Component & { nutrition: Nutrition | Nutrition[] | null })[]).map(({ nutrition, ...c }) => ({
    component: c, nutrition: Array.isArray(nutrition) ? nutrition[0] ?? null : nutrition,
    ingredients: ((ing.data ?? []) as Ingredient[]).filter((i) => i.component_id === c.id),
    statuses: ((st.data ?? []) as FieldStatus[]).filter((s) => s.entity_id === c.id),
    usedBy: ((links.data ?? []) as unknown as L[]).filter((l) => l.component_id === c.id && l.product && l.product.status !== 'archived').map((l) => ({ code: l.product!.code, name: l.product!.name_ko })),
  }));
}
