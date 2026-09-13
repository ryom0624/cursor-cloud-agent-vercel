import { bytesToHex } from "../tool-utils";

export type HmacAlgorithm = "SHA-1" | "SHA-256" | "SHA-512";

function normalizeSignature(value: string) {
  return value.trim().replace(/^sha(1|256|512)=/i, "").replace(/^0x/i, "").replace(/\s+/g, "");
}

function timingSafeEqual(left: string, right: string) {
  const max = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let index = 0; index < max; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function computeHmacHex(
  algorithm: HmacAlgorithm,
  secret: string,
  payload: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const buffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(buffer);
}

export async function computeHmacBase64(
  algorithm: HmacAlgorithm,
  secret: string,
  payload: string,
) {
  const hex = await computeHmacHex(algorithm, secret, payload);
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function verifyHmac(options: {
  algorithm: HmacAlgorithm;
  secret: string;
  payload: string;
  expected: string;
}) {
  if (!options.secret) {
    return { valid: false, error: "Secret が空です。Secretは保存されません。" };
  }
  const expected = normalizeSignature(options.expected);
  if (!expected) {
    return { valid: false, error: "Expected Signature が空です。" };
  }
  const hex = await computeHmacHex(options.algorithm, options.secret, options.payload);
  const base64 = await computeHmacBase64(options.algorithm, options.secret, options.payload);
  const valid =
    timingSafeEqual(expected.toLowerCase(), hex.toLowerCase()) ||
    timingSafeEqual(expected, base64) ||
    timingSafeEqual(expected.replaceAll("-", "+").replaceAll("_", "/"), base64);
  return {
    valid,
    hex,
    base64,
  };
}
