#!/usr/bin/env node
/**
 * Migration Script: Updates all existing and future free users to 50 link limit in Supabase.
 */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:8000";
const SERVICE_KEY = process.env.SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM";

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function migrate() {
  console.log("🚀 Migrating all Free users in database to 50 Link Limit...");

  // Update all profiles with free plan or link_limit < 50
  const { data: updated, error } = await db
    .from("profiles")
    .update({ link_limit: 50 })
    .or("plan_slug.eq.free,plan_slug.is.null,link_limit.lt.50,link_limit.is.null")
    .select("id, email, link_limit");

  if (error) {
    console.error("Migration error:", error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully updated ${updated ? updated.length : 0} user profiles to 50 Link Limit!`);
  if (updated && updated.length > 0) {
    console.log("Sample updated accounts:");
    updated.slice(0, 8).forEach(u => console.log(`  • ${u.email}: link_limit = ${u.link_limit}`));
  }
}

migrate().catch(console.error);
