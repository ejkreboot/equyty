export type ThemeChoice = 'light' | 'dark' | 'system';

function initial(): ThemeChoice {
	if (typeof localStorage === 'undefined') return 'system';
	try {
		const t = localStorage.getItem('theme');
		return t === 'light' || t === 'dark' ? t : 'system';
	} catch {
		return 'system';
	}
}

class Theme {
	value = $state<ThemeChoice>(initial());

	set(choice: ThemeChoice) {
		this.value = choice;
		try {
			if (choice === 'system') localStorage.removeItem('theme');
			else localStorage.setItem('theme', choice);
		} catch {
			/* ignore */
		}
		if (choice === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = choice;
	}
}

export const theme = new Theme();
