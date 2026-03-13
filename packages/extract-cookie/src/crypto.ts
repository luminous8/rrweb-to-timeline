import { createDecipheriv, pbkdf2Sync } from "node:crypto";

import {
  AES_HASH_PREFIX_LENGTH_BYTES,
  CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES,
  GCM_MIN_PAYLOAD_BYTES,
  GCM_NONCE_LENGTH_BYTES,
  GCM_TAG_LENGTH_BYTES,
  PBKDF2_IV_FILL,
  PBKDF2_KEY_LENGTH_BYTES,
  PBKDF2_SALT,
} from "./constants.js";

export const deriveKey = (password: string, iterations: number): Buffer =>
  pbkdf2Sync(password, PBKDF2_SALT, iterations, PBKDF2_KEY_LENGTH_BYTES, "sha1");

export const decryptAes128Cbc = (
  encryptedValue: Uint8Array,
  keyCandidates: readonly Buffer[],
  stripHashPrefix: boolean,
): string | null => {
  const buffer = Buffer.from(encryptedValue);
  if (buffer.length < CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES) return null;

  const prefix = buffer.subarray(0, CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES).toString("utf8");
  if (!/^v\d\d$/.test(prefix)) {
    return decodeCookieBytes(buffer, false);
  }

  const ciphertext = buffer.subarray(CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES);
  if (!ciphertext.length) return "";

  for (const key of keyCandidates) {
    const decrypted = tryAes128Cbc(ciphertext, key);
    if (!decrypted) continue;
    const decoded = decodeCookieBytes(decrypted, stripHashPrefix);
    if (decoded !== null) return decoded;
  }

  return null;
};

export const decryptAes256Gcm = (
  encryptedValue: Uint8Array,
  key: Buffer,
  stripHashPrefix: boolean,
): string | null => {
  const buffer = Buffer.from(encryptedValue);
  if (buffer.length < CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES) return null;

  const prefix = buffer.subarray(0, CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES).toString("utf8");
  if (!/^v\d\d$/.test(prefix)) return null;

  const payload = buffer.subarray(CHROMIUM_COOKIE_PREFIX_LENGTH_BYTES);
  if (payload.length < GCM_MIN_PAYLOAD_BYTES) return null;

  const nonce = payload.subarray(0, GCM_NONCE_LENGTH_BYTES);
  const authTag = payload.subarray(payload.length - GCM_TAG_LENGTH_BYTES);
  const ciphertext = payload.subarray(
    GCM_NONCE_LENGTH_BYTES,
    payload.length - GCM_TAG_LENGTH_BYTES,
  );

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decodeCookieBytes(plaintext, stripHashPrefix);
  } catch {
    return null;
  }
};

const tryAes128Cbc = (ciphertext: Buffer, key: Buffer): Buffer | null => {
  try {
    const initVector = Buffer.alloc(PBKDF2_KEY_LENGTH_BYTES, PBKDF2_IV_FILL);
    const decipher = createDecipheriv("aes-128-cbc", key, initVector);
    decipher.setAutoPadding(false);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return removePkcs7Padding(plaintext);
  } catch {
    return null;
  }
};

const removePkcs7Padding = (value: Buffer): Buffer => {
  if (!value.length) return value;
  const padding = value[value.length - 1];
  if (!padding || padding > PBKDF2_KEY_LENGTH_BYTES) return value;
  return value.subarray(0, value.length - padding);
};

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

const decodeCookieBytes = (value: Buffer, stripHashPrefix: boolean): string | null => {
  const bytes =
    stripHashPrefix && value.length >= AES_HASH_PREFIX_LENGTH_BYTES
      ? value.subarray(AES_HASH_PREFIX_LENGTH_BYTES)
      : value;
  try {
    const result = UTF8_DECODER.decode(bytes);
    let index = 0;
    while (index < result.length && result.charCodeAt(index) < PBKDF2_IV_FILL) {
      index += 1;
    }
    return result.slice(index);
  } catch {
    return null;
  }
};
