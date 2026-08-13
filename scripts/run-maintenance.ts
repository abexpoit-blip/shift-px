#!/usr/bin/env bun
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function runMaintenance() {
  console.log(`[${new Date().toISOString()}] Starting scheduled maintenance...`);
  try {
    const { error } = await supabaseAdmin.rpc("maintenance_purge_old_clicks" as never);
    if (error) {
      console.error(`[${new Date().toISOString()}] Maintenance failed:`, error.message);
      process.exit(1);
    }
    console.log(`[${new Date().toISOString()}] Maintenance completed successfully.`);
    process.exit(0);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] Unexpected error:`, err.message);
    process.exit(1);
  }
}

runMaintenance();
