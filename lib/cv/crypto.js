import crypto from "crypto";

const KEY_BASE64 = process.env.CV_ENCRYPTION_KEY;

if (!KEY_BASE64){
  throw new Error("CV_ENCRYPTION_KEY n'est pas défini. Fournissez une clé base64 de 32 octets.");
}

let key;
try {
  key = Buffer.from(KEY_BASE64, "base64");
} catch (error) {
  throw new Error("CV_ENCRYPTION_KEY doit être encodé en base64.");
}

if (key.length !== 32){
  throw new Error("CV_ENCRYPTION_KEY doit représenter 32 octets (AES-256).");
}

const PREFIX = Buffer.from("cv1");
const IV_LENGTH = 12; // AES-GCM standard

export function encryptString(plainText){
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([PREFIX, iv, authTag, encrypted]);
  return payload.toString("base64");
}

export function decryptString(base64Payload){
  const buffer = Buffer.from(base64Payload, "base64");
  if (buffer.length < PREFIX.length + IV_LENGTH + 16){
    throw new Error("Payload chiffré invalide.");
  }
  const prefix = buffer.subarray(0, PREFIX.length);
  if (!prefix.equals(PREFIX)){
    throw new Error("Version de payload chiffré incompatible.");
  }
  const iv = buffer.subarray(PREFIX.length, PREFIX.length + IV_LENGTH);
  const authTag = buffer.subarray(PREFIX.length + IV_LENGTH, PREFIX.length + IV_LENGTH + 16);
  const ciphertext = buffer.subarray(PREFIX.length + IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
