<script lang="ts">
	import SeoLandingShell from '$lib/components/marketing/SeoLandingShell.svelte';

	let { data } = $props();
	const signedIn = $derived(Boolean(data.user));
	const studioHref = $derived(
		signedIn ? '/dashboard/grid' : `/?auth=signup&next=${encodeURIComponent('/dashboard/grid')}`,
	);
</script>

<svelte:head>
	<title>Instagram Grid Maker: Free Feed Grid Planner | Meme Accounts</title>
	<meta name="description" content="Plan an Instagram feed grid. Design square and 4:5 posts, line up a profile layout, export PNGs, and schedule." />
	<link rel="canonical" href="https://memeaccounts.com/instagram-grid-maker" />
</svelte:head>

<SeoLandingShell
	eyebrow="Grid Maker"
	title="Instagram grid maker for"
	accent="feed aesthetics"
	lead="Plan a cohesive feed, design square and Feed posts, and export a profile grid that reads as one layout. Same studio as <a href='/instagram-carousel-maker'>Instagram carousels</a>."
	ctaHref={studioHref}
	ctaLabel={signedIn ? 'Open grid maker' : 'Try free, sign up'}
	image="/images/seo/carousel-maker-studio.png"
	imageAlt="Meme Accounts grid planner preview"
	featuresTitle="Built for feed planners"
	features={[
		{ title: '3×3 profile mosaic', body: 'Design each tile at Instagram size and see how the full grid reads together.' },
		{ title: 'Square & Feed sizes', body: 'Switch between 1:1 and 4:5 without rebuilding every post from scratch.' },
		{ title: 'Templates + AI art', body: 'Start from proven layouts and swap backgrounds without leaving the canvas.' },
		{ title: 'Export & schedule', body: 'Download PNGs or send tiles to the post scheduler after connecting Instagram.' },
	]}
	faqs={[
		['Is this free?', 'Yes to try. Sign in and get one trial export. Pro unlocks unlimited exports and AI.'],
		['Is this a 3x3 planner?', 'You design each post in Studio at Instagram size, then arrange the live grid when you publish.'],
		['Carousel vs grid?', 'A carousel is one multi-slide post. Grid maker plans the mosaic your whole profile makes.'],
	]}
/>
