import type { HsCandidate, HsQuestion } from "./contracts.ts";

if (typeof window !== "undefined") throw new Error("Server only");

type ItemType = "food" | "accessory";
type Context = Record<string, string | string[] | boolean>;
type Sanitize = (context: Context) => Promise<Context | null>;
type Candidate = HsCandidate & { official_version: string };
type Dependencies = {
  sanitize?: Sanitize;
  search: (terms: string[]) => Promise<Candidate[]>;
  isOfficial: (candidate: Candidate) => Promise<boolean>;
  request: (stage: "expand" | "compare", data: unknown) => Promise<unknown>;
};

const fields = {
  food: { food_type: "식품 유형", main_ingredients: "원재료명과 순서", processing: "가공·조리 방식",
    packaging_form: "포장 형태", storage: "보관 조건" },
  accessory: { item_name: "물품명", material: "재질", purpose: "용도", shape: "형태" },
} as const;
const cleanText = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 160) : "";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function assist_hs(
  type: ItemType, raw: Record<string, unknown>, deps: Dependencies,
) {
  const base = await deps.search([]);
  const hold = (reason: string, candidates = base, questions: HsQuestion[] = []) =>
    ({ status: "hold" as const, reason, candidates, questions, comparisons: [] });
  let safe: Context;
  try {
    const sanitized = await deps.sanitize?.(raw as Context);
    if (!sanitized) return hold("AI 전송용 정보가 확인되지 않았습니다.");
    safe = sanitized;
  } catch {
    return hold("AI 전송용 정보가 확인되지 않았습니다.");
  }
  if (Object.keys(safe).length === 0) return hold("분류에 필요한 정보가 부족합니다.");

  const labels = fields[type] as Record<string, string>;
  const required = type === "accessory" ? ["item_name", "material", "purpose", "shape"] : ["food_type", "main_ingredients", "processing"];
  const missing = required.filter(key => !(key in safe) || (Array.isArray(safe[key]) && !safe[key].length));
  const makeQuestions = (keys: string[]) => [...new Set(keys)].map(field_key => ({ field_key, label: labels[field_key] }));
  let expanded = base;
  try {
    const expansion = object(await deps.request("expand", { item_type: type, attributes: safe }));
    const terms = Array.isArray(expansion.terms) ? [...new Set(expansion.terms.map(cleanText)
      .filter(value => value.length <= 60 && /\p{L}/u.test(value) && !/\d{4}/.test(value)))].slice(0, 5) : [];
    const questionKeys = Array.isArray(expansion.question_keys) ? expansion.question_keys.filter(
      (key): key is string => typeof key === "string" && Object.hasOwn(labels, key) && !(key in safe)) : [];
    const questions = makeQuestions([...missing, ...questionKeys]);
    if (terms.length) expanded = await deps.search(terms);
    const official = (await Promise.all(expanded.filter(candidate => candidate.source !== "registered_item").slice(0, 8).map(async candidate => {
      const syntax = /^[0-9]{6}$/.test(candidate.hs6) && (candidate.hsk10 === null
        || (/^[0-9]{10}$/.test(candidate.hsk10) && candidate.hsk10.startsWith(candidate.hs6)));
      return syntax && candidate.official_version && await deps.isOfficial(candidate) ? candidate : null;
    }))).filter((candidate): candidate is Candidate => candidate !== null);
    const visible = [...expanded.filter(candidate => candidate.source === "registered_item"), ...official];
    if (questions.length) return hold("추가 정보가 필요합니다.", visible, questions);
    if (!official.length) return hold("공식 데이터에서 비교 가능한 후보를 찾지 못했습니다.", visible);
    const records = official.map((candidate, index) => ({ ref: index + 1, hs6: candidate.hs6,
      hsk10: candidate.hsk10, label: candidate.label }));
    const advised = object(await deps.request("compare", { item_type: type, attributes: safe, candidates: records }));
    if (advised.hold !== false) return hold(cleanText(advised.reason) || "후보를 구분할 근거가 부족합니다.", visible);
    const comparisons: { candidate: Candidate; reason: string }[] = [];
    const seen = new Set<number>();
    for (const rawChoice of Array.isArray(advised.comparisons) ? advised.comparisons : []) {
      const choice = object(rawChoice);
      const ref = choice.ref;
      const reason = cleanText(choice.reason);
      if (typeof ref !== "number" || !Number.isInteger(ref) || ref < 1 || ref > official.length || !reason || seen.has(ref)
          || Object.hasOwn(choice, "hs6") || Object.hasOwn(choice, "hsk10")) {
        return hold("AI 응답의 후보를 공식 목록과 대조할 수 없습니다.", visible);
      }
      seen.add(ref);
      comparisons.push({ candidate: official[ref - 1], reason });
    }
    if (!comparisons.length) return hold("비교 근거가 부족합니다.", visible);
    return { status: "review" as const, reason: "", candidates: visible, questions, comparisons };
  } catch {
    return hold("AI 분석을 완료하지 못했습니다. 공식 검색 결과를 확인해 주세요.", base, makeQuestions(missing));
  }
}

