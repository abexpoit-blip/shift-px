import { supabaseAdmin } from "../src/integrations/supabase/client.server";

type UpgradeRequest = {
  id: string;
  user_id: string;
  package_slug: string;
  amount: number | string | null;
  status: string | null;
  plisio_invoice_id: string | null;
  plisio_invoice_url: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  email: string | null;
  plan_slug: string | null;
  click_quota: number | null;
  link_limit: number | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
};

type PackageRow = {
  slug: string;
  click_quota: number | null;
  link_limit: number | null;
};

const paidStatuses = new Set(["completed", "success", "finished"]);

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  console.log(`
Plisio payment diagnose/repair

Diagnose recent orders:
  bun scripts/plisio-repair.ts --days 7

Diagnose one invoice/order/user:
  bun scripts/plisio-repair.ts --txn <plisio_txn_id>
  bun scripts/plisio-repair.ts --order <upgrade_request_uuid>
  bun scripts/plisio-repair.ts --email user@example.com

Repair ONLY after Plisio API says completed/success/finished:
  bun scripts/plisio-repair.ts --txn <plisio_txn_id> --repair
  bun scripts/plisio-repair.ts --order <upgrade_request_uuid> --repair
`);
}

async function fetchPlisioOperation(txnId: string) {
  const apiKey = process.env.PLISIO_API_KEY;
  if (!apiKey) return { skipped: true as const, data: null };

  const res = await fetch(
    `https://api.plisio.net/api/v1/operations/${encodeURIComponent(txnId)}?api_key=${encodeURIComponent(apiKey)}`,
  );
  const json = await res.json().catch(() => null) as any;
  if (!res.ok || json?.status !== "success") {
    throw new Error(`Plisio API failed for ${txnId}: HTTP ${res.status} ${JSON.stringify(json)?.slice(0, 300)}`);
  }
  return { skipped: false as const, data: json.data ?? null };
}

async function applyPackageToProfile(userId: string, pkg: PackageRow) {
  const now = new Date();
  const resetAt = now.toISOString();
  const isLifetime = pkg.slug === "lifetime" || pkg.slug === "unlimited";
  const expiresAt = isLifetime
    ? null
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("plan_slug, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const expiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
  const keepExistingUsage =
    pkg.slug !== "free" &&
    profile?.plan_slug === pkg.slug &&
    (expiry == null || Number.isNaN(expiry) || expiry > now.getTime());

  const update = keepExistingUsage
    ? {
        plan_slug: pkg.slug,
        click_quota: pkg.click_quota,
        link_limit: pkg.link_limit,
        plan_expires_at: expiresAt,
      }
    : {
        plan_slug: pkg.slug,
        click_quota: pkg.click_quota,
        link_limit: pkg.link_limit,
        clicks_used: 0,
        clicks_period_start: resetAt,
        plan_started_at: resetAt,
        plan_expires_at: expiresAt,
      };

  const { error } = await supabaseAdmin.from("profiles").update(update as any).eq("id", userId);
  if (error) throw error;
}

async function loadProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, Profile>();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,plan_slug,click_quota,link_limit,plan_started_at,plan_expires_at")
    .in("id", userIds);
  if (error) throw error;
  return new Map((data ?? []).map((p: any) => [p.id, p as Profile]));
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const days = Math.max(1, Number(arg("--days") ?? 7));
  const txn = arg("--txn");
  const order = arg("--order");
  const email = arg("--email");
  const repair = hasFlag("--repair");

  if (repair && !txn && !order) {
    throw new Error("For safety, repair mode requires --txn <id> or --order <uuid>.");
  }

  let userIdsFromEmail: string[] = [];
  if (email) {
    const { data, error } = await supabaseAdmin.from("profiles").select("id,email").ilike("email", email);
    if (error) throw error;
    userIdsFromEmail = (data ?? []).map((p: any) => p.id);
    if (userIdsFromEmail.length === 0) {
      console.log(`No profile found for email: ${email}`);
      return;
    }
  }

  let query = supabaseAdmin
    .from("upgrade_requests")
    .select("id,user_id,package_slug,amount,status,plisio_invoice_id,plisio_invoice_url,created_at");

  if (txn) query = query.eq("plisio_invoice_id", txn);
  else if (order) query = query.eq("id", order);
  else if (userIdsFromEmail.length > 0) query = query.in("user_id", userIdsFromEmail);
  else query = query.gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  const { data: requests, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;

  const rows = (requests ?? []) as UpgradeRequest[];
  if (rows.length === 0) {
    console.log("No upgrade requests found for this filter.");
    return;
  }

  const profiles = await loadProfiles([...new Set(rows.map((r) => r.user_id))]);
  const output: any[] = [];
  const operations = new Map<string, any>();
  let plisioSkipped = false;

  for (const req of rows) {
    let op: any = null;
    if (req.plisio_invoice_id) {
      const fetched = await fetchPlisioOperation(req.plisio_invoice_id);
      if (fetched.skipped) plisioSkipped = true;
      op = fetched.data;
      operations.set(req.id, op);
    }

    const profile = profiles.get(req.user_id);
    const plisioStatus = String(op?.status ?? "unknown").toLowerCase();
    const isPaidAtPlisio = paidStatuses.has(plisioStatus);
    const localPaid = String(req.status ?? "").toLowerCase() === "paid";
    const profileHasPackage = profile?.plan_slug === req.package_slug;

    output.push({
      created: req.created_at?.slice(0, 19).replace("T", " "),
      email: profile?.email ?? "(missing profile)",
      package: req.package_slug,
      local_status: req.status,
      plisio_status: plisioStatus,
      profile_plan: profile?.plan_slug ?? "(none)",
      needs_repair: isPaidAtPlisio && (!localPaid || !profileHasPackage) ? "YES" : "no",
      order: req.id,
      txn: req.plisio_invoice_id,
    });
  }

  console.table(output);
  if (plisioSkipped) {
    console.log("Note: PLISIO_API_KEY is missing, so live Plisio status was skipped. Source .env first.");
  }

  if (!repair) {
    console.log("Dry run only. Add --repair with --txn or --order to apply a package, but only if Plisio status is paid.");
    return;
  }

  if (rows.length !== 1) {
    throw new Error(`Repair mode found ${rows.length} orders. Narrow it to exactly one order/txn first.`);
  }

  const req = rows[0];
  const op = operations.get(req.id);
  const plisioStatus = String(op?.status ?? "").toLowerCase();
  if (!paidStatuses.has(plisioStatus)) {
    throw new Error(`Refusing repair: Plisio status is '${plisioStatus || "unknown"}', not paid.`);
  }

  const { data: pkg, error: pkgErr } = await supabaseAdmin
    .from("packages")
    .select("slug,click_quota,link_limit")
    .eq("slug", req.package_slug)
    .maybeSingle();
  if (pkgErr) throw pkgErr;
  if (!pkg) throw new Error(`Package not found: ${req.package_slug}`);

  await applyPackageToProfile(req.user_id, pkg as PackageRow);
  const { error: orderErr } = await supabaseAdmin
    .from("upgrade_requests")
    .update({ status: "paid" } as any)
    .eq("id", req.id);
  if (orderErr) throw orderErr;

  await supabaseAdmin.from("plisio_event_logs").insert({
    txn_id: req.plisio_invoice_id,
    order_number: req.id,
    status: "recovered-paid",
    raw_body: { source: "plisio-repair-script", plisio_operation: op },
    processed_at: new Date().toISOString(),
  } as any);

  console.log(`REPAIRED: order ${req.id} marked paid and package '${req.package_slug}' applied.`);
}

main().catch((error) => {
  console.error("ERROR:", error?.message || error);
  process.exit(1);
});