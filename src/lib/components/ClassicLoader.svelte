<script lang="ts">
	/** Ring spinner matching the classic `border-t-transparent` tailwind pattern. */
	interface Props {
		class?: string;
		/** Toolbar / overlay sizing. */
		size?: 'sm' | 'md' | 'lg';
	}

	let { class: className = '', size = 'md' }: Props = $props();

	const ring = $derived(
		size === 'sm'
			? 'h-5 w-5 border-2'
			: size === 'lg'
				? 'h-10 w-10 border-4'
				: 'h-8 w-8 border-[3px]',
	);
</script>

<div
	class="border-primary box-border flex shrink-0 animate-spin rounded-full border-solid border-t-transparent {ring} {className}"
	role="status"
	aria-live="polite"
	aria-label="Loading"
></div>
