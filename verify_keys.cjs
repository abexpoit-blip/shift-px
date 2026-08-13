const crypto = require('crypto');

function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  return JSON.parse(Buffer.from(parts[1], 'base64').toString());
}

function verifyJwt(token, secret) {
  const parts = token.split('.');
  const header = parts[0];
  const payload = parts[1];
  const signature = parts[2];
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
    
  return signature === expectedSignature;
}

const secret = "18a2a6262cfb62820f9c5ed7452809ed3469ba0b814b9884417f3bd83889a594";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc5NTI3MzM4LCJleHAiOjIwOTQ4ODczMzh9.URbRlYz0AjLehmGhVH7dnsfwJPUY_zgYC4hodpxeHW8";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzk1MjczMzgsImV4cCI6MjA5NDg4NzMzOH0.HitgT1rO3FH8h4jNpbvhaBfrLFkGz_JN91c1caB2O_8";

console.log("Anon Key Payload:", decodeJwt(anonKey));
console.log("Anon Key Verified:", verifyJwt(anonKey, secret));

console.log("Service Key Payload:", decodeJwt(serviceKey));
console.log("Service Key Verified:", verifyJwt(serviceKey, secret));
