const https = require("https");

const SUPABASE_REST_URL = "https://adswapx.com/rest/v1";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4MTQ2MzksImV4cCI6MjA5ODE3NDYzOX0.X00UwEmqY4I0GkYvkT3tNO2BvI81Ffzs_CF2Kb0ybNM";

function req(endpoint, method = "GET", body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_REST_URL}/${endpoint}`;
    const parsed = new URL(url);
    const reqHeaders = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...headers,
    };
    const r = https.request(parsed, { method, headers: reqHeaders, timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const offerUrl = "https://widerhazy.com/wpxs92ia4?key=fcdc3e78bb6e36b609c9ee76646e7b4d";

  // 1. Get available token
  const tRes = await req("google_token_pool?status=eq.available&order=created_at.asc&limit=1");
  if (!tRes.data || tRes.data.length === 0) {
    console.error("No available tokens!");
    return;
  }
  const token = tRes.data[0];
  console.log("Claiming token:", token.token);

  // 2. Generate short code
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let shortCode = "";
  for (let i = 0; i < 6; i++) shortCode += chars[Math.floor(Math.random() * chars.length)];

  // Get admin user
  const uRes = await req("users?select=id&limit=1");
  const userId = uRes.data?.[0]?.id || "c3e9ecfe-1a85-4e18-84ab-5c644046a6a4";

  // 3. Create link in links table
  const lRes = await req("links", "POST", {
    user_id: userId,
    short_code: shortCode,
    title: "Adsterra User Campaign",
    destination_url: offerUrl,
    adsterra_url: offerUrl,
    is_active: true,
  }, { Prefer: "return=representation" });

  const link = lRes.data?.[0];
  console.log("Created link short code:", shortCode, "ID:", link?.id);

  // 4. Assign token in pool
  await req(`google_token_pool?id=eq.${token.id}`, "PATCH", {
    status: "assigned",
    assigned_link_id: link?.id,
    assigned_user_id: userId,
    assigned_at: new Date().toISOString(),
  });

  // 5. Insert in google_shorts
  await req("google_shorts", "POST", {
    user_id: userId,
    link_id: link?.id,
    short_code: shortCode,
    domain: "adswapx.com",
    destination_url: offerUrl,
    google_url: token.google_url,
    share_google_url: token.share_google_url,
    title: "Adsterra User Campaign",
  });

  console.log("\n=======================================================");
  console.log("🎉 LINK SUCCESSFULLY SHORTENED & PAIRED WITH GOOGLE!");
  console.log("=======================================================");
  console.log("• AdsPx Slot Code :", `https://adswapx.com/r/${shortCode}`);
  console.log("• AdsPx Clean Link:", `https://adswapx.com/${shortCode}`);
  console.log("• Official Google :", token.google_url);
  console.log("• Share Google Alt:", token.share_google_url);
  console.log("• Destination Offer:", offerUrl);
  console.log("=======================================================\n");
}

main().catch(console.error);
