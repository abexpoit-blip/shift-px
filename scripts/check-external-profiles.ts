import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://supabase.adspx.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkExternalProfiles() {
  console.log("--- Checking EXTERNAL profiles ---");
  const { data: profiles, error } = await supabase.from("profiles").select("*").limit(1);

  if (error) {
    console.error("Error:", error.message);
  } else {
    if (profiles && profiles.length > 0) {
      console.log("Found keys:", Object.keys(profiles[0]).join(", "));
    }
  }
}

checkExternalProfiles();
