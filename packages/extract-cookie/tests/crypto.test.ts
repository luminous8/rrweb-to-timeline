import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptAes128Cbc, decryptAes256Gcm, deriveKey } from "../src/crypto.js";

describe("deriveKey", () => {
  it("produces a 16-byte key", () => {
    const key = deriveKey("test-password", 1003);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(16);
  });

  it("produces different keys for different passwords", () => {
    const keyA = deriveKey("password-a", 1003);
    const keyB = deriveKey("password-b", 1003);
    expect(keyA.equals(keyB)).toBe(false);
  });

  it("produces different keys for different iterations", () => {
    const keyA = deriveKey("same", 1);
    const keyB = deriveKey("same", 1003);
    expect(keyA.equals(keyB)).toBe(false);
  });

  it("matches manual pbkdf2Sync", () => {
    const password = "Chrome Safe Storage";
    const expected = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
    expect(deriveKey(password, 1003).equals(expected)).toBe(true);
  });

  it("produces deterministic output", () => {
    const keyA = deriveKey("same-pass", 1003);
    const keyB = deriveKey("same-pass", 1003);
    expect(keyA.equals(keyB)).toBe(true);
  });

  it("works with single iteration (linux)", () => {
    const key = deriveKey("peanuts", 1);
    expect(key.length).toBe(16);
  });

  it("works with empty password", () => {
    const key = deriveKey("", 1);
    expect(key.length).toBe(16);
  });
});

describe("decryptAes128Cbc", () => {
  const encrypt = (plaintext: string, key: Buffer): Buffer => {
    const iv = Buffer.alloc(16, 0x20);
    const cipher = createCipheriv("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([Buffer.from("v10"), encrypted]);
  };

  it("decrypts a v10-prefixed value", () => {
    const key = deriveKey("test-password", 1003);
    const encrypted = encrypt("my-cookie-value", key);
    const result = decryptAes128Cbc(encrypted, [key], false);
    expect(result).toBe("my-cookie-value");
  });

  it("decrypts a v11-prefixed value", () => {
    const key = deriveKey("test-password", 1003);
    const iv = Buffer.alloc(16, 0x20);
    const cipher = createCipheriv("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([
      Buffer.from("v11"),
      cipher.update("my-value", "utf8"),
      cipher.final(),
    ]);
    const result = decryptAes128Cbc(encrypted, [key], false);
    expect(result).toBe("my-value");
  });

  it("tries multiple key candidates", () => {
    const correctKey = deriveKey("correct", 1003);
    const wrongKey = deriveKey("wrong", 1003);
    const encrypted = encrypt("secret", correctKey);
    const result = decryptAes128Cbc(encrypted, [wrongKey, correctKey], false);
    expect(result).toBe("secret");
  });

  it("returns null when no key works", () => {
    const correctKey = deriveKey("correct", 1003);
    const wrongKey = deriveKey("wrong", 1003);
    const encrypted = encrypt("secret", correctKey);
    const result = decryptAes128Cbc(encrypted, [wrongKey], false);
    expect(result).toBeNull();
  });

  it("returns null for short buffers", () => {
    expect(decryptAes128Cbc(new Uint8Array([1, 2]), [], false)).toBeNull();
  });

  it("returns null for empty buffer", () => {
    expect(decryptAes128Cbc(new Uint8Array([]), [], false)).toBeNull();
  });

  it("treats non-v10 prefix as plaintext", () => {
    const plainBuffer = Buffer.from("plain-value");
    const result = decryptAes128Cbc(plainBuffer, [], false);
    expect(result).toBe("plain-value");
  });

  it("returns empty string for v10 prefix with no ciphertext", () => {
    const result = decryptAes128Cbc(Buffer.from("v10"), [], false);
    expect(result).toBe("");
  });

  it("strips hash prefix when enabled", () => {
    const key = deriveKey("test", 1003);
    const hashPrefix = randomBytes(32);
    const plaintext = Buffer.concat([hashPrefix, Buffer.from("actual-value")]);
    const iv = Buffer.alloc(16, 0x20);
    const cipher = createCipheriv("aes-128-cbc", key, iv);
    const encrypted = Buffer.concat([Buffer.from("v10"), cipher.update(plaintext), cipher.final()]);
    const result = decryptAes128Cbc(encrypted, [key], true);
    expect(result).toBe("actual-value");
  });

  it("decrypts unicode values", () => {
    const key = deriveKey("test", 1003);
    const encrypted = encrypt("日本語テスト", key);
    expect(decryptAes128Cbc(encrypted, [key], false)).toBe("日本語テスト");
  });

  it("decrypts empty string", () => {
    const key = deriveKey("test", 1003);
    const encrypted = encrypt("", key);
    expect(decryptAes128Cbc(encrypted, [key], false)).toBe("");
  });

  it("handles Uint8Array input", () => {
    const key = deriveKey("test", 1003);
    const encrypted = encrypt("from-uint8", key);
    const uint8 = new Uint8Array(encrypted);
    expect(decryptAes128Cbc(uint8, [key], false)).toBe("from-uint8");
  });

  it("returns null with stripHashPrefix=false when hash prefix contains non-UTF8 bytes", () => {
    const key = deriveKey("pw", 1003);
    const iv = Buffer.alloc(16, 0x20);
    const hashPrefix = Buffer.alloc(32, 0xff);
    const plaintext = Buffer.concat([hashPrefix, Buffer.from("hello", "utf8")]);
    const cipher = createCipheriv("aes-128-cbc", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const encrypted = Buffer.concat([Buffer.from("v10"), ciphertext]);

    expect(decryptAes128Cbc(encrypted, [key], true)).toBe("hello");
    expect(decryptAes128Cbc(encrypted, [key], false)).toBeNull();
  });
});

describe("decryptAes256Gcm", () => {
  const encrypt = (plaintext: string, key: Buffer): Buffer => {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from("v10"), nonce, encrypted, authTag]);
  };

  it("decrypts a v10-prefixed AES-256-GCM value", () => {
    const key = randomBytes(32);
    const encrypted = encrypt("windows-cookie", key);
    const result = decryptAes256Gcm(encrypted, key, false);
    expect(result).toBe("windows-cookie");
  });

  it("returns null for wrong key", () => {
    const correctKey = randomBytes(32);
    const wrongKey = randomBytes(32);
    const encrypted = encrypt("secret", correctKey);
    const result = decryptAes256Gcm(encrypted, wrongKey, false);
    expect(result).toBeNull();
  });

  it("returns null for short buffers", () => {
    expect(decryptAes256Gcm(new Uint8Array([1, 2]), randomBytes(32), false)).toBeNull();
  });

  it("returns null for empty buffer", () => {
    expect(decryptAes256Gcm(new Uint8Array([]), randomBytes(32), false)).toBeNull();
  });

  it("returns null for non-v-prefix", () => {
    const buffer = Buffer.alloc(50, 0);
    expect(decryptAes256Gcm(buffer, randomBytes(32), false)).toBeNull();
  });

  it("returns null for payload too short for nonce+tag", () => {
    const buffer = Buffer.concat([Buffer.from("v10"), Buffer.alloc(20)]);
    expect(decryptAes256Gcm(buffer, randomBytes(32), false)).toBeNull();
  });

  it("decrypts with hash prefix stripping", () => {
    const key = randomBytes(32);
    const hashPrefix = randomBytes(32);
    const plaintext = Buffer.concat([hashPrefix, Buffer.from("real-value")]);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([Buffer.from("v10"), nonce, encrypted, authTag]);
    expect(decryptAes256Gcm(payload, key, true)).toBe("real-value");
  });

  it("decrypts empty string", () => {
    const key = randomBytes(32);
    const encrypted = encrypt("", key);
    expect(decryptAes256Gcm(encrypted, key, false)).toBe("");
  });

  it("decrypts unicode values", () => {
    const key = randomBytes(32);
    const encrypted = encrypt("émoji 🍪", key);
    expect(decryptAes256Gcm(encrypted, key, false)).toBe("émoji 🍪");
  });

  it("returns null for tampered ciphertext", () => {
    const key = randomBytes(32);
    const encrypted = encrypt("secret", key);
    encrypted[15] ^= 0xff;
    expect(decryptAes256Gcm(encrypted, key, false)).toBeNull();
  });

  it("returns null with stripHashPrefix=false when hash prefix contains non-UTF8 bytes", () => {
    const key = randomBytes(32);
    const nonce = randomBytes(12);
    const hashPrefix = Buffer.alloc(32, 0xff);
    const plaintext = Buffer.concat([hashPrefix, Buffer.from("cookie", "utf8")]);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encrypted = Buffer.concat([Buffer.from("v10"), nonce, ciphertext, tag]);

    expect(decryptAes256Gcm(encrypted, key, true)).toBe("cookie");
    expect(decryptAes256Gcm(encrypted, key, false)).toBeNull();
  });
});
