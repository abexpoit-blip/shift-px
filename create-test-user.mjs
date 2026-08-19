import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:8000";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function run() {
  const email = (process.argv[2] || "admin@adspx.com").trim().toLowerCase();
  const password = process.argv[3] || "AdminPass@2026";
  const fullName = process.argv[4] || "System Admin";

  console.log(`\n🚀 Setting up Admin User on ${SUPABASE_URL}...`);
  console.log(`Email: ${email}`);

  // 1. Create or fetch user in auth.users
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId = userData?.user?.id;

  if (createError) {
    if (createError.message.includes("already exists") || createError.message.includes("duplicate")) {
      console.log("ℹ️ User already exists. Fetching user ID to ensure admin role...");
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error("❌ Failed to list users:", listError.message);
        process.exit(1);
      }
      const existing = usersData.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) {
        console.error("❌ Could not find existing user ID.");
        process.exit(1);
      }
      userId = existing.id;
      // Update password if requested
      await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
      console.log("✅ Password updated.");
    } else {
      console.error("❌ Error creating auth user:", createError.message);
      process.exit(1);
    }
  } else {
    console.log(`✅ Auth user created! ID: ${userId}`);
  }

  // 2. Insert/Upsert into profiles
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      plan_slug: "unlimited",
      link_limit: 999999,
      click_quota: 999999999,
      is_banned: false,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.warn("⚠️ Warning inserting profile:", profileError.message);
  } else {
    console.log("✅ Profile initialized.");
  }

  // 3. Add to user_roles table
  const { error: roleError } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role: "admin",
    },
    { onConflict: "user_id,role" }
  );

  if (roleError) {
    console.warn("⚠️ Warning setting user_roles:", roleError.message);
  } else {
    console.log("✅ Admin role granted in user_roles.");
  }

  console.log("\n==========================================");
  console.log("🎉 ADMIN ACCOUNT IS READY!");
  console.log(`🔗 Secret Admin Vault URL: https://adspx.com/sx-vault-9k2m7x`);
  console.log(`📧 Admin Email: ${email}`);
  console.log(`🔑 Admin Password: ${password}`);
  console.log("==========================================\n");
}

run().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

