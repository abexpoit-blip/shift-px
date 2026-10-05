import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Read .env natively if present
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "http://127.0.0.1:8000";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ SERVICE_KEY missing in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = (process.argv[2] || "admin@adspx.com").trim().toLowerCase();
  const password = process.argv[3] || "Shovon@5448";

  console.log(`Setting password for ${email}...`);

  // Query profile or user_roles directly to get exact user ID without listUsers pagination bug
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  let userId = prof?.id;
  if (!userId) {
    // Try listUsers with perPage 1000
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === email);
    userId = u?.id;
  }

  if (!userId) {
    console.error("❌ User not found:", email);
    process.exit(1);
  }

  console.log(`Found User ID: ${userId}`);

  // Update password and confirm email
  const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (updateErr) {
    console.error("❌ Failed to update password:", updateErr.message);
    process.exit(1);
  }

  // Ensure role is admin in user_roles
  await supabase.from("user_roles").upsert(
    { user_id: userId, role: "admin" },
    { onConflict: "user_id,role" }
  );

  console.log("✅ SUCCESS! Password updated to:", password);
  console.log("Admin ID:", updated.user.id);
  console.log("Email:", updated.user.email);
}

main().catch(console.error);
