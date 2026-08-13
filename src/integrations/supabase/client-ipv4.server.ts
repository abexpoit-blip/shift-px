import { createClient } from "@supabase/supabase-js";

import { fetchIpv4 } from "@/lib/fetch-ipv4";

import type { Database } from "./types";

function createSupabaseAdminIpv4Client() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing server database environment variables for IPv4 admin client");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: fetchIpv4,
    },
  });
}

let _supabaseAdminIpv4: ReturnType<typeof createSupabaseAdminIpv4Client> | undefined;

export const supabaseAdminIpv4 = new Proxy({} as ReturnType<typeof createSupabaseAdminIpv4Client>, {
  get(_, prop, receiver) {
    if (!_supabaseAdminIpv4) _supabaseAdminIpv4 = createSupabaseAdminIpv4Client();
    return Reflect.get(_supabaseAdminIpv4, prop, receiver);
  },
});