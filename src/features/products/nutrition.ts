// 제품 영양성분 계산 (Claude). DB에 저장하지 않고 구성품 값으로 계산한다.
import { NUTRIENT_KEYS, type Nutrition, type ProductComponent } from './types';

export type NutritionResult = {
  total: Partial<Record<keyof Nutrition, number | null>>;       // 제품 전체
  perServing: Partial<Record<keyof Nutrition, number | null>>;  // 1회 제공량
  per100g: Partial<Record<keyof Nutrition, number | null>> | null; // 총중량을 모르면 null (보류)
  totalWeightG: number | null;
  heldReasons: string[];          // 보류 이유 (화면 안내용)
  eu: { kj: number | null; salt_g: number | null } | null;      // 100g당 기준
};

/** 구성품 한 줄이 제품에 들어가는 양을 영양 기준(100g/100mL) 몇 배인지로 바꾼다. */
function factor(pc: ProductComponent): number {
  // amount와 nutrition_basis 단위가 같다고 본다 (g ↔ 100g, mL ↔ 100mL). 부피 기준 합산은 그대로 허용.
  return (pc.amount * pc.quantity) / 100;
}

/** 구성품 실중량(g). mL 구성품은 unit_weight_g(한 포 실중량)가 있어야 계산된다. */
function weight_g(pc: ProductComponent): number | null {
  if (pc.unit === 'g') return pc.amount * pc.quantity;
  if (pc.component.unit_weight_g != null) return pc.component.unit_weight_g * pc.quantity;
  return null;
}

export function calc_nutrition(items: ProductComponent[], servings_per_pack: number | null): NutritionResult {
  const total: NutritionResult['total'] = {};
  const held_reasons: string[] = [];

  for (const key of NUTRIENT_KEYS) {
    let sum = 0;
    let known = true;
    for (const pc of items) {
      const v = pc.nutrition?.[key];
      if (v == null) { known = false; break; }
      sum += v * factor(pc);
    }
    total[key] = known && items.length > 0 ? round(sum, 2) : null;
  }

  const per_serving: NutritionResult['total'] = {};
  for (const key of NUTRIENT_KEYS) {
    const v = total[key];
    per_serving[key] = v != null && servings_per_pack ? round(v / servings_per_pack, 2) : null;
  }

  let total_weight_g: number | null = 0;
  for (const pc of items) {
    const w = weight_g(pc);
    if (w == null) {
      total_weight_g = null;
      held_reasons.push(`${pc.component.name} 한 포 실중량이 없어 100g당 계산을 보류해요.`);
    } else if (total_weight_g != null) {
      total_weight_g += w;
    }
  }

  let per100g: NutritionResult['per100g'] = null;
  let eu: NutritionResult['eu'] = null;
  if (total_weight_g) {
    per100g = {};
    for (const key of NUTRIENT_KEYS) {
      const v = total[key];
      per100g[key] = v != null ? round((v / total_weight_g) * 100, 2) : null;
    }
    const kcal = per100g.kcal ?? null;
    const na = per100g.sodium_mg ?? null;
    eu = {
      kj: kcal != null ? round(kcal * 4.184, 0) : null,          // 1 kcal = 4.184 kJ
      salt_g: na != null ? round((na / 1000) * 2.5, 2) : null,   // EU: 소금 = 나트륨 × 2.5
    };
  }

  return { total, perServing: per_serving, per100g, totalWeightG: total_weight_g, heldReasons: held_reasons, eu };
}

function round(v: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}
