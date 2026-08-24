/**
 * Cloudflare for SaaS (Custom Hostnames) Server Integration
 * Automatically creates, verifies, and deletes custom hostnames via Cloudflare API.
 */

const CF_API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  process.env.CF_API_TOKEN ||
  process.env.CF_TOKEN ||
  "";
const CF_ZONE_ID =
  process.env.CLOUDFLARE_ZONE_ID ||
  process.env.CF_ZONE_ID ||
  "3f4347bf1e3dbc1f9820acce81bde4f8";

export interface CustomHostnameResult {
  id: string;
  hostname: string;
  status: "active" | "pending" | "moved" | "deleted" | string;
  ssl: {
    status: "active" | "pending_validation" | "initializing" | string;
    method?: string;
    type?: string;
  };
  ownership_verification?: {
    type: string;
    name: string;
    value: string;
  };
}

/**
 * Register a new custom hostname in Cloudflare for SaaS.
 */
export async function cfRegisterCustomHostname(
  hostname: string,
): Promise<{ ok: boolean; data?: CustomHostnameResult; error?: string }> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
        body: JSON.stringify({
          hostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: {
              min_tls_version: "1.2",
              http2: "on",
            },
          },
        }),
      },
    );

    const json: any = await res.json();
    if (!json.success) {
      // If it already exists on Cloudflare, fetch it
      if (json.errors?.[0]?.code === 1406 || json.errors?.[0]?.message?.includes("already exists")) {
        const existing = await cfGetCustomHostname(hostname);
        if (existing.ok && existing.data) {
          return { ok: true, data: existing.data };
        }
      }
      return { ok: false, error: json.errors?.[0]?.message || "Cloudflare registration failed" };
    }

    return { ok: true, data: json.result };
  } catch (err: any) {
    return { ok: false, error: err.message || "Network error communicating with Cloudflare" };
  }
}

/**
 * Get status of a custom hostname from Cloudflare.
 */
export async function cfGetCustomHostname(
  hostname: string,
): Promise<{ ok: boolean; data?: CustomHostnameResult; error?: string }> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
      },
    );

    const json: any = await res.json();
    if (!json.success || !json.result || json.result.length === 0) {
      return { ok: false, error: "Hostname not found on Cloudflare" };
    }

    return { ok: true, data: json.result[0] };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Delete a custom hostname from Cloudflare when user removes it.
 */
export async function cfDeleteCustomHostname(hostname: string): Promise<boolean> {
  try {
    const info = await cfGetCustomHostname(hostname);
    if (!info.ok || !info.data?.id) return true;

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${info.data.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
      },
    );
    const json: any = await res.json();
    return !!json.success;
  } catch {
    return false;
  }
}
