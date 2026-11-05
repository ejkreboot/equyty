/** Only allow same-origin relative paths as post-auth redirect targets. */
export function safeNext(value: string | null | undefined, fallback = '/dashboard'): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
	return value;
}
