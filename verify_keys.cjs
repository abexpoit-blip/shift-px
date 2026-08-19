const crypto = require("crypto");

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  return JSON.parse(Buffer.from(parts[1], "base64").toString());
}

function verifyJwt(token, secret) {
  const parts = token.split(".");
  const header = parts[0];
  const payload = parts[1];
  const signature = parts[2];

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return signature === expectedSignature;
}

const secret = "18a2a6262cfb62820f9c5ed7452809ed3469ba0b814b9884417f3bd83889a594";
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Anon Key Payload:", decodeJwt(anonKey));
console.log("Anon Key Verified:", verifyJwt(anonKey, secret));

console.log("Service Key Payload:", decodeJwt(serviceKey));
console.log("Service Key Verified:", verifyJwt(serviceKey, secret));
