/**
 * Date helpers. Transaction dates are calendar dates ("YYYY-MM-DD"), so we
 * work in local calendar terms and never round-trip through UTC midnight.
 */
export function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function parseDate(value: string): Date {
	const [y, m, d] = value.split('-').map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), 28));
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const daysInMonth = (d: Date) => monthEnd(d).getDate();

export function monthKey(d: Date | string): string {
	return (typeof d === 'string' ? d : isoDate(d)).slice(0, 7);
}

/** Every month start between two dates, inclusive. */
export function monthsBetween(start: Date, end: Date): Date[] {
	const out: Date[] = [];
	for (let d = monthStart(start); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push(d);
	return out;
}

export type RangePreset =
	| 'this-month'
	| 'last-month'
	| 'last-3-months'
	| 'last-6-months'
	| 'ytd'
	| 'last-12-months'
	| 'last-year'
	| 'custom';

export const RANGE_PRESETS: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
	{ value: 'this-month', label: 'This month' },
	{ value: 'last-month', label: 'Last month' },
	{ value: 'last-3-months', label: 'Last 3 months' },
	{ value: 'last-6-months', label: 'Last 6 months' },
	{ value: 'ytd', label: 'Year to date' },
	{ value: 'last-12-months', label: 'Last 12 months' },
	{ value: 'last-year', label: 'Last year' }
];

export interface DateRange {
	preset: RangePreset;
	start: string;
	end: string;
	label: string;
}

export function resolveRange(preset: RangePreset, now = new Date(), custom?: { start?: string | null; end?: string | null }): DateRange {
	const label = RANGE_PRESETS.find((p) => p.value === preset)?.label ?? 'Custom';
	const make = (s: Date, e: Date): DateRange => ({ preset, start: isoDate(s), end: isoDate(e), label });
	switch (preset) {
		case 'last-month': {
			const s = monthStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));
			return make(s, monthEnd(s));
		}
		case 'last-3-months':
			return make(monthStart(new Date(now.getFullYear(), now.getMonth() - 2, 1)), monthEnd(now));
		case 'last-6-months':
			return make(monthStart(new Date(now.getFullYear(), now.getMonth() - 5, 1)), monthEnd(now));
		case 'ytd':
			return make(new Date(now.getFullYear(), 0, 1), monthEnd(now));
		case 'last-12-months':
			return make(monthStart(new Date(now.getFullYear(), now.getMonth() - 11, 1)), monthEnd(now));
		case 'last-year':
			return make(new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear() - 1, 11, 31));
		case 'custom': {
			const valid = (v?: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
			if (valid(custom?.start) && valid(custom?.end) && custom!.start! <= custom!.end!) {
				return { preset, start: custom!.start!, end: custom!.end!, label: 'Custom' };
			}
			return resolveRange('this-month', now);
		}
		default:
			return make(monthStart(now), monthEnd(now));
	}
}

/** Reads ?range=…&from=…&to=… from a URL. */
export function rangeFromUrl(url: URL, fallback: RangePreset = 'this-month'): DateRange {
	const raw = url.searchParams.get('range') as RangePreset | null;
	const preset = raw && (raw === 'custom' || RANGE_PRESETS.some((p) => p.value === raw)) ? raw : fallback;
	return resolveRange(preset, new Date(), { start: url.searchParams.get('from'), end: url.searchParams.get('to') });
}
