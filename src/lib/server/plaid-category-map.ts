/**
 * Maps Plaid's Personal Finance Category taxonomy onto the default category
 * names seeded by the migration. Used as a deterministic fallback when AI
 * categorization is unavailable, and as a hint passed to the model.
 * https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv
 */
const DETAILED: Record<string, string> = {
	INCOME_WAGES: 'Paychecks',
	INCOME_INTEREST_EARNED: 'Interest & Dividends',
	INCOME_DIVIDENDS: 'Interest & Dividends',
	INCOME_TAX_REFUND: 'Refunds & Reimbursements',
	INCOME_RETIREMENT_PENSION: 'Other Income',
	INCOME_UNEMPLOYMENT: 'Other Income',
	INCOME_OTHER_INCOME: 'Other Income',

	TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: 'Investment Transfer',
	TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: 'Investment Transfer',
	TRANSFER_OUT_WITHDRAWAL: 'Cash & ATM',
	TRANSFER_IN_CASH_ADVANCES_AND_LOANS: 'Transfer',

	LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'Credit Card Payment',
	LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'Mortgage',
	LOAN_PAYMENTS_CAR_PAYMENT: 'Auto Payment',

	BANK_FEES_ATM_FEES: 'Fees & Charges',

	ENTERTAINMENT_TV_AND_MOVIES: 'Subscriptions',
	ENTERTAINMENT_MUSIC_AND_AUDIO: 'Subscriptions',

	FOOD_AND_DRINK_GROCERIES: 'Groceries',
	FOOD_AND_DRINK_COFFEE: 'Coffee Shops',

	GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'Clothing',
	GENERAL_MERCHANDISE_ELECTRONICS: 'Electronics',
	GENERAL_MERCHANDISE_PET_SUPPLIES: 'Pets',
	GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: 'Gifts',
	GENERAL_MERCHANDISE_PHARMACIES_AND_SUPPLEMENTS: 'Pharmacy',
	GENERAL_MERCHANDISE_SUPERSTORES: 'Shopping',
	GENERAL_MERCHANDISE_DISCOUNT_STORES: 'Household',

	HOME_IMPROVEMENT_FURNITURE: 'Household',

	MEDICAL_DENTAL_CARE: 'Dentist',
	MEDICAL_PHARMACIES_AND_SUPPLEMENTS: 'Pharmacy',

	PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'Fitness',

	GENERAL_SERVICES_INSURANCE: 'Insurance',
	GENERAL_SERVICES_CHILDCARE: 'Child Care',
	GENERAL_SERVICES_EDUCATION: 'Education',
	GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: 'Financial & Legal Services',
	GENERAL_SERVICES_CONSULTING_AND_LEGAL: 'Financial & Legal Services',
	GENERAL_SERVICES_AUTOMOTIVE: 'Auto Maintenance',

	GOVERNMENT_AND_NON_PROFIT_DONATIONS: 'Charity',
	GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: 'Taxes',

	TRANSPORTATION_GAS: 'Gas',
	TRANSPORTATION_PARKING: 'Parking & Tolls',
	TRANSPORTATION_TOLLS: 'Parking & Tolls',
	TRANSPORTATION_PUBLIC_TRANSIT: 'Public Transit',
	TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'Ride Share',
	TRANSPORTATION_BIKES_AND_SCOOTERS: 'Ride Share',

	RENT_AND_UTILITIES_RENT: 'Rent',
	RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: 'Gas & Electric',
	RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'Internet & Cable',
	RENT_AND_UTILITIES_TELEPHONE: 'Phone',
	RENT_AND_UTILITIES_WATER: 'Water',
	RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: 'Garbage'
};

const PRIMARY: Record<string, string> = {
	INCOME: 'Other Income',
	TRANSFER_IN: 'Transfer',
	TRANSFER_OUT: 'Transfer',
	LOAN_PAYMENTS: 'Loan Repayment',
	BANK_FEES: 'Fees & Charges',
	ENTERTAINMENT: 'Entertainment',
	FOOD_AND_DRINK: 'Restaurants & Bars',
	GENERAL_MERCHANDISE: 'Shopping',
	HOME_IMPROVEMENT: 'Home Improvement',
	MEDICAL: 'Medical',
	PERSONAL_CARE: 'Personal Care',
	GENERAL_SERVICES: 'Miscellaneous',
	GOVERNMENT_AND_NON_PROFIT: 'Financial & Legal Services',
	TRANSPORTATION: 'Public Transit',
	TRAVEL: 'Travel & Vacation',
	RENT_AND_UTILITIES: 'Gas & Electric'
};

export function plaidCategoryToName(primary: string | null, detailed: string | null): string | null {
	if (detailed && DETAILED[detailed]) return DETAILED[detailed];
	if (primary && PRIMARY[primary]) return PRIMARY[primary];
	return null;
}
