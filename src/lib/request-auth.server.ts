import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function getRequestAuth() {
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.sleepox.com";
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5NTI3MzM4LCJleHAiOjIwOTQ4ODczMzh9.URbRlYz0AjLehmGhVH7dnsfwJPUY_zgYC4hodpxeHW8";

  const request = getRequest();

  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Unauthorized: No authorization header provided");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("Unauthorized: Invalid token");
  }

  if (!data.claims.sub) {
    throw new Error("Unauthorized: No user ID found in token");
  }

  return {
    supabase,
    userId: data.claims.sub,
    claims: data.claims,
  };
}