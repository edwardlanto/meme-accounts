<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Newspaper, Sparkles, Video, Image } from 'lucide-svelte';
	import MarketingNav from '$lib/components/MarketingNav.svelte';
	import MarketingFooter from '$lib/components/MarketingFooter.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		SectionHeader,
		PhoneMarquee,
		FeatureTile,
		BentoMediaCard,
		StepCard,
		ProofCard,
		PricingSection,
	} from '$lib/components/marketing';
	import { initReveal } from '$lib/marketing/reveal';
	import type { HomeMarqueeSlide } from '$lib/marketing/home-marquee-slides';

	let { data } = $props();
	const homeMarqueeSlides: HomeMarqueeSlide[] = $derived(data.marqueeSlides ?? []);

	let counted = $state(false);

	const stats = [
		{ value: 10, suffix: 'x', label: 'faster than building posts by hand in Canva' },
		{ value: 20, suffix: '+', label: 'templates you can spin up and test in minutes' },
		{ value: 3, suffix: 'x', label: 'more concepts you can try before picking a winner' },
	];

	const studioFeatures = [
		{
			title: 'Build a brand behind your brand',
			desc: 'Run a niche or faceless account that funnels attention back to what you actually sell.',
			icon: Sparkles,
		},
		{
			title: 'Turn news into posts',
			desc: 'Pull a recent story and build a post in minutes, including local news brands for any city.',
			icon: Newspaper,
		},
		{
			title: 'Faceless reels',
			desc: 'Build video posts for TikTok, Instagram, and Facebook without ever showing your face.',
			icon: Video,
		},
		{
			title: '10M+ stock assets',
			desc: 'Built-in library of photos and videos so you are never stuck hunting for the right background.',
			icon: Image,
		},
	];

	const workflowSteps = [
		{
			badge: '30+ NICHES',
			num: '1',
			title: 'Pick a niche',
			desc: 'Choose a proven niche (local news, fitness, finance, memes) that prints on the algorithm.',
		},
		{
			badge: '20+ TEMPLATES',
			num: '2',
			title: 'Pick your template',
			desc: 'Viral hooks, news frames, tweet carousels, or faceless reels, all sized for the feed.',
		},
		{
			badge: 'AI-DRAFTED',
			num: '3',
			title: 'AI writes the slides',
			desc: 'Hook, beats, and punchline: a full carousel written from your topic or a news URL.',
		},
		{
			badge: 'EXPORT READY',
			num: '4',
			title: 'Generate & export',
			desc: 'Polish in Studio, export PNG or MP4, and post to TikTok, Instagram, or Facebook.',
		},
	];

	const proofPosts = [
		{
			title: 'Breaking headline → full news carousel in one pass',
			format: 'News Studio',
			platform: 'Instagram',
			image: '/placeholders/home/feat-news-studio.png',
		},
		{
			title: 'Faceless reel with captions, no camera required',
			format: 'Video Story',
			platform: 'TikTok',
			image: '/placeholders/home/feat-viral-hooks.png',
		},
		{
			title: 'Build a local news brand for your city',
			format: 'News → Post',
			platform: 'Facebook',
			image: '/placeholders/carousel/tweet-cover.png',
		},
		{
			title: 'One topic → a week of posts from bulk studio',
			format: 'Bulk export',
			platform: 'Multi-platform',
			image: '/placeholders/home/feat-carousels.png',
		},
	];

	const faqs = [
		{
			q: 'What is Meme Accounts?',
			a: 'Meme Accounts is a template studio for people who run Instagram meme and niche pages. Pick a layout, build posts fast in bulk or in the studio, then share concepts to see what potential customers react to.',
		},
		{
			q: 'Can I create posts in bulk?',
			a: 'Yes. Bulk tools let you spin up many meme posts at once, then refine the ones that feel strongest in the studio.',
		},
		{
			q: 'Do I need design skills?',
			a: 'No. Templates handle layout, type, and composition. You bring the joke or niche angle; the studio handles the polish.',
		},
		{
			q: 'What formats can I build for?',
			a: 'Layouts are sized for Instagram and translate cleanly to TikTok, X, LinkedIn, Facebook, and similar feeds.',
		},
		{
			q: 'Is there a free plan?',
			a: 'Yes. You can start free with no credit card. Upgrade when you need more volume, and cancel anytime.',
		},
	];

	const metaDescription =
		'Meme Accounts puts meme pages on autopilot: turn news into posts, build faceless reels, and test ideas before you launch.';

	const jsonLd = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': 'https://memeaccounts.com/#organization',
				name: 'Meme Accounts',
				url: 'https://memeaccounts.com/',
			},
			{
				'@type': 'WebSite',
				'@id': 'https://memeaccounts.com/#website',
				url: 'https://memeaccounts.com/',
				name: 'Meme Accounts',
				publisher: { '@id': 'https://memeaccounts.com/#organization' },
			},
			{
				'@type': 'SoftwareApplication',
				name: 'Meme Accounts',
				applicationCategory: 'BusinessApplication',
				operatingSystem: 'Web',
				url: 'https://memeaccounts.com/',
				description: metaDescription,
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
				publisher: { '@id': 'https://memeaccounts.com/#organization' },
			},
			{
				'@type': 'FAQPage',
				mainEntity: faqs.map((item) => ({
					'@type': 'Question',
					name: item.q,
					acceptedAnswer: { '@type': 'Answer', text: item.a },
				})),
			},
		],
	};

	onMount(() => {
		const cleanupReveal = initReveal();

		const statEls = Array.from(document.querySelectorAll<HTMLElement>('.mk-stat-num'));
		const statIo = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting && !counted) {
						counted = true;
						for (const el of statEls) {
							const target = Number(el.dataset.target || '0');
							const start = performance.now();
							const dur = 1100;
							const step = (t: number) => {
								const p = Math.min(1, (t - start) / dur);
								const eased = 1 - Math.pow(1 - p, 3);
								el.textContent = Math.round(eased * target).toString();
								if (p < 1) requestAnimationFrame(step);
								else el.textContent = target.toString();
							};
							requestAnimationFrame(step);
						}
						statIo.disconnect();
					}
				}
			},
			{ threshold: 0.4 },
		);
		const statsBar = document.querySelector('.mk-stats');
		if (statsBar) statIo.observe(statsBar);

		return () => {
			cleanupReveal();
			statIo.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Meme Accounts | Meme Pages on Autopilot</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href="https://memeaccounts.com/" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://memeaccounts.com/" />
	<meta property="og:title" content="Meme Accounts | Meme Pages on Autopilot" />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:site_name" content="Meme Accounts" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Meme Accounts | Meme Pages on Autopilot" />
	<meta name="twitter:description" content={metaDescription} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<div class="marketing-page">
	<a href="#studio" class="mk-announce">
		<span class="mk-announce-badge">New</span>
		<span>Bulk studio now generates a full week of posts in one pass</span>
		<ArrowRight size={13} />
	</a>

	<MarketingNav />

	<!-- Hero -->
	<section class="mk-hero">
		<div class="marketing-container">
			<h1 class="mk-hero-title">
				Meme pages on <em class="mk-hero-accent">autopilot</em>.
			</h1>
			<p class="mk-hero-sub">
				A studio for creators who move at the speed of the feed. Turn news into posts, build faceless reels,
				and validate ideas before you launch, without living in Canva.
			</p>
			<div class="mk-hero-ctas">
				<Button href="/?auth=signup" size="marketing-lg">
					Create my first post
					<ArrowRight size={16} />
				</Button>
				<Button href="#studio" variant="outline" size="marketing-lg">
					See the studio
				</Button>
			</div>
			<div class="mk-hero-trust">
				<span>Start free</span>
				<span>·</span>
				<span>No credit card</span>
				<span>·</span>
				<span>Cancel anytime</span>
			</div>
		</div>

		<PhoneMarquee slides={homeMarqueeSlides} />
	</section>

	<!-- §01 Stats -->
	<section class="mk-stats" aria-label="Key metrics">
		<div class="mk-stats-grid">
			{#each stats as s, i}
				<div class="mk-reveal" style="--mk-delay:{i * 0.08}s">
					<p class="mk-stat-value">
						<span class="mk-stat-num" data-target={s.value}>0</span>{s.suffix}
					</p>
					<p class="mk-stat-label">{s.label}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- §02 Studio bento -->
	<section id="studio" class="marketing-section marketing-section--soft">
		<div class="marketing-container">
			<SectionHeader
				index="02"
				label="The studio"
				title="Every part of the post,<br />on one canvas."
				description="News, templates, captions, stock media. All composable. All editable. No Canva rabbit holes required."
			/>

			<div class="mk-studio-layout">
				<div class="mk-bento-studio">
					<BentoMediaCard
						tag="News Studio"
						title="Any story, any city, from any headline."
						description="Drop in a news URL or topic. Our AI builds a full carousel with hooks, highlights, and brand chrome ready to export."
						image="/placeholders/home/feat-news-studio.png"
						href="/dashboard/studio?template=news"
						ctaLabel="Explore news studio"
					/>

					{#each studioFeatures as feat, i}
						<FeatureTile title={feat.title} description={feat.desc} delay={`${i * 0.05}s`}>
							{#snippet icon()}
								<feat.icon size={20} />
							{/snippet}
						</FeatureTile>
					{/each}
				</div>

				<div class="mk-steps">
					<StepCard
						num="01"
						title="Pick your template"
						description="Choose a meme-ready layout: viral hooks, news frames, tweet graphics, or faceless reels."
					/>
					<StepCard
						num="02"
						title="Customize in Studio"
						description="Swap copy, tweak type, apply your brand kit, and polish until the concept feels right."
						delay="0.08s"
					/>
					<StepCard
						num="03"
						title="Export & test"
						description="Download PNG or MP4, share drafts, and see what potential customers actually react to."
						delay="0.16s"
					/>
				</div>
			</div>
		</div>
	</section>

	<!-- §02.5 Workflow -->
	<section id="workflow" class="marketing-section">
		<div class="marketing-container">
			<SectionHeader
				index="02.5"
				label="Workflow"
				title="Workflows to go viral."
				description="From niche to exported post in four steps. Build an audience before launching a product."
			/>

			<div class="mk-workflow">
				{#each workflowSteps as step, i}
					<div class="mk-workflow-step mk-reveal" style="--mk-delay:{i * 0.08}s">
						<span class="mk-workflow-badge">{step.badge}</span>
						<div class="mk-workflow-num">{step.num}</div>
						<h3 class="mk-feature-title">{step.title}</h3>
						<p class="mk-feature-desc">{step.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- §03 Proof (dark) -->
	<section id="proof" class="marketing-section marketing-section--dark">
		<div class="marketing-container">
			<SectionHeader
				index="03"
				label="Proof"
				title="Evidence,<br />not inventory."
				description="Shippable formats you can build today: news carousels, faceless reels, local brands, and bulk runs. Not a template graveyard."
			/>

			<div class="mk-bento-proof">
				<ProofCard
					title={proofPosts[0].title}
					format={proofPosts[0].format}
					platform={proofPosts[0].platform}
					image={proofPosts[0].image}
					class="mk-bento-proof-wide-left"
				/>
				<ProofCard
					title={proofPosts[1].title}
					format={proofPosts[1].format}
					platform={proofPosts[1].platform}
					image={proofPosts[1].image}
					delay="0.08s"
				/>
				<ProofCard
					title={proofPosts[2].title}
					format={proofPosts[2].format}
					platform={proofPosts[2].platform}
					image={proofPosts[2].image}
					delay="0.12s"
				/>
				<ProofCard
					title={proofPosts[3].title}
					format={proofPosts[3].format}
					platform={proofPosts[3].platform}
					image={proofPosts[3].image}
					class="mk-bento-proof-wide-right"
					delay="0.16s"
				/>
			</div>
		</div>
	</section>

	<!-- §04 Pricing -->
	<section id="pricing" class="marketing-section">
		<div class="marketing-container">
			<SectionHeader
				index="04"
				label="Plans"
				title="Pick a plan.<br />Ship more posts."
				description="Start free. Upgrade when unlimited carousels, news-to-post, and faceless reels earn their keep."
			/>
			<PricingSection />
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" class="marketing-section marketing-section--soft">
		<div class="marketing-container">
			<SectionHeader
				index=""
				label="FAQ"
				title="Questions,<br />answered."
				description="Straight answers for creators running meme and niche pages."
				stacked
			/>
			<div class="mk-faq-list">
				{#each faqs as item, i}
					<details class="mk-faq-item mk-reveal" style="--mk-delay:{i * 0.04}s">
						<summary>{item.q}</summary>
						<p class="mk-faq-answer">{item.a}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<!-- §06 Final CTA -->
	<section class="mk-final-cta">
		<div class="marketing-container">
			<h2>Validate before you launch.</h2>
			<p>Start free, every month, forever. Your first concept ships before you finish your coffee.</p>
			<div class="mk-hero-ctas">
				<Button href="/?auth=signup" size="marketing-lg">
					Open the studio
					<ArrowRight size={16} />
				</Button>
				<Button href="#pricing" variant="outline" size="marketing-lg">
					See plans
				</Button>
			</div>
		</div>
	</section>

	<MarketingFooter />
</div>
