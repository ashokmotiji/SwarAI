import { createHash } from "crypto";

/** PayU web checkout request hash (SHA-512 lowercase hex). @see https://docs.payu.in/docs/hashing-request-and-response */
export function payuRequestHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}): string {
  const udf1 = params.udf1 ?? "";
  const udf2 = params.udf2 ?? "";
  const udf3 = params.udf3 ?? "";
  const udf4 = params.udf4 ?? "";
  const udf5 = params.udf5 ?? "";
  const s = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${params.salt}`;
  return createHash("sha512").update(s, "utf8").digest("hex");
}

/** Reverse hash for PayU response (regular integration, no additional_charges / split). */
export function payuResponseHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
  additionalCharges?: string;
}): string {
  const udf1 = params.udf1 ?? "";
  const udf2 = params.udf2 ?? "";
  const udf3 = params.udf3 ?? "";
  const udf4 = params.udf4 ?? "";
  const udf5 = params.udf5 ?? "";
  const salt = params.salt;
  const status = params.status;
  let body: string;
  if (params.additionalCharges) {
    body = `${params.additionalCharges}|${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`;
  } else {
    body = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`;
  }
  return createHash("sha512").update(body, "utf8").digest("hex");
}
