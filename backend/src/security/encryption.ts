import "dotenv/config";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const encodedKey = process.env.TOKEN_ENCRYPTION_KEY;

if (!encodedKey) {
  throw new Error("Falta TOKEN_ENCRYPTION_KEY");
}

const encryptionKey = Buffer.from(encodedKey, "base64");

if (encryptionKey.length !== 32) {
  throw new Error("TOKEN_ENCRYPTION_KEY no tiene exactamente 32 bytes");
}

export function encryptText(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authenticationTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authenticationTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptText(value: string): string {
  const [encodedIv, encodedTag, encodedContent] = value.split(".");

  if (!encodedIv || !encodedTag || !encodedContent) {
    throw new Error("Formato inválido");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(encodedIv, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedContent, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}