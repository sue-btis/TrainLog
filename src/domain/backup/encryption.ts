import { z } from 'zod';

const FORMAT = 'trainlog-encrypted-backup';

// OWASP Password Storage Cheat Sheet figure for PBKDF2-HMAC-SHA-256.
export const PBKDF2_ITERATIONS = 600_000;

export const MIN_PASSWORD_LENGTH = 8;

// A file states its own iteration count; bound it so a crafted file can neither
// downgrade the derivation to nothing nor stall the phone for minutes.
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

const envelope = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int().min(MIN_ITERATIONS).max(MAX_ITERATIONS),
    salt: z.string(),
  }),
  cipher: z.object({ name: z.literal('AES-GCM'), iv: z.string() }),
  data: z.string(),
});

type Envelope = z.infer<typeof envelope>;

export class WrongPasswordError extends Error {
  constructor() {
    super('That password does not open this backup. Nothing was restored.');
    this.name = 'WrongPasswordError';
  }
}

export class UnreadableEncryptedBackupError extends Error {
  constructor() {
    super('This encrypted backup is damaged or was written by a newer app. Nothing was restored.');
    this.name = 'UnreadableEncryptedBackupError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Wraps a serialized backup in a password-protected envelope; the backup document itself is unchanged. */
export async function encryptBackupText(
  text: string,
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));

  const sealed: Envelope = {
    format: FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data)),
  };
  return JSON.stringify(sealed);
}

/** Whether a file claims to be an encrypted backup, so restore asks for a password instead of parsing it. */
export function isEncryptedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: unknown } | null)?.format === FORMAT;
  } catch {
    return false;
  }
}

export async function decryptBackupText(text: string, password: string): Promise<string> {
  let sealed: Envelope;
  let salt: Uint8Array<ArrayBuffer>;
  let iv: Uint8Array<ArrayBuffer>;
  let data: Uint8Array<ArrayBuffer>;
  try {
    sealed = envelope.parse(JSON.parse(text));
    salt = fromBase64(sealed.kdf.salt);
    iv = fromBase64(sealed.cipher.iv);
    data = fromBase64(sealed.data);
  } catch {
    throw new UnreadableEncryptedBackupError();
  }
  // Checked here so a damaged envelope reads as damaged, not as a wrong password.
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) throw new UnreadableEncryptedBackupError();

  const key = await deriveKey(password, salt, sealed.kdf.iterations);
  try {
    // AES-GCM authenticates: a wrong key and a tampered byte both fail here.
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPasswordError();
  }
}
