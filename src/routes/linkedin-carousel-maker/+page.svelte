<script lang="ts">
	import SeoLandingShell from '$lib/components/marketing/SeoLandingShell.svelte';

	let { data } = $props();
	const signedIn = $derived(Boolean(data.user));
	const studioHref = $derived(
		signedIn ? '/dashboard/studio?template=news' : `/?auth=signup&next=${encodeURIComponent('/dashboard/studio?template=news')}`,
	);
</script>

<svelte:head>
	<title>LinkedIn Carousel Maker: Free Multi-Slide Post Generator | Meme Accounts</title>
	<meta name="description" content="Make LinkedIn carousels fast. Hook to slides to CTA decks, news-to-post, Square and Feed formats." />
	<link rel="canonical" href="https://memeaccounts.com/linkedin-carousel-maker" />
</svelte:head>

<SeoLandingShell
	eyebrow="LinkedIn Carousel Maker"
	title="LinkedIn carousel maker for"
	accent="document posts"
	lead="Build Hook, slides, and CTA decks that get read on LinkedIn. Pull news, swap templates, pick Square or Feed sizes, then export PNGs. Same studio as <a href='/instagram-carousel-maker'>Instagram carousels</a>."
	ctaHref={studioHref}
	ctaLabel={signedIn ? 'Open carousel studio' : 'Try free, sign up'}
	image="/images/seo/carousel-maker-studio.png"
	imageAlt="Meme Accounts LinkedIn carousel editor"
	featuresTitle="Built for LinkedIn decks"
	features={[
		{ title: 'News → deck', body: 'Fetch a story and auto-fill Hook + body slides with matching imagery.' },
		{ title: 'Square & Feed', body: 'Switch 1:1 and 4:5 formats without rebuilding the deck.' },
		{ title: 'Hook · Slides · CTA', body: 'Filmstrip for every panel: reorder, duplicate, and add a branded CTA slide.' },
		{ title: 'Export PNG', body: 'Download document-ready slides for LinkedIn carousel posts.' },
	]}
	faqs={[
		['Is this free?', 'Yes to try. Sign in and get one trial export. Pro unlocks unlimited carousels and AI.'],
		['Can I post directly to LinkedIn?', 'Export PNGs for a document carousel, or schedule after connecting LinkedIn.'],
		['What size works best?', 'Square 1:1 and Feed 4:5 both work for LinkedIn document posts.'],
	]}
/>
