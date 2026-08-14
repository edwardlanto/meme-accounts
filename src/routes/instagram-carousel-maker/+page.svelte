<script lang="ts">
	import SeoLandingShell from '$lib/components/marketing/SeoLandingShell.svelte';

	let { data } = $props();
	const signedIn = $derived(Boolean(data.user));
	const studioHref = $derived(
		signedIn ? '/dashboard/studio?template=news' : `/?auth=signup&next=${encodeURIComponent('/dashboard/studio?template=news')}`,
	);

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Meme Accounts: Instagram Carousel Maker',
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Web',
		description: 'Free Instagram carousel maker. Build multi-slide Feed posts from news, templates, and AI.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	};

	const faqItems: [string, string][] = [
		['Is this free?', 'Yes to try. Sign in and get one trial export. Pro unlocks unlimited carousels and AI.'],
		['Can I schedule to Instagram?', 'Yes. Export or send decks to the post scheduler after connecting Instagram.'],
		['Does it work for LinkedIn carousels?', 'Yes, use the LinkedIn Carousel maker for document posts.'],
		['How is this different from Canva?', 'Built for news and meme-page speed: fetch, deck, export. Not a general design suite.'],
	];
</script>

<svelte:head>
	<title>Instagram Carousel Maker: Free Multi-Slide Post Generator | Meme Accounts</title>
	<meta name="description" content="Make Instagram carousels fast. News-to-post, Hook to slides to Follow decks, Feed 4:5 / Reels 9:16, AI backgrounds." />
	<link rel="canonical" href="https://memeaccounts.com/instagram-carousel-maker" />
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<SeoLandingShell
	eyebrow="Carousel Maker"
	title="Instagram carousel maker for"
	accent="Feed & Reels"
	lead="Build Hook → slides → Follow decks in minutes. Pull news, swap templates, pick Feed 4:5 or Vertical 9:16, then export or schedule. Pair with an <a href='/instagram-grid-maker'>Instagram grid</a>, <a href='/linkedin-carousel-maker'>LinkedIn carousel</a>, or <a href='/fake-tweet-maker'>tweet graphic</a>."
	ctaHref={studioHref}
	ctaLabel={signedIn ? 'Open carousel studio' : 'Try free, sign up'}
	image="/images/seo/carousel-maker-studio.png"
	imageAlt="Meme Accounts editor with News template and multi-slide filmstrip"
	featuresTitle="Built for carousel pages"
	features={[
		{ title: 'News → carousel', body: 'Fetch a story, auto-fill Hook + body slides, pull a matching image.' },
		{ title: 'Feed, Reels, Square', body: 'Switch FEED 4:5, VERTICAL 9:16, WIDE, or SQUARE without rebuilding.' },
		{ title: 'Hook · Slides · Follow', body: 'Filmstrip for every panel: reorder, duplicate, and add a branded Follow slide.' },
		{ title: 'AI backgrounds', body: 'Generate or swap slide art from the dock without leaving the canvas.' },
	]}
	faqs={faqItems}
/>
