import { format_hs_code } from "@/features/products/hs_format";
import { ACCESSORY_DOC_KEYS } from "@/features/products/doc_keys";
import { STATUS_LABEL, WAIT_REASON_LABEL, type FieldStatusValue, type WaitReason } from "@/features/products/types";

const parent_fields = ["item_name", "item_name_en"] as const;
const option_fields = [
  "option_name", "management_code", "hs6", "hsk10", "material", "origin",
  "unit_weight_g", "units_per_ctn", "ctn_net_kg", "ctn_gross_kg", "ctn_l_cm", "ctn_w_cm", "ctn_h_cm",
] as const;
// CTN 크기는 제품 통로처럼 칸 하나(ctn_size)로 묶어 준다. 상태는 세 칸 중 가장 나쁜 것
const ctn_cols = ["ctn_l_cm", "ctn_w_cm", "ctn_h_cm"] as const;
const status_rank: Record<FieldStatusValue, number> = { missing: 0, on_hold: 1, needs_check: 2, not_applicable: 3, confirmed: 4 };
const internal_fields = ["unit_price", "currency"] as const;
type FieldKey = (typeof parent_fields)[number] | (typeof option_fields)[number] | (typeof internal_fields)[number];
type Raw = string | number | null;
const labels: Record<FieldKey, string> = {
  item_name: "물품명", item_name_en: "영문명", option_name: "옵션명", management_code: "관리 코드",
  hs6: "HS 6자리", hsk10: "HSK 10자리", material: "재질", origin: "원산지",
  unit_weight_g: "개당 중량 (g)", units_per_ctn: "CTN 입수", ctn_net_kg: "CTN 순중량 (kg)",
  ctn_gross_kg: "CTN 총중량 (kg)", ctn_l_cm: "CTN 길이 (cm)", ctn_w_cm: "CTN 너비 (cm)",
  ctn_h_cm: "CTN 높이 (cm)", unit_price: "개당 가액", currency: "통화",
};
export type DocumentOption = Record<FieldKey, Raw> & {
  accessory_id: string;
  option_id: string;
  export_selected: boolean;
};
export type StatusRow = {
  entity_type: string;
  entity_id: string;
  field_key: string;
  status: FieldStatusValue;
  wait_reason: WaitReason | null;
  note: string | null;
};

export function build_document_option(option: DocumentOption, statuses: StatusRow[], external: boolean) {
  const keys = [...parent_fields, ...option_fields.filter(k => !(ctn_cols as readonly string[]).includes(k)), ...(external ? [] : internal_fields)];
  const fields = keys.map(key => {
    const parent = key === "item_name" || key === "item_name_en";
    const scope = parent ? "accessory" : "option";
    const record = statuses.find(row => row.entity_type === (parent ? "accessory" : "accessory_option")
      && row.entity_id === (parent ? option.accessory_id : option.option_id) && row.field_key === key);
    const raw = option[key] === "" ? null : option[key] ?? null;
    const status = record?.status ?? (raw === null ? "missing" : "needs_check");
    const wait_reason = record?.wait_reason ?? null;
    return {
      key: `${scope}.${key}`, scope, component: null, field: key as string, doc_key: ACCESSORY_DOC_KEYS[key] ?? null, label: labels[key],
      value: (key === "hs6" || key === "hsk10") && typeof raw === "string" ? format_hs_code(raw) : raw === null ? null : String(raw),
      raw: raw as unknown,
      status,
      status_label: STATUS_LABEL[status],
      usable: status === "confirmed" || status === "not_applicable",
      wait_reason,
      wait_label: wait_reason ? WAIT_REASON_LABEL[wait_reason] : null,
      note: external ? null : record?.note ?? null,
      uses: ["서류"],
    };
  });
  const n = (k: FieldKey) => (option[k] == null || option[k] === "" ? null : Number(option[k]));
  const size = { l: n("ctn_l_cm"), w: n("ctn_w_cm"), h: n("ctn_h_cm") };
  // 묶은 칸 ctn_size (제품 통로와 같은 모양: value "45 × 30 × 30 cm", raw { l, w, h, unit })
  {
    const rows = ctn_cols.map(c => statuses.find(row => row.entity_type === "accessory_option" && row.entity_id === option.option_id && row.field_key === c));
    const has = Object.values(size).some(v => v != null);
    const each = ctn_cols.map((c, i) => rows[i]?.status ?? (option[c] == null || option[c] === "" ? "missing" : "needs_check")) as FieldStatusValue[];
    const status = each.reduce((a, b) => (status_rank[b] < status_rank[a] ? b : a));
    const wait_reason = rows.find(r => r?.wait_reason)?.wait_reason ?? null;
    const note = rows.map(r => r?.note).filter(Boolean).join(" / ") || null;
    const at = fields.findIndex(f => f.field === "ctn_gross_kg") + 1;
    fields.splice(at, 0, {
      key: "option.ctn_size", scope: "option", component: null, field: "ctn_size", doc_key: "ctn_size", label: "CTN 크기",
      value: has ? `${[size.l, size.w, size.h].map(v => v ?? "?").join(" × ")} cm` : null,
      raw: has ? { ...size, unit: "cm" } : null,
      status, status_label: STATUS_LABEL[status], usable: status === "confirmed" || status === "not_applicable",
      wait_reason, wait_label: wait_reason ? WAIT_REASON_LABEL[wait_reason] : null,
      note: external ? null : note, uses: ["서류"],
    });
  }
  // 제품 통로(SharedPacks)와 같은 모양. 부속물품은 개별포장 크기 · 라벨 면적 · 팔레트 정보가 없어 null
  const packs = {
    unit: { net_content: null, net_unit: null, gross_g: n("unit_weight_g"), size_mm: null, label_area_mm: null },
    outer: { units_per_ctn: n("units_per_ctn"), net_kg: n("ctn_net_kg"), gross_kg: n("ctn_gross_kg"),
      size_cm: Object.values(size).every(v => v == null) ? null : size, label_area_mm: null },
    pallet: { l_cm: null, w_cm: null, layers: null, ctn_count: null },
  };
  return { item_type: "accessory" as const, item_id: option.option_id,
    id: option.option_id, option_id: option.option_id, accessory_id: option.accessory_id,
    name_ko: option.item_name, option_name: option.option_name, for: "서류" as const, external,
    export_selected: option.export_selected,
    summary: { total: fields.length, usable: fields.filter(f => f.usable).length,
      needs_check: fields.filter(f => f.status === "needs_check").length,
      missing: fields.filter(f => f.status === "missing" || f.status === "on_hold").length },
    fields, packs };
}
