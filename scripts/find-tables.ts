import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findTables() {
  console.log("--- Finding Tables in All Schemas ---");
  const { data, error } = await supabase
    .rpc("get_all_tables" as any)
    .catch(() => ({ data: null, error: { message: "RPC not found" } }));

  // Fallback to query
  const { data: tables, error: queryErr } = await supabase
    .from("information_schema.tables" as any)
    .select("table_schema, table_name");

  if (queryErr) {
    // Some self-hosted might not allow direct query of information_schema via postgrest
    // Let's try raw SQL via a custom RPC if they have one, or just check public.
    console.log("Could not query information_schema directly via PostgREST.");
  } else {
    console.log("Tables found:", tables.length);
    const links = tables.filter((t: any) => t.table_name === "links");
    console.log("Links tables:", JSON.stringify(links, null, 2));
  }
}

findTables();
