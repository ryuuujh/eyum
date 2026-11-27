import { assist_hs } from "./assist_hs.mts";
import { preview_hs_ai, type Approval, type KnownCodeLookup } from "./ai_preview.mts";
import { submit_hs_ai } from "./ai_transport.mts";

type Query = <T>(sql: string, values: unknown[]) => Promise<{ rows: T[] }>;
type Candidate = Awaited<ReturnType<typeof assist_hs>>["candidates"][number];

function postgres_known_codes(query: Query): KnownCodeLookup {
  return async codes => {
    const result = await query<{ known: string[] }>(
      `select array(select code from unnest($1::text[]) as x(code)
          where public.is_official_hs_candidate(v.id,left(code,6),
            case when length(code)=10 then code end)) as known
        from public.hs_data_versions v where v.is_active`,
      [codes],
    );
    const known = result.rows[0]?.known;
    return Array.isArray(known) ? new Set(known) : null;
  };
}

export function preview_with_postgres(
  query: Query, type: "food" | "accessory", itemId: string, raw: Record<string, unknown>,
) {
  return preview_hs_ai(type, itemId, raw, postgres_known_codes(query));
}

export async function assist_with_postgres(
  query: Query, type: "food" | "accessory", raw: Record<string, unknown>,
  itemId: string, approval: Approval,
) {
  const name = typeof raw.item_name === "string" ? raw.item_name : "";
  const attribute = (key: string) => typeof raw[key] === "string" ? raw[key] : null;
  return submit_hs_ai(type, itemId, approval, postgres_known_codes(query), {
    search: async terms => {
      const { rows } = await query<Omit<Candidate,"official_source_url">>(
        `select c.*, v.id as official_version
         from public.hs_data_versions v
         cross join lateral public.search_hs_candidates($1,$2,true,$3,$4,$5,$6::text[]) c
         where v.is_active`,
        [type,name,attribute("material"),attribute("intended_use"),attribute("form"),terms],
      );
      return rows.map(row => ({ ...row, official_source_url: row.source === "standard_name"
        ? "https://www.data.go.kr/data/15049721/fileData.do"
        : "https://www.data.go.kr/data/15130660/fileData.do" }));
    },
    isOfficial: async candidate => {
      const result = await query<{ valid: boolean }>(
        "select public.is_official_hs_candidate($1,$2,$3) as valid",
        [candidate.official_version,candidate.hs6,candidate.hsk10],
      );
      return result.rows[0]?.valid === true;
    },
  });
}

