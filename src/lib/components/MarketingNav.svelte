<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { ctaHref = '/?auth=signup', ctaLabel = 'Get Meme Accounts' }: { ctaHref?: string; ctaLabel?: string } =
		$props();

	const user = $derived($page.data.user);
	const path = $derived($page.url.pathname);
	let scrolled = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 24;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<nav class="nav" class:scrolled>
	<a href="/" class="brand">
		<img
			src="/logo/meme-accounts-logo.webp"
			alt="Meme Accounts"
			class="brand-logo"
			width="180"
			height="28"
		/>
	</a>
	<div class="nav-links">
		<a href="/#features">Features</a>
		<a href="/#how">How it works</a>
		<a href="/pricing" aria-current={path === '/pricing' ? 'page' : undefined}>Pricing</a>
	</div>
	<div class="nav-actions">
		{#if user}
			<a href="/dashboard" class="btn btn-ghost">Dashboard</a>
		{:else}
			<a href="/?auth=login" class="btn btn-ghost">Sign in</a>
		{/if}
		<a href={ctaHref} class="btn btn-dark">{ctaLabel}</a>
	</div>
</nav>

<style>
	.nav {
		position: sticky;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 20px 32px;
		transition:
			background 0.35s ease,
			backdrop-filter 0.35s ease,
			border-color 0.35s ease,
			padding 0.35s ease;
		border-bottom: 1px solid transparent;
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		color: #0f0f10;
	}
	.nav.scrolled {
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: saturate(180%) blur(18px);
		-webkit-backdrop-filter: saturate(180%) blur(18px);
		border-bottom-color: rgba(15, 15, 16, 0.08);
		padding: 14px 32px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: inherit;
		flex-shrink: 0;
	}
	.brand-logo {
		display: block;
		height: 28px;
		width: auto;
		max-width: min(200px, 52vw);
		object-fit: contain;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 28px;
	}
	.nav-links a {
		font-size: 14px;
		font-weight: 600;
		color: #5b5b62;
		text-decoration: none;
	}
	.nav-links a:hover,
	.nav-links a[aria-current='page'] {
		color: #0f0f10;
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 22px;
		border-radius: 999px;
		font-family: inherit;
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
		border: 1px solid transparent;
		transition:
			transform 0.25s ease,
			background 0.25s ease,
			border-color 0.25s ease,
			color 0.25s ease;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-ghost {
		color: #0f0f10;
		background: transparent;
		border-color: rgba(15, 15, 16, 0.14);
	}
	.btn-ghost:hover {
		background: rgba(0, 0, 0, 0.04);
	}
	.btn-dark {
		color: #0a0a0a;
		background: #7bf1a8;
		border-color: #7bf1a8;
	}
	.btn-dark:hover {
		transform: translateY(-1px);
	}

	@media (max-width: 860px) {
		.nav-links {
			display: none;
		}
		.nav {
			padding: 16px 20px;
		}
		.nav.scrolled {
			padding: 12px 20px;
		}
	}
</style>
