import { parseDate } from './dates';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function money(value: number | null | undefined, opts: { cents?: boolean; currency?: string; signed?: boolean } = {}): string {
	const { cents = true, currency = 'USD', signed = false } = opts;
	const key = `${currency}|${cents}|${signed}`;
	let f = currencyFormatters.get(key);
	if (!f) {
		f = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			minimumFractionDigits: cents ? 2 : 0,
			maximumFractionDigits: cents ? 2 : 0,
			signDisplay: signed ? 'exceptZero' : 'auto'
		});
		currencyFormatters.set(key, f);
	}
	return f.format(value ?? 0);
}

const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
export function moneyCompact(value: number): string {
	return Math.abs(value) < 1000 ? money(value, { cents: false }) : compact.format(value);
}

export function percent(value: number, digits = 1): string {
	if (!Number.isFinite(value)) return '—';
	return `${(value * 100).toFixed(digits)}%`;
}

export function shortDate(value: string): string {
	return parseDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function longDate(value: string): string {
	return parseDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dayHeading(value: string): string {
	const d = parseDate(value);
	const today = new Date();
	const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
	const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
	if (same(d, today)) return 'Today';
	if (same(d, yesterday)) return 'Yesterday';
	return d.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric'
	});
}

export function monthLabel(value: string | Date, style: 'short' | 'long' = 'short'): string {
	const d = typeof value === 'string' ? parseDate(value.length === 7 ? `${value}-01` : value) : value;
	return d.toLocaleDateString('en-US', { month: style, year: style === 'long' ? 'numeric' : '2-digit' });
}

export function relativeTime(iso: string | null): string {
	if (!iso) return 'never';
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.round(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	return `${days}d ago`;
}

export function titleCase(value: string): string {
	return value.toLowerCase().replace(/(^|[\s_-])(\w)/g, (_, sep, c) => `${sep === '_' ? ' ' : sep}${c.toUpperCase()}`);
}
