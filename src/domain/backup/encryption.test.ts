import { describe, expect, it } from 'vitest';
import {
  UnreadableEncryptedBackupError,
  WrongPasswordError,
  decryptBackupText,
  encryptBackupText,
  isEncryptedBackup,
} from '@/domain/backup/encryption';

// The floor the envelope accepts, so each derivation stays fast in tests.
const FAST = 100_000;

const PLAIN = JSON.stringify({ version: 3, exercises: [{ name: 'Bayesian Curl' }], bodyweightKg: 78 });

describe('encrypted backup', () => {
  it('returns the exact text with the right password', async () => {
    const sealed = await encryptBackupText(PLAIN, 'correct horse', FAST);

    await expect(decryptBackupText(sealed, 'correct horse')).resolves.toBe(PLAIN);
  });

  it('holds no readable training data', async () => {
    const sealed = await encryptBackupText(PLAIN, 'correct horse', FAST);

    expect(sealed).not.toContain('Bayesian');
    expect(sealed).not.toContain('bodyweight');
  });

  it('refuses a wrong password', async () => {
    const sealed = await encryptBackupText(PLAIN, 'correct horse', FAST);

    await expect(decryptBackupText(sealed, 'wrong horse')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('refuses a tampered byte, which GCM authentication catches', async () => {
    const sealed = JSON.parse(await encryptBackupText(PLAIN, 'correct horse', FAST)) as { data: string };
    const bytes = atob(sealed.data);
    const flipped = String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1);

    await expect(
      decryptBackupText(JSON.stringify({ ...sealed, data: btoa(flipped) }), 'correct horse'),
    ).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('refuses an envelope whose iteration count is out of bounds before deriving', async () => {
    const sealed = JSON.parse(await encryptBackupText(PLAIN, 'correct horse', FAST)) as {
      kdf: Record<string, unknown>;
    };
    const weak = JSON.stringify({ ...sealed, kdf: { ...sealed.kdf, iterations: 1 } });

    await expect(decryptBackupText(weak, 'correct horse')).rejects.toBeInstanceOf(
      UnreadableEncryptedBackupError,
    );
  });

  it('refuses an iteration count above the ceiling, and a malformed envelope', async () => {
    const sealed = JSON.parse(await encryptBackupText(PLAIN, 'correct horse', FAST)) as {
      kdf: Record<string, unknown>;
      cipher: Record<string, unknown>;
    };
    const variants = [
      { ...sealed, kdf: { ...sealed.kdf, iterations: 10_000_001 } },
      { ...sealed, data: '***not base64***' },
      { ...sealed, cipher: { ...sealed.cipher, iv: btoa('short') } },
      { format: 'trainlog-encrypted-backup', version: 1 },
    ];

    for (const variant of variants) {
      await expect(decryptBackupText(JSON.stringify(variant), 'correct horse')).rejects.toBeInstanceOf(
        UnreadableEncryptedBackupError,
      );
    }
  });

  it('tells an encrypted file from a plain backup', async () => {
    expect(isEncryptedBackup(await encryptBackupText(PLAIN, 'correct horse', FAST))).toBe(true);
    expect(isEncryptedBackup(PLAIN)).toBe(false);
    expect(isEncryptedBackup('not json')).toBe(false);
  });
});
