<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Menu } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';

	let { ctaHref = '/?auth=signup', ctaLabel = 'Get Meme Accounts' }: { ctaHref?: string; ctaLabel?: string } =
		$props();

	const user = $derived($page.data.user);
	const path = $derived($page.url.pathname);
	let scrolled = $state(false);
	let menuOpen = $state(false);

	const navLinks = [
		{ href: '/#studio', label: 'Features' },
		{ href: '/#workflow', label: 'How it works' },
		{ href: '/pricing', label: 'Pricing', match: '/pricing' },
	];

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 24;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function closeMenu() {
		menuOpen = false;
	}
</script>

<nav
	class="sticky top-0 z-50 flex items-center justify-between gap-3 border-b px-4 py-4 transition-all sm:gap-5 sm:px-6 sm:py-5 md:px-8 {scrolled
		? 'border-[var(--mk-line)] bg-white/82 backdrop-blur-[18px]'
		: 'border-transparent bg-transparent'}"
>
	<a href="/" class="flex min-w-0 shrink items-center">
		<img
			src="/logo/meme-accounts-logo.webp"
			alt="Meme Accounts"
			class="h-7 w-auto max-w-[min(200px,52vw)] object-contain"
			width="180"
			height="28"
		/>
	</a>

	<div class="hidden items-center gap-7 md:flex">
		{#each navLinks as link}
			<a
				href={link.href}
				class="text-sm font-semibold no-underline transition-colors {link.match && path === link.match
					? 'text-[var(--mk-text)]'
					: 'text-[var(--mk-text-2)] hover:text-[var(--mk-text)]'}"
				aria-current={link.match && path === link.match ? 'page' : undefined}
			>
				{link.label}
			</a>
		{/each}
	</div>

	<div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
		<Sheet.Root bind:open={menuOpen}>
			<Sheet.Trigger
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mk-line)] bg-white text-[var(--mk-text)] md:hidden"
				aria-label="Open menu"
			>
				<Menu size={18} />
			</Sheet.Trigger>
			<Sheet.Content side="right" class="w-[min(100vw-2rem,320px)] gap-6 p-6">
				<Sheet.Header class="text-left">
					<Sheet.Title class="text-base font-bold">Menu</Sheet.Title>
				</Sheet.Header>
				<nav class="flex flex-col gap-1">
					{#each navLinks as link}
						<a
							href={link.href}
							class="rounded-lg px-3 py-3 text-sm font-semibold no-underline transition-colors {link.match && path === link.match
								? 'bg-[var(--mk-soft)] text-[var(--mk-text)]'
								: 'text-[var(--mk-text-2)] hover:bg-[var(--mk-soft)] hover:text-[var(--mk-text)]'}"
							onclick={closeMenu}
						>
							{link.label}
						</a>
					{/each}
				</nav>
				<div class="mt-auto flex flex-col gap-2 border-t border-[var(--mk-line)] pt-4">
					{#if user}
						<Button href="/dashboard" variant="outline" class="w-full" onclick={closeMenu}>Dashboard</Button>
					{:else}
						<Button href="/?auth=login" variant="outline" class="w-full" onclick={closeMenu}>Sign in</Button>
					{/if}
					<Button href={ctaHref} class="w-full" onclick={closeMenu}>{ctaLabel}</Button>
				</div>
			</Sheet.Content>
		</Sheet.Root>

		{#if user}
			<Button href="/dashboard" variant="ghost" size="sm" class="hidden sm:inline-flex">Dashboard</Button>
		{:else}
			<Button href="/?auth=login" variant="ghost" size="sm" class="hidden sm:inline-flex">Sign in</Button>
		{/if}
		<Button href={ctaHref} size="sm" class="px-3 sm:px-5">
			<span class="sm:hidden">Start</span>
			<span class="hidden sm:inline">{ctaLabel}</span>
		</Button>
	</div>
</nav>
