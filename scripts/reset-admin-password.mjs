import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

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
