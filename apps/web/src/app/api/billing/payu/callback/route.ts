import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { payuResponseHash } from "@/lib/payu-hash";
import { applyPayuSuccess } from "@/lib/payu-billing-sync";

function formToRecord(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  form.forEach((v, k) => {
    o[k] = typeof v === "string" ? v : "";
  });
  return o;
}

/**
 * PayU posts application/x-www-form-urlencoded to surl/furl (user browser redirect).
 * Must stay unauthenticated — see middleware exception.
 */
export async function POST(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const redirectBase = `${appUrl}/dashboard/settings`;

  const salt = process.env.PAYU_MERCHANT_SALT?.trim();
  const key = process.env.PAYU_MERCHANT_KEY?.trim();
  if (!salt || !key) {
    return NextResponse.redirect(`${redirectBase}?payu=error&reason=config`, 303);
  }

  let p: Record<string, string>;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      p = formToRecord(await req.formData());
    } else {
      const raw = await req.text();
      const sp = new URLSearchParams(raw);
      p = Object.fromEntries(sp.entries());
    }
  } catch {
    return NextResponse.redirect(`${redirectBase}?payu=error&reason=parse`, 303);
  }

  const statusRaw = p.status ?? "";
  const status = statusRaw.toLowerCase();
  const txnid = p.txnid ?? "";
  const amount = p.amount ?? "";
  const productinfo = p.productinfo ?? "";
  const firstname = p.firstname ?? "";
  const email = p.email ?? "";
  const receivedHash = (p.hash ?? "").toLowerCase();
  const udf1 = p.udf1 ?? "";
  const udf2 = p.udf2 ?? "";
  const additionalCharges = p.additionalCharges ?? "";

  if (!txnid || !receivedHash) {
    return NextResponse.redirect(`${redirectBase}?payu=error&reason=missing`, 303);
  }

  const expected = payuResponseHash({
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    status: statusRaw,
    udf1,
    udf2,
    udf3: p.udf3,
    udf4: p.udf4,
    udf5: p.udf5,
    salt,
    additionalCharges: additionalCharges || undefined,
  }).toLowerCase();

  if (expected !== receivedHash) {
    return NextResponse.redirect(`${redirectBase}?payu=error&reason=hash`, 303);
  }

  const supabase = createServiceClient();
  const { data: row } = await supabase.from("payu_transactions").select("org_id, amount, intent, fulfilled_at").eq("txnid", txnid).maybeSingle();

  if (!row) {
    return NextResponse.redirect(`${redirectBase}?payu=error&reason=txnid`, 303);
  }

  if (row.fulfilled_at) {
    return NextResponse.redirect(`${redirectBase}?payu=ok&duplicate=1`, 303);
  }

  const amtOk = (amount || "").trim() === (row.amount as string).trim();
  if (!amtOk) {
    return NextResponse.redirect(`${redirectBase}?payu=error&reason=amount`, 303);
  }

  const orgId = row.org_id as string;
  const intent = row.intent === "pro" ? "pro" : "demo";

  if (status === "success") {
    await applyPayuSuccess(orgId, intent, txnid);
    await supabase.from("payu_transactions").update({ fulfilled_at: new Date().toISOString() }).eq("txnid", txnid);
    return NextResponse.redirect(`${redirectBase}?payu=success&intent=${intent}`, 303);
  }

  return NextResponse.redirect(`${redirectBase}?payu=failed&status=${encodeURIComponent(status)}`, 303);
}
