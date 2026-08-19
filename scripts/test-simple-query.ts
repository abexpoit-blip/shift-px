import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testSimpleQuery() {
  console.log("--- Simple Query Test ---");
  const { data, error } = await supabase
    .from("upgrade_requests")
    .select("count", { count: "exact", head: true });
  if (error) {
    console.error("Simple query error:", error.message);
  } else {
    console.log("Simple query count:", data);
  }
}

testSimpleQuery();
