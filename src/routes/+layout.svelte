<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import { openAuthModal } from '$lib/auth-modal';

	let { children } = $props();

	function syncAuthFromUrl(url: URL) {
		const auth = url.searchParams.get('auth');
		const next = url.searchParams.get('next');
		const err = url.searchParams.get('error');
		if (auth === 'login' || auth === 'signup') {
			openAuthModal(auth, next, { bannerError: err ?? '' });
			const cleaned = new URL(url);
			cleaned.searchParams.delete('auth');
			cleaned.searchParams.delete('next');
			cleaned.searchParams.delete('error');
			const qs = cleaned.searchParams.toString();
			history.replaceState({}, '', cleaned.pathname + (qs ? `?${qs}` : '') + cleaned.hash);
			return;
		}
		if (err) {
			openAuthModal('login', next ?? '/dashboard', { bannerError: err });
			const cleaned = new URL(url);
			cleaned.searchParams.delete('error');
			const qs = cleaned.searchParams.toString();
			history.replaceState({}, '', cleaned.pathname + (qs ? `?${qs}` : '') + cleaned.hash);
		}
	}

	onMount(() => {
		syncAuthFromUrl(new URL(window.location.href));
	});

	afterNavigate((nav) => {
		if (typeof window.gtag !== 'function' || !nav.to) return;
		const url = nav.to.url;
		window.gtag('event', 'page_view', {
			page_title: document.title,
			page_location: url.href,
			page_path: url.pathname + url.search,
		});
	});

	$effect(() => {
		// React to client navigations that land with ?auth=
		const url = $page.url;
		if (typeof window === 'undefined') return;
		if (url.searchParams.has('auth') || url.searchParams.has('error')) {
			syncAuthFromUrl(new URL(url.href));
		}
	});
</script>

<svelte:head>
	<title>Meme Accounts | Create &amp; Schedule Meme Posts Fast</title>
	<link rel="icon" href="/logo/meme-accounts-logo.webp" type="image/webp" />
</svelte:head>

{@render children()}
<AuthModal />
