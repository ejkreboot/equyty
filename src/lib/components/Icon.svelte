<script lang="ts">
	let {
		name,
		size = 20,
		fill = false,
		weight = 400,
		class: className = '',
		label
	}: {
		name: string;
		size?: number;
		fill?: boolean;
		weight?: number;
		class?: string;
		/** Accessible label; decorative (aria-hidden) when omitted. */
		label?: string;
	} = $props();
</script>

<span
	class="icon {className}"
	style:font-size="{size}px"
	style:width="{size}px"
	style:height="{size}px"
	style:font-variation-settings="'FILL' {fill ? 1 : 0}, 'wght' {weight}, 'GRAD' 0, 'opsz' {size <= 20 ? 20 : 24}"
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'img' : undefined}
	aria-label={label}>{name}</span
>
