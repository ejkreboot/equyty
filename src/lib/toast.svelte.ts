export type ToastKind = 'info' | 'success' | 'error';
export interface Toast {
	id: number;
	kind: ToastKind;
	message: string;
	action?: { label: string; run: () => void };
}

let nextId = 1;
export const toasts = $state<Toast[]>([]);

export function toast(message: string, kind: ToastKind = 'info', action?: Toast['action'], ms = 4200) {
	const id = nextId++;
	toasts.push({ id, kind, message, action });
	setTimeout(() => dismiss(id), ms);
	return id;
}

export function dismiss(id: number) {
	const i = toasts.findIndex((t) => t.id === id);
	if (i !== -1) toasts.splice(i, 1);
}
