import "server-only";
import { createClient } from "@supabase/supabase-js";
import { build_document_option, type DocumentOption, type StatusRow } from "./document_fields";

const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function local_db(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const local = ["localhost", "127.0.0.1", "[::1]"];
  if (process.env.NODE_ENV === "production" || !local.includes(new URL(url).hostname)
    || !local.includes(new URL(request.url).hostname)) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function read_document_options(request: Request, option_id?: string) {
  if (option_id && !uuid.test(option_id)) return Response.json({ error: "invalid_option_id" }, { status: 400, headers });
  const params = new URL(request.url).searchParams;
  if (!option_id && params.get("selected") !== "1") {
    return Response.json({ error: "selected_required" }, { status: 400, headers });
  }
  const external = params.get("external") === "1";
  const supabase = local_db(request);
  if (!supabase) return Response.json({ error: "local_accessory_db_required" }, { status: 503, headers });
  const projection = "option_id,accessory_id,export_selected,item_name,item_name_en,option_name,management_code,hs6,hsk10,material,origin,unit_weight_g,units_per_ctn,ctn_net_kg,ctn_gross_kg,ctn_l_cm,ctn_w_cm,ctn_h_cm";
  const query = supabase.from("accessory_document_options")
    .select(external ? projection : projection + ",unit_price,currency").order("option_id");
  if (option_id) query.eq("option_id", option_id);
  else query.eq("export_selected", true);
  const { data, error } = await query;
  if (error) return Response.json({ error: "accessory_read_failed" }, { status: 503, headers });
  const options = (data ?? []) as unknown as DocumentOption[];
  if (options.length === 0) {
    return option_id ? Response.json({ error: "not_found" }, { status: 404, headers }) : Response.json([], { headers });
  }
  const [parents, variants] = await Promise.all([
    supabase.from("accessory_document_status").select("entity_type,entity_id,field_key,status,wait_reason,note")
      .eq("entity_type", "accessory").in("entity_id", [...new Set(options.map(row => row.accessory_id))]),
    supabase.from("accessory_document_status").select("entity_type,entity_id,field_key,status,wait_reason,note")
      .eq("entity_type", "accessory_option").in("entity_id", options.map(row => row.option_id)),
  ]);
  if (parents.error || variants.error) return Response.json({ error: "accessory_status_failed" }, { status: 503, headers });
  const statuses = [...(parents.data ?? []), ...(variants.data ?? [])] as StatusRow[];
  const result = options.map(row => build_document_option(row, statuses, external));
  return Response.json(option_id ? result[0] : result, { headers });
}

export async function write_document_selection(request: Request, option_id: string) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  const body: unknown = await request.json().catch(() => null);
  if (!uuid.test(option_id) || !body || typeof body !== "object"
    || !("export_selected" in body) || typeof body.export_selected !== "boolean") {
    return Response.json({ error: "invalid_selection" }, { status: 400, headers });
  }
  const supabase = local_db(request);
  if (!supabase) return Response.json({ error: "local_accessory_db_required" }, { status: 503, headers });
  const { data, error } = await supabase.rpc("set_accessory_export_selected", {
    p_option_id: option_id, p_selected: body.export_selected,
  });
  if (error) {
    const status = error.code === "23514" ? 409 : error.code === "P0002" ? 404 : 503;
    return Response.json({ error: "selection_failed" }, { status, headers });
  }
  return Response.json({ export_selected: data }, { headers });
}
