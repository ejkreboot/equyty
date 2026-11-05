import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * AES-256-GCM envelope for Plaid access tokens at rest.
 * Format: v1.<iv b64url>.<auth tag b64url>.<ciphertext b64url>
 *
 * Generate a key with:  openssl rand -base64 32
 */
const VERSION = 'v1';

function key(): Buffer {
	const raw = env.PLAID_TOKEN_ENCRYPTION_KEY;
	if (!raw) throw new Error('PLAID_TOKEN_ENCRYPTION_KEY is not set');
	const buf = Buffer.from(raw, 'base64');
	if (buf.length !== 32) throw new Error('PLAID_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
	return buf;
}

export function encryptSecret(plaintext: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
	const [version, iv, tag, ciphertext] = payload.split('.');
	if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Malformed secret payload');
	const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
	decipher.setAuthTag(Buffer.from(tag, 'base64url'));
	return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
