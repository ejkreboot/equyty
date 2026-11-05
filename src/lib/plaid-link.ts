/** Minimal typings + loader for Plaid Link's browser SDK. */
export interface PlaidLinkMetadata {
	institution?: { name: string; institution_id: string } | null;
	accounts?: { id: string; name: string; mask: string | null }[];
	link_session_id?: string;
}
export interface PlaidLinkError {
	error_code: string;
	error_message: string;
	display_message: string | null;
}
interface PlaidHandler {
	open: () => void;
	exit: (opts?: { force: boolean }) => void;
	destroy: () => void;
}
interface PlaidCreateOptions {
	token: string;
	receivedRedirectUri?: string;
	onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
	onExit?: (error: PlaidLinkError | null, metadata: PlaidLinkMetadata) => void;
}
declare global {
	interface Window {
		Plaid?: { create: (opts: PlaidCreateOptions) => PlaidHandler };
	}
}

const SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
let loading: Promise<void> | null = null;

export function loadPlaid(): Promise<void> {
	if (window.Plaid) return Promise.resolve();
	loading ??= new Promise((resolve, reject) => {
		const s = document.createElement('script');
		s.src = SRC;
		s.async = true;
		s.onload = () => resolve();
		s.onerror = () => {
			loading = null;
			reject(new Error('Could not load Plaid Link'));
		};
		document.head.appendChild(s);
	});
	return loading;
}

export const LINK_TOKEN_KEY = 'equyty:plaid-link';

export interface PendingLink {
	token: string;
	itemId?: string;
}

/**
 * Opens Plaid Link and resolves once the user finishes (or exits).
 * The token is stashed in sessionStorage so an OAuth bank redirect back to
 * /plaid/oauth can resume the same Link session.
 */
export async function openLink(
	pending: PendingLink,
	opts: { receivedRedirectUri?: string } = {}
): Promise<{ publicToken: string; metadata: PlaidLinkMetadata } | { exited: true; error: PlaidLinkError | null }> {
	await loadPlaid();
	try {
		sessionStorage.setItem(LINK_TOKEN_KEY, JSON.stringify(pending));
	} catch {
		/* storage unavailable: OAuth resume just won't work */
	}
	return new Promise((resolve) => {
		const handler = window.Plaid!.create({
			token: pending.token,
			receivedRedirectUri: opts.receivedRedirectUri,
			onSuccess: (publicToken, metadata) => {
				handler.destroy();
				resolve({ publicToken, metadata });
			},
			onExit: (error) => {
				handler.destroy();
				resolve({ exited: true, error });
			}
		});
		handler.open();
	});
}

/** Server round-trip after Link succeeds. */
export async function completeLink(pending: PendingLink, publicToken: string, metadata: PlaidLinkMetadata) {
	try {
		sessionStorage.removeItem(LINK_TOKEN_KEY);
	} catch {
		/* ignore */
	}
	if (pending.itemId) {
		// Update mode: credentials repaired, the access token is unchanged. Resync.
		const res = await fetch(`/api/plaid/items/${pending.itemId}/sync`, { method: 'POST' });
		if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Sync failed');
		return res.json();
	}
	const res = await fetch('/api/plaid/exchange', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ public_token: publicToken, institution: metadata.institution ?? null })
	});
	if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Could not connect account');
	return res.json();
}
