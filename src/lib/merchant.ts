/**
 * Normalizes a merchant/description string so rules match across the noise
 * banks add ("SQ *BLUE BOTTLE #123 OAKLAND CA" → "blue bottle oakland ca").
 * Shared by the rule engine (server) and rule creation (browser).
 */
const PREFIXES = /^(sq|tst|sp|pp|paypal|pos|ach|dd|debit card purchase|purchase|recurring payment|checkcard)\s*\*?\s*/i;

export function normalizeMerchant(value: string): string {
	return value
		.toLowerCase()
		.replace(PREFIXES, '')
		.replace(/[#*]\s*\d+/g, ' ')
		.replace(/\b\d{3,}\b/g, ' ')
		.replace(/[^a-z0-9&' ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
