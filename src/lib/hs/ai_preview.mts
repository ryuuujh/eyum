import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prepareForAI, type ItemType } from "@/lib/sanitize";

const key = process.env.HS_AI_PREVIEW_SECRET || randomBytes(32);
const ttl = 10 * 60 * 1000;
type Fields = Record<string, string>;
export type Preview = { ok: true; fields: Fields; token: string } | { ok: false; reason: string };
export type Approval = { confirmed: boolean; fields: Record<string, unknown>; token: string };
const empty = /^\s*(?:\[(?:이메일|전화|주소|사업자번호|금액|배합비 제거됨)\][\s,;:.]*)*$/;
const block = { ok: false as const, reason: "전송할 정보를 다시 확인해 주세요." };

export type KnownCodeLookup = (codes: readonly string[]) => Promise<ReadonlySet<string> | null>;

async function prepare(type: ItemType, raw: Record<string, unknown>, lookup: KnownCodeLookup) {
  try {
    const input = { ...raw };
    if (type === "food") {
      input.main_ingredients ??= input.ingredients;
      input.processing ??= input.cooked === true ? "조리됨" : input.cooked === false ? "조리되지 않음" : undefined;
      input.packaging_form ??= input.form;
    } else {
      input.purpose ??= input.intended_use;
      input.shape ??= input.form;
    }
    // The preview shows Claude's canonical output. Convert only that exact grammar back to code strings.
    const existing = input.existing_classification;
    if (typeof existing === "string" && /^(?:HS6 [0-9]{6}|HSK10 [0-9]{10})(?:, (?:HS6 [0-9]{6}|HSK10 [0-9]{10}))*$/.test(existing)) {
      input.existing_classification = existing.split(", ").map(value => value.split(" ")[1]);
    }
    const code = input.existing_classification;
    const values = Array.isArray(code) ? code : code && typeof code === "object" ? Object.values(code) : [code];
    if (values.some(value => value != null && typeof value !== "string")) return block;

    // First pass only discovers syntactically valid codes. Only the verified second pass may supply fields.
    const requested = new Set<string>();
    const request = { item_type: type, fields: input };
    if (!prepareForAI(request, { isKnownCode: value => { requested.add(value); return true; } }).ok) return block;
    const known = await lookup([...requested]);
    if (!known) return block;
    const result = prepareForAI(request, { isKnownCode: value => known.has(value) });
    if (!result.ok) return block;
    const fields = Object.fromEntries(Object.entries(result.fields).filter(([, value]) => !empty.test(value)));
    const classificationFields = type === "food"
      ? ["item_name", "item_name_en", "food_type", "main_ingredients", "processing", "packaging_form"]
      : ["item_name", "item_name_en", "material", "purpose", "shape", "description", "components"];
    if (!classificationFields.some(name => /[\p{L}\p{N}]/u.test(fields[name] ?? ""))) return block;
    return { ok: true as const, fields };
  } catch {
    return block;
  }
}

function signature(type: ItemType, itemId: string, fields: Fields, until: string) {
  const ordered = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b, "en"));
  return createHmac("sha256", key).update(JSON.stringify([type, itemId, until, ordered])).digest("hex");
}

export async function preview_hs_ai(type: ItemType, itemId: string, raw: Record<string, unknown>, lookup: KnownCodeLookup): Promise<Preview> {
  if (!itemId) return block;
  const result = await prepare(type, raw, lookup);
  if (!result.ok) return result;
  const until = String(Date.now() + ttl);
  return { ...result, token: `${until}.${signature(type, itemId, result.fields, until)}` };
}

export async function approve_hs_ai(type: ItemType, itemId: string, approval: Approval, lookup: KnownCodeLookup) {
  if (!itemId || approval.confirmed !== true || typeof approval.token !== "string") return block;
  const token = /^(\d{13})\.([a-f0-9]{64})$/.exec(approval.token);
  if (!token || Number(token[1]) < Date.now()) return block;
  const result = await prepare(type, approval.fields, lookup);
  if (!result.ok) return result;
  const expected = signature(type, itemId, result.fields, token[1]);
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token[2], "hex"))) return block;
  // Also reject edits that were removed during the second check.
  if (Object.keys(approval.fields).length !== Object.keys(result.fields).length ||
      Object.entries(result.fields).some(([name, value]) => approval.fields[name] !== value)) return block;
  return result;
}

