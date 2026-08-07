<script lang="ts">
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let scrollY = $state(0);
	let counted = $state(false);

	/** Phone marquee — product screen shots scrolling through the hero. */
	const phoneScreens = [
		{ src: '/placeholders/marquee/slide-1.png', tint: '#FFB4A2', tag: 'Carousel' },
		{ src: '/placeholders/marquee/slide-2.png', tint: '#B5E48C', tag: 'Reel' },
		{ src: '/placeholders/marquee/slide-3.png', tint: '#A0C4FF', tag: 'Story' },
		{ src: '/placeholders/marquee/slide-4.png', tint: '#FFC8DD', tag: 'Post' },
		{ src: '/placeholders/marquee/slide-5.png', tint: '#FFD6A5', tag: 'Schedule' },
	];

	/** Platforms formats are built for — shown as a trust/connector strip. */
	const platforms = [
		{ label: 'Instagram', abbr: 'IG', bg: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)' },
		{ label: 'TikTok', abbr: 'TT', bg: 'linear-gradient(135deg,#25f4ee,#0f0f10 55%,#fe2c55)' },
		{ label: 'X', abbr: 'X', bg: '#0f0f10' },
		{ label: 'LinkedIn', abbr: 'in', bg: '#0A66C2' },
		{ label: 'YouTube', abbr: '▶', bg: '#FF0000' },
		{ label: 'Facebook', abbr: 'f', bg: '#1877F2' },
		{ label: 'Pinterest', abbr: 'P', bg: '#E60023' },
		{ label: 'Threads', abbr: '@', bg: '#0f0f10' },
	];

	const stats = [
		{ value: 10, suffix: 'x', label: 'faster than building posts by hand in Canva' },
		{ value: 20, suffix: '+', label: 'templates you can spin up and test in minutes' },
		{ value: 3, suffix: 'x', label: 'more concepts you can try before picking a winner' },
	];

	const featured = [
		{ title: 'Viral Hooks', creator: 'Maya Carter', initials: 'MC',
		  bg: '#7B2D26', img: '/placeholders/home/feat-viral-hooks.png',
		  alt: '3D art of a phone with floating speech bubbles for viral hook templates' },
		{ title: 'Carousels', creator: 'Avery James', initials: 'AJ',
		  bg: '#D67862', img: '/placeholders/home/feat-carousels.png',
		  alt: '3D art of stacked carousel slide cards' },
		{ title: 'News Studio', creator: 'Sienna Cole', initials: 'SC',
		  bg: '#3D6B8C', img: '/placeholders/home/feat-news-studio.png',
		  alt: '3D art of a news-style frame for meme posts' },
		{ title: 'Slide Composer', creator: 'Devin Park', initials: 'DP',
		  bg: '#A6B4C4', img: '/placeholders/home/feat-slide-composer.png',
		  alt: '3D art of a creative studio desk assembling slides' },
	];

	const benefits = [
		{
			title: 'Bulk create',
			desc: 'Spin up dozens of meme posts in one session — captions, slides, and formats ready to preview.',
			icon: 'grid',
		},
		{
			title: 'Viral templates',
			desc: 'Start from proven carousel, news, quote, and hook layouts built for meme and niche pages.',
			icon: 'spark',
		},
		{
			title: 'Test reactions',
			desc: 'Ship concepts fast, share them with potential customers, and see what actually lands.',
			icon: 'clock',
		},
		{
			title: 'Studio polish',
			desc: 'Tweak type, crops, and branding in one studio so every post looks intentional — not copy-pasted.',
			icon: 'wand',
		},
	];

	const testimonials = [
		{
			quote: 'I went from posting twice a week to testing a full week of ideas in one sitting. The bulk studio does what used to eat my whole Sunday.',
			name: 'Maya Carter',
			role: 'Runs a 240K-follower meme page',
			initials: 'MC',
			bg: '#7B2D26',
		},
		{
			quote: 'Templates that already look like the top posts in my niche — I just swap the joke and see which version people react to.',
			name: 'Avery James',
			role: 'Instagram carousel creator',
			initials: 'AJ',
			bg: '#D67862',
		},
		{
			quote: 'I use it to mock up formats before I commit. Potential customers react in hours instead of me guessing in Canva all week.',
			name: 'Sienna Cole',
			role: 'News-style meme account',
			initials: 'SC',
			bg: '#3D6B8C',
		},
	];

	const faqs = [
		{
			q: 'What is Meme Accounts?',
			a: 'Meme Accounts is a template studio for people who run Instagram meme and niche pages. Pick a layout, build posts fast in bulk or in the studio, then share concepts to see what potential customers react to.',
		},
		{
			q: 'Is this a scheduling tool?',
			a: 'No. Meme Accounts is built for creating and testing templates quickly — not for queueing or auto-posting. You build the look, export or share drafts, and decide what to publish yourself.',
		},
		{
			q: 'Do I need design skills?',
			a: 'No. Templates handle layout, type, and composition. You bring the joke or niche angle; the studio handles the polish.',
		},
		{
			q: 'Can I create posts in bulk?',
			a: 'Yes. Bulk tools let you spin up many meme posts at once, then refine the ones that feel strongest in the studio.',
		},
		{
			q: 'What formats can I build for?',
			a: 'Layouts are sized for Instagram and translate cleanly to TikTok, X, LinkedIn, Facebook, and similar feeds — so you can test one concept across the places your audience already hangs out.',
		},
		{
			q: 'Is there a free plan?',
			a: 'Yes. You can start free with no credit card. Upgrade when you need more volume or seats — cancel anytime.',
		},
		{
			q: 'What templates can I use?',
			a: 'Use viral hooks, carousels, news-style frames, quote slides, and more. Templates are built for meme page formats that already perform on Instagram.',
		},
	];

	const metaDescription =
		'Build viral meme templates fast — carousels, hooks, news frames, and more. Test concepts with potential customers and see what reacts. Built for meme page creators.';

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
				offers: {
					'@type': 'Offer',
					price: '0',
					priceCurrency: 'USD',
				},
				publisher: { '@id': 'https://memeaccounts.com/#organization' },
			},
			{
				'@type': 'FAQPage',
				mainEntity: faqs.map((item) => ({
					'@type': 'Question',
					name: item.q,
					acceptedAnswer: {
						'@type': 'Answer',
						text: item.a,
					},
				})),
			},
		],
	};

	onMount(() => {
		mounted = true;
		const onScroll = () => { scrollY = window.scrollY; };
		window.addEventListener('scroll', onScroll, { passive: true });

		const io = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) {
					(e.target as HTMLElement).classList.add('in');
					io.unobserve(e.target);
				}
			});
		}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

		const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
		revealEls.forEach((el) => io.observe(el));

		// Above-the-fold fallback — show anything already in view immediately.
		requestAnimationFrame(() => {
			for (const el of revealEls) {
				const r = el.getBoundingClientRect();
				if (r.top < window.innerHeight * 0.95 && r.bottom > 0) {
					el.classList.add('in');
					io.unobserve(el);
				}
			}
		});

		// Stat counters — animate once the stats bar scrolls into view.
		const statEls = Array.from(document.querySelectorAll<HTMLElement>('.stat-num'));
		const statIo = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting && !counted) {
					counted = true;
					statEls.forEach((el) => {
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
					});
					statIo.disconnect();
				}
			});
		}, { threshold: 0.4 });
		const statsBar = document.querySelector('.stats-bar');
		if (statsBar) statIo.observe(statsBar);

		return () => {
			window.removeEventListener('scroll', onScroll);
			io.disconnect();
			statIo.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Meme Accounts — Build Meme Templates Fast</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href="https://memeaccounts.com/" />

	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://memeaccounts.com/" />
	<meta property="og:title" content="Meme Accounts — Build Meme Templates Fast" />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:site_name" content="Meme Accounts" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Meme Accounts — Build Meme Templates Fast" />
	<meta name="twitter:description" content={metaDescription} />

	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<div class="page" class:mounted>
	<!-- ANNOUNCEMENT BAR -->
	<a href="#features" class="announce">
		<span class="announce-badge">New</span>
		<span>Bulk studio now generates a full week of posts in one pass</span>
		<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
	</a>

	<!-- NAV -->
	<nav class="nav" class:scrolled={scrollY > 24}>
		<a href="/" class="brand">
			<img
				src="/logo/meme-accounts-logo.webp"
				alt="Meme Accounts"
				class="brand-logo"
				width="180"
				height="28"
			/>
		</a>
		<div class="nav-actions">
			<a href="/pricing" class="btn btn-ghost">Pricing</a>
			<a href="/fake-tweet-maker" class="btn btn-ghost">Tweet Maker</a>
			<a href="/instagram-carousel-maker" class="btn btn-ghost">Instagram Carousel</a>
			<a href="/instagram-grid-maker" class="btn btn-ghost">Instagram Grid</a>
			<a href="/linkedin-carousel-maker" class="btn btn-ghost">LinkedIn Carousel</a>
			<a href="/?auth=signup" class="btn btn-dark">Get Meme Accounts</a>
		</div>
	</nav>

	<!-- HERO -->
	<section class="hero">
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="hero-inner">
			<div class="hero-app">
				<img
					src="/logo/meme-accounts-logo.webp"
					alt="Meme Accounts"
					class="hero-logo"
					width="280"
					height="44"
				/>
			</div>
			<h1 class="hero-title">Build meme templates fast</h1>
			<p class="hero-sub">Pick a layout, spin up posts in Studio, and test what potential customers react to — without living in Canva for hours.</p>
			<div class="hero-ctas">
				<a href="/?auth=signup" class="btn btn-dark btn-cta">
					Explore Templates
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
						<line x1="5" y1="12" x2="19" y2="12"/>
						<polyline points="12 5 19 12 12 19"/>
					</svg>
				</a>
			</div>

			<!-- Platform strip -->
			<!-- <div class="platform-strip" aria-label="Formats Meme Accounts is built for">
				<span class="platform-strip-label">Built for these feeds</span>
				<div class="platform-icons">
					{#each platforms as p}
						<span class="platform-chip" style="background:{p.bg}" title={p.label} aria-label={p.label}>{p.abbr}</span>
					{/each}
				</div>
			</div> -->
		</div>


		<!-- Phone marquee — two identical tracks for a seamless infinite loop -->
		<div class="phone-stage" aria-hidden="true">
			<div class="phone-stage-glow"></div>
			<div class="phone-marquee">
				{#each [0, 1] as copy (copy)}
					<div class="phone-track">
						{#each phoneScreens as p, i (copy + '-' + i)}
							<div class="phone" style="--tint:{p.tint}">
								<span class="phone-aura"></span>
								<div class="phone-frame">
									<div class="phone-notch"></div>
									<div class="phone-screen">
										<img src={p.src} alt="" draggable="false" />
										<div class="phone-overlay">
											<div class="phone-pill">{p.tag}</div>
										</div>
									</div>
									<div class="phone-bar"></div>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- STATS -->
	<section class="stats-bar">
		<div class="container stats-row">
			{#each stats as s, i}
				<div class="stat reveal" style="--d:{i * 0.08}s">
					<p class="stat-value"><span class="stat-num" data-target={s.value}>0</span>{s.suffix}</p>
					<p class="stat-label">{s.label}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- FEATURED -->
	<section id="features" class="featured">
		<div class="container">
			<div class="section-head reveal">
				<h2 class="featured-h">Featured templates</h2>
				<p class="section-sub">
					Ready-made layouts for meme carousels, viral hooks, news frames, and slide stacks.
				</p>
			</div>
			<div class="featured-grid">
				{#each featured as f, i}
					<a href="/dashboard" class="feat-card reveal" style="background:{f.bg}; --d:{i * 0.08}s">
						<img class="feat-img" src={f.img} alt={f.alt} />
						<span class="feat-badge">Featured</span>
						<div class="feat-info">
							<h3 class="feat-title">{f.title}</h3>
							<p class="feat-by">
								by
								<span class="feat-avatar">{f.initials}</span>
								<span class="feat-creator">{f.creator}</span>
							</p>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS (floating cards) -->
	<section id="how" class="how">
		<div class="how-glow" aria-hidden="true"></div>
		<div class="container">
			<h2 class="how-title reveal">How it works.</h2>

			<div class="how-row">
				<!-- Step 1: pick a template card -->
				<div class="how-col reveal" style="--d:0s">
					<div class="float-card fc-template">
						<div class="fc-thumb" aria-hidden="true">
							<svg viewBox="0 0 40 40" width="22" height="22" fill="none">
								<rect x="6" y="6" width="28" height="28" rx="6" fill="#0f0f10"/>
								<rect x="11" y="11" width="18" height="3" rx="1.5" fill="#7bf1a8"/>
								<rect x="11" y="17" width="14" height="3" rx="1.5" fill="#fff" opacity=".55"/>
								<rect x="11" y="23" width="10" height="3" rx="1.5" fill="#fff" opacity=".25"/>
							</svg>
						</div>
						<div class="fc-text">
							<p class="fc-title">Studio Pack</p>
							<div class="fc-by">
								<span class="fc-dot"></span>
								<span>Maya Carter</span>
							</div>
						</div>
					</div>
					<h3 class="how-step-title">Pick your template</h3>
					<p class="how-step-desc">Choose a meme-ready layout — carousels, hooks, news frames, and more.</p>
				</div>

				<!-- Step 2: customize in studio -->
				<div class="how-col reveal" style="--d:0.08s">
					<div class="float-card fc-account">
						<div class="fc-platform">
							<svg viewBox="0 0 40 40" width="22" height="22" aria-hidden="true">
								<circle cx="20" cy="20" r="20" fill="#0f0f10"/>
								<path d="M14 26 L18 14 L20 22 L26 12 L26 26" stroke="#7bf1a8" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</div>
						<div class="fc-text">
							<p class="fc-title">Studio ready</p>
							<p class="fc-handle">type · crop · brand</p>
						</div>
					</div>
					<h3 class="how-step-title">Customize in Studio</h3>
					<p class="how-step-desc">Swap copy, tweak type, and polish the look until the concept feels right.</p>
				</div>

				<!-- Step 3: test reactions -->
				<div class="how-col reveal" style="--d:0.16s">
					<div class="float-card fc-chips">
						<span class="chip" style="background:#0f0f10">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7bf1a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
						</span>
						<span class="chip" style="background:#3D6B8C">
							<span class="chip-letter">IG</span>
						</span>
						<span class="chip" style="background:#E8B4B8">
							<span class="chip-letter">TT</span>
						</span>
					</div>
					<h3 class="how-step-title">Test the reaction</h3>
					<p class="how-step-desc">Share drafts with potential customers and see which template actually lands.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- BUILT FOR MEME ACCOUNTS -->
	<section id="built-for" class="benefits">
		<div class="container">
			<div class="section-head reveal">
				<h2 class="benefits-h">Everything you need to ship concepts</h2>
				<p class="section-sub">
					Build templates fast, polish in Studio, and learn what people react to — without bouncing between Canva and drafts.
				</p>
			</div>
			<div class="benefits-grid">
				{#each benefits as b, i}
					<div class="benefit-card reveal" style="--d:{i * 0.06}s">
						<span class="benefit-icon" aria-hidden="true">
							{#if b.icon === 'grid'}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
							{:else if b.icon === 'spark'}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z"/></svg>
							{:else if b.icon === 'clock'}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>
							{:else}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4 L20 9 L8 21 L3 21 L3 16 Z"/><line x1="13" y1="6" x2="18" y2="11"/></svg>
							{/if}
						</span>
						<h3 class="benefit-title">{b.title}</h3>
						<p class="benefit-desc">{b.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- TESTIMONIALS -->
	<section id="testimonials" class="testimonials">
		<div class="container">
			<div class="section-head reveal">
				<h2 class="testimonials-h">Creators run their pages on Meme Accounts</h2>
				<p class="section-sub">Real workflows from people who post daily, not just when they find time.</p>
			</div>
			<div class="testi-grid">
				{#each testimonials as t, i}
					<figure class="testi-card reveal" style="--d:{i * 0.08}s">
						<blockquote class="testi-quote">&ldquo;{t.quote}&rdquo;</blockquote>
						<figcaption class="testi-by">
							<span class="testi-avatar" style="background:{t.bg}">{t.initials}</span>
							<span>
								<span class="testi-name">{t.name}</span>
								<span class="testi-role">{t.role}</span>
							</span>
						</figcaption>
					</figure>
				{/each}
			</div>
		</div>
	</section>

	<!-- FAQ -->
	<section id="faq" class="faq">
		<div class="container faq-inner">
			<div class="section-head reveal">
				<h2 class="faq-h">Frequently asked questions</h2>
				<p class="section-sub">
					Straight answers for creators running meme and niche Instagram pages.
				</p>
			</div>
			<div class="faq-list">
				{#each faqs as item, i}
					<details class="faq-item reveal" style="--d:{i * 0.04}s">
						<summary class="faq-q">{item.q}</summary>
						<p class="faq-a">{item.a}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA STRIP -->
	<section class="cta-strip">
		<div class="container cta-row reveal">
			<div class="cta-glow" aria-hidden="true"></div>
			<div>
				<h2 class="cta-h">Ready to test your next template?</h2>
				<p class="cta-p">Free to start. No credit card. Cancel anytime.</p>
			</div>
			<a href="/?auth=signup" class="btn btn-dark btn-lg">Get Meme Accounts</a>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="footer">
		<div class="container footer-grid">
			<div class="footer-brand">
				<a href="/" class="brand">
					<img
						src="/logo/meme-accounts-logo.webp"
						alt="Meme Accounts"
						class="brand-logo"
						width="180"
						height="28"
					/>
				</a>
				<p class="footer-tag">Create. Test. Grow. Built for meme pages.</p>
			</div>

			<div class="footer-col">
				<p class="footer-h">Product</p>
				<a href="/instagram-carousel-maker">Instagram Carousel</a>
				<a href="/instagram-grid-maker">Instagram Grid</a>
				<a href="/linkedin-carousel-maker">LinkedIn Carousel</a>
				<a href="/fake-tweet-maker">Tweet Maker</a>
				<a href="/pricing">Pricing</a>
			</div>

			<div class="footer-col">
				<p class="footer-h">Company</p>
				<a href="/about">About</a>
				<a href="/careers">Careers</a>
				<a href="/contact">Contact</a>
				<a href="#faq">FAQs</a>
			</div>

			<div class="footer-col">
				<p class="footer-h">Legal</p>
				<a href="/privacy">Privacy</a>
				<a href="/terms">Terms</a>
				<a href="/refund-policy">Refund Policy</a>
			</div>
		</div>

		<div class="container footer-bottom">
			<p>© 2026 Meme Accounts. All rights reserved.</p>
			<p class="footer-fine">
				Meme Accounts is a template studio for meme page creators. Brand names belong to their respective owners.
			</p>
		</div>
	</footer>
</div>

<style>
	/* ─── tokens ──────────────────────────────────────────── */
	.page {
		--ap-bg: #ffffff;
		--ap-soft: #f6f7f9;
		--ap-soft-2: #eef1f5;
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-text-3: #9a9aa1;
		--ap-line: rgba(15, 15, 16, 0.08);
		--ap-line-2: rgba(15, 15, 16, 0.14);
		--ap-accent: #7bf1a8;
		--ap-lime: #E8FF48; /* yellow accents on the black announce header */

		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		color: var(--ap-text);
		background: var(--ap-bg);
		min-height: 100vh;
		overflow-x: hidden;
		-webkit-font-smoothing: antialiased;
		letter-spacing: -0.01em;
	}

	.container {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 32px;
	}

	.section-head {
		margin-bottom: 36px;
	}
	.section-sub {
		font-size: 16px;
		line-height: 1.55;
		color: var(--ap-text-2);
		margin: 10px 0 0;
		max-width: 560px;
	}

	/* ─── reveal animation ────────────────────────────────── */
	.reveal {
		opacity: 1;
		transform: none;
		transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s),
		            transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
		will-change: opacity, transform;
	}
	.page.mounted .reveal:not(.in) {
		opacity: 0;
		transform: translateY(24px);
	}
	.page.mounted .reveal.in {
		opacity: 1;
		transform: translateY(0);
	}

	/* ─── announcement bar ─────────────────────────────────── */
	.announce {
		position: relative;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 16px;
		background: #0f0f10;
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		text-align: center;
	}
	.announce-badge {
		background: var(--ap-lime);
		color: #0f0f10;
		border-radius: 999px;
		padding: 2px 9px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}
	.announce svg { flex-shrink: 0; opacity: 0.7; }

	/* ─── nav ─────────────────────────────────────────────── */
	.nav {
		position: sticky;
		top: 0; left: 0; right: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 32px;
		transition: background 0.35s ease, backdrop-filter 0.35s ease,
		            border-color 0.35s ease, padding 0.35s ease;
		border-bottom: 1px solid transparent;
	}
	.nav.scrolled {
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: saturate(180%) blur(18px);
		-webkit-backdrop-filter: saturate(180%) blur(18px);
		border-bottom-color: var(--ap-line);
		padding: 14px 32px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: inherit;
	}
	.brand-logo {
		display: block;
		height: 28px;
		width: auto;
		max-width: min(200px, 52vw);
		object-fit: contain;
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	/* ─── buttons ─────────────────────────────────────────── */
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
		transition: transform 0.25s ease, background 0.25s ease,
		            border-color 0.25s ease, color 0.25s ease,
		            box-shadow 0.25s ease;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-ghost {
		color: var(--ap-text);
		background: transparent;
		border-color: var(--ap-line-2);
	}
	.btn-ghost:hover {
		background: rgba(0, 0, 0, 0.04);
	}
	.btn-light-outline {
		color: var(--ap-text);
		background: #fff;
		border-color: var(--ap-line-2);
	}
	.btn-light-outline:hover {
		border-color: var(--ap-text);
		transform: translateY(-1px);
	}
	.btn-dark {
		color: #0a0a0a;
		background: var(--ap-accent);
		border-color: var(--ap-accent);
	}
	.btn-dark:hover {
		background: #a7f7c6;
		border-color: #a7f7c6;
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(123, 241, 168, 0.35);
	}
	.btn-lg {
		padding: 16px 32px;
		font-size: 15px;
	}

	/* ─── hero ────────────────────────────────────────────── */
	.hero {
		position: relative;
		padding: clamp(90px, 12vh, 130px) 24px 60px;
		text-align: center;
		overflow: hidden;
		background: var(--ap-soft);
	}
	.hero-glow {
		position: absolute;
		top: -20%;
		left: 50%;
		width: 1100px;
		height: 620px;
		transform: translateX(-50%);
		background:
			radial-gradient(closest-side, rgba(123, 241, 168, 0.22), transparent 70%),
			radial-gradient(closest-side at 30% 60%, rgba(139, 92, 246, 0.10), transparent 70%),
			radial-gradient(closest-side at 70% 40%, rgba(6, 182, 212, 0.10), transparent 70%);
		filter: blur(10px);
		pointer-events: none;
		z-index: 0;
	}

	.hero-inner {
		position: relative;
		z-index: 1;
		max-width: 880px;
		margin: 0 auto;
	}

	/* Brand wordmark above title */
	.hero-app {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin-bottom: 36px;
	}
	.hero-logo {
		display: block;
		height: 44px;
		width: auto;
		max-width: min(320px, 78vw);
		object-fit: contain;
		opacity: 0;
		animation: hero-fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
	}

	@keyframes hero-fade-up {
		from { opacity: 0; transform: translateY(14px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.hero-title {
		font-family: 'Satoshi', sans-serif;
		font-weight: 900;
		font-size: clamp(40px, 6.6vw, 80px);
		line-height: 0.98;
		letter-spacing: -0.04em;
		margin: 0 0 22px;
		color: var(--ap-text);
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 520ms both;
	}
	.hero-sub {
		font-size: clamp(16px, 1.5vw, 20px);
		line-height: 1.55;
		color: var(--ap-text-2);
		margin: 0 auto 32px;
		max-width: 620px;
		font-weight: 400;
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 660ms both;
	}
	.hero-ctas {
		display: inline-flex;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 800ms both;
	}
	.btn-cta {
		padding: 14px 26px;
		font-size: 15px;
	}
	.btn-cta svg {
		transition: transform 0.25s ease;
	}
	.btn-cta:hover svg {
		transform: translateX(3px);
	}

	/* ─── platform strip ──────────────────────────────────── */
	.platform-strip {
		margin-top: 44px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		opacity: 0;
		animation: hero-fade-up 800ms cubic-bezier(0.16, 1, 0.3, 1) 920ms both;
	}
	.platform-strip-label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ap-text-3);
	}
	.platform-icons {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: center;
	}
	.platform-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		color: #fff;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.01em;
		box-shadow: 0 1px 2px rgba(15, 15, 16, 0.08), 0 6px 14px -8px rgba(15, 15, 16, 0.3);
		transition: transform 0.25s ease;
	}
	.platform-chip:hover { transform: translateY(-3px); }

	/* ─── product preview mockup ───────────────────────────── */
	.preview-stage {
		position: relative;
		z-index: 1;
		max-width: 980px;
		margin: 56px auto 0;
		padding: 0 8px;
	}
	.preview-frame {
		background: #fff;
		border-radius: 20px;
		border: 1px solid var(--ap-line);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.6) inset,
			0 40px 80px -30px rgba(15, 15, 16, 0.28),
			0 14px 30px -14px rgba(15, 15, 16, 0.18);
		overflow: hidden;
	}
	.preview-topbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--ap-line);
		background: #fafafa;
	}
	.preview-dot { width: 10px; height: 10px; border-radius: 50%; }
	.preview-url {
		margin-left: 10px;
		font-size: 12px;
		color: var(--ap-text-3);
		font-weight: 600;
	}
	.preview-body {
		display: grid;
		grid-template-columns: 180px 1fr;
		min-height: 320px;
	}
	.preview-sidebar {
		border-right: 1px solid var(--ap-line);
		padding: 18px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: #fbfbfc;
	}
	.pv-side-item {
		font-size: 13px;
		font-weight: 600;
		color: var(--ap-text-2);
		padding: 9px 12px;
		border-radius: 10px;
	}
	.pv-side-item.pv-active {
		background: #0f0f10;
		color: #fff;
	}
	.preview-canvas {
		padding: 22px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		align-content: start;
	}
	.pv-card {
		aspect-ratio: 4 / 5;
		border-radius: 14px;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: flex-end;
		padding: 10px;
	}
	.pv-tag {
		background: rgba(255, 255, 255, 0.92);
		color: #0f0f10;
		font-size: 10px;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: 999px;
	}
	.pv-queue {
		grid-column: 1 / -1;
		border-top: 1px solid var(--ap-line);
		margin-top: 8px;
		padding-top: 14px;
	}
	.pv-queue-h {
		font-size: 12px;
		font-weight: 700;
		color: var(--ap-text-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 10px;
	}
	.pv-queue-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--ap-text-2);
		padding: 6px 0;
	}
	.pv-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

	/* ─── phone marquee ───────────────────────────────────── */
	.phone-stage {
		--phone-gap: 28px;
		--phone-duration: 42s;
		position: relative;
		margin-top: 64px;
		padding: 36px 0 28px;
		overflow: hidden;
		mask-image: linear-gradient(
			90deg,
			transparent 0%,
			#000 6%,
			#000 94%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			90deg,
			transparent 0%,
			#000 6%,
			#000 94%,
			transparent 100%
		);
	}
	.phone-stage-glow {
		position: absolute;
		left: 50%;
		bottom: 8%;
		width: min(920px, 90%);
		height: 48%;
		transform: translateX(-50%);
		background:
			radial-gradient(ellipse at 50% 80%, rgba(255, 180, 162, 0.22), transparent 58%),
			radial-gradient(ellipse at 28% 70%, rgba(160, 196, 255, 0.18), transparent 55%),
			radial-gradient(ellipse at 72% 70%, rgba(181, 228, 140, 0.16), transparent 55%);
		filter: blur(28px);
		pointer-events: none;
		z-index: 0;
	}
	.phone-marquee {
		position: relative;
		z-index: 1;
		display: flex;
		width: max-content;
		gap: var(--phone-gap);
	}
	.phone-track {
		display: flex;
		flex-shrink: 0;
		align-items: flex-end;
		gap: var(--phone-gap);
		width: max-content;
		animation: phone-scroll var(--phone-duration) linear infinite;
		will-change: transform;
	}
	@keyframes phone-scroll {
		from { transform: translate3d(0, 0, 0); }
		to   { transform: translate3d(calc(-100% - var(--phone-gap)), 0, 0); }
	}
	.phone-stage:hover .phone-track {
		animation-play-state: paused;
	}

	.phone {
		position: relative;
		flex: 0 0 auto;
		transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.phone:nth-child(5n + 1) { transform: translateY(8px); }
	.phone:nth-child(5n + 2) { transform: translateY(-7px); }
	.phone:nth-child(5n + 3) { transform: translateY(11px); }
	.phone:nth-child(5n + 4) { transform: translateY(-5px); }
	.phone:nth-child(5n + 5) { transform: translateY(6px); }
	.phone:hover {
		transform: translateY(-12px) scale(1.025);
		z-index: 2;
	}

	.phone-aura {
		position: absolute;
		left: 50%;
		top: 18%;
		width: 78%;
		height: 72%;
		transform: translateX(-50%);
		border-radius: 50%;
		background: radial-gradient(
			ellipse at center,
			color-mix(in oklab, var(--tint) 55%, transparent) 0%,
			color-mix(in oklab, var(--tint) 18%, transparent) 42%,
			transparent 72%
		);
		filter: blur(22px);
		opacity: 0.9;
		pointer-events: none;
		z-index: 0;
		transition: opacity 0.45s ease, filter 0.45s ease;
	}
	.phone:hover .phone-aura {
		opacity: 1;
		filter: blur(26px);
	}

	.phone-frame {
		position: relative;
		z-index: 1;
		width: 220px;
		height: 460px;
		background: #0f0f10;
		border-radius: 38px;
		padding: 10px;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.16) inset,
			0 0 0 1px rgba(0, 0, 0, 0.22),
			0 28px 56px -22px rgba(15, 15, 16, 0.4),
			0 14px 28px -14px rgba(15, 15, 16, 0.28),
			0 0 36px -6px color-mix(in oklab, var(--tint) 42%, transparent),
			0 18px 48px -18px color-mix(in oklab, var(--tint) 28%, transparent);
		transition: box-shadow 0.45s ease;
	}
	.phone:hover .phone-frame {
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.18) inset,
			0 0 0 1px rgba(0, 0, 0, 0.22),
			0 34px 64px -20px rgba(15, 15, 16, 0.42),
			0 16px 32px -12px rgba(15, 15, 16, 0.3),
			0 0 52px -4px color-mix(in oklab, var(--tint) 58%, transparent),
			0 22px 56px -16px color-mix(in oklab, var(--tint) 38%, transparent);
	}
	.phone-notch {
		position: absolute;
		top: 18px; left: 50%;
		width: 70px; height: 18px;
		background: #0f0f10;
		border-radius: 12px;
		transform: translateX(-50%);
		z-index: 2;
	}
	.phone-screen {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 30px;
		overflow: hidden;
		background: color-mix(in oklab, var(--tint) 35%, #1a1a1c);
	}
	.phone-screen img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.phone-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 18px;
		background: linear-gradient(180deg, transparent 52%, rgba(0, 0, 0, 0.38) 100%);
		pointer-events: none;
	}
	.phone-pill {
		align-self: flex-start;
		padding: 6px 12px;
		background: rgba(255, 255, 255, 0.92);
		color: #111;
		border-radius: 999px;
		font-weight: 700;
		font-size: 11px;
		letter-spacing: 0.02em;
		backdrop-filter: blur(8px);
	}
	.phone-bar {
		position: absolute;
		bottom: 6px; left: 50%;
		width: 110px; height: 4px;
		background: rgba(255, 255, 255, 0.55);
		border-radius: 2px;
		transform: translateX(-50%);
	}

	/* ─── stats bar ───────────────────────────────────────── */
	.stats-bar {
		padding: 56px 24px;
		background: #0f0f10;
		color: #fff;
	}
	.stats-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 32px;
		text-align: center;
	}
	.stat-value {
		font-family: 'Satoshi', sans-serif;
		font-weight: 900;
		font-size: clamp(36px, 4.6vw, 56px);
		letter-spacing: -0.03em;
		margin: 0 0 8px;
		color: var(--ap-lime);
	}
	.stat-label {
		font-size: 14px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.65);
		margin: 0;
		max-width: 260px;
		margin-inline: auto;
	}

	/* ─── featured ────────────────────────────────────────── */
	.featured {
		padding: 100px 24px 40px;
		scroll-margin-top: 88px;
	}
	.featured-h {
		font-weight: 800;
		font-size: clamp(28px, 3vw, 36px);
		letter-spacing: -0.025em;
		margin: 0;
	}
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
	}
	.feat-card {
		position: relative;
		display: block;
		aspect-ratio: 1 / 1;
		border-radius: 22px;
		overflow: hidden;
		text-decoration: none;
		color: #fff;
		isolation: isolate;
		transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
		            box-shadow 0.45s ease;
	}
	.feat-card:hover {
		transform: translateY(-6px);
		box-shadow: 0 24px 50px -20px rgba(15, 15, 16, 0.35);
	}
	.feat-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		mix-blend-mode: overlay;
		opacity: 0.85;
		z-index: -1;
	}
	.feat-card::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 35%, rgba(0, 0, 0, 0.55) 100%);
		pointer-events: none;
	}
	.feat-badge {
		position: absolute;
		top: 16px;
		left: 16px;
		padding: 5px 12px;
		border-radius: 6px;
		background: rgba(15, 15, 16, 0.78);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		backdrop-filter: blur(8px);
		z-index: 2;
	}
	.feat-info {
		position: absolute;
		left: 22px;
		right: 22px;
		bottom: 18px;
		z-index: 2;
	}
	.feat-title {
		font-weight: 800;
		font-size: 22px;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		color: #fff;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
	}
	.feat-by {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.85);
		margin: 0;
	}
	.feat-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.92);
		color: #0f0f10;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}
	.feat-creator { font-weight: 600; }

	/* ─── how it works (floating cards) ───────────────────── */
	.how {
		position: relative;
		padding: 100px 24px 110px;
		background: var(--ap-bg);
		scroll-margin-top: 88px;
		overflow: hidden;
	}
	.how-glow {
		position: absolute;
		top: 10%;
		right: -10%;
		width: 640px;
		height: 640px;
		background: radial-gradient(closest-side, rgba(139, 92, 246, 0.08), transparent 70%);
		pointer-events: none;
	}
	.how-title {
		position: relative;
		z-index: 1;
		font-weight: 900;
		font-size: clamp(36px, 5vw, 64px);
		line-height: 1;
		letter-spacing: -0.035em;
		text-align: center;
		margin: 0 0 80px;
	}
	.how-row {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 40px;
	}
	.how-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.how-col .float-card {
		margin-bottom: 28px;
	}

	.float-card {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px 14px 14px;
		background: #fff;
		border-radius: 18px;
		box-shadow:
			0 1px 0 rgba(15, 15, 16, 0.04) inset,
			0 1px 2px rgba(15, 15, 16, 0.05),
			0 22px 44px -16px rgba(15, 15, 16, 0.18),
			0 8px 16px -8px rgba(15, 15, 16, 0.10);
		transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
		            box-shadow 0.4s ease;
	}
	.how-col:hover .float-card {
		transform: translateY(-4px);
	}

	.fc-thumb,
	.fc-platform {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background:
			conic-gradient(from 220deg, #1c1c1c, #3a3a3a, #1c1c1c);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	}
	.fc-platform { background: #7bf1a8; }

	.fc-text { display: flex; flex-direction: column; gap: 3px; }
	.fc-title {
		font-weight: 800;
		font-size: 15px;
		letter-spacing: -0.01em;
		margin: 0;
		color: var(--ap-text);
	}
	.fc-by {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--ap-text-2);
	}
	.fc-dot {
		width: 14px; height: 14px;
		border-radius: 50%;
		background: linear-gradient(135deg, #E8B4B8, #A6B4C4);
	}
	.fc-handle {
		font-size: 12px;
		color: var(--ap-text-2);
		margin: 0;
	}

	.fc-chips {
		gap: 10px;
		padding: 16px 18px;
	}
	.chip {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.chip-letter {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.how-step-title {
		font-weight: 800;
		font-size: 17px;
		letter-spacing: -0.01em;
		margin: 0 0 10px;
		color: var(--ap-text);
	}
	.how-step-desc {
		font-size: 14px;
		line-height: 1.55;
		color: var(--ap-text-2);
		margin: 0;
		max-width: 280px;
	}

	/* ─── benefits ────────────────────────────────────────── */
	.benefits {
		padding: 40px 24px 100px;
		background: var(--ap-soft);
		scroll-margin-top: 88px;
	}
	.benefits-h {
		font-weight: 900;
		font-size: clamp(30px, 4vw, 46px);
		letter-spacing: -0.035em;
		line-height: 1.08;
		margin: 0;
	}
	.benefits-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
	}
	.benefit-card {
		background: #fff;
		border: 1px solid var(--ap-line);
		border-radius: 20px;
		padding: 26px 22px;
		transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.35s ease;
	}
	.benefit-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 20px 40px -22px rgba(15, 15, 16, 0.25);
		border-color: var(--ap-line-2);
	}
	.benefit-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: linear-gradient(160deg, #0f0f10, #2a2a2a);
		color: var(--ap-lime);
		margin-bottom: 18px;
	}
	.benefit-title {
		font-weight: 800;
		font-size: 17px;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
	}
	.benefit-desc {
		font-size: 14px;
		line-height: 1.55;
		color: var(--ap-text-2);
		margin: 0;
	}

	/* ─── testimonials ────────────────────────────────────── */
	.testimonials {
		padding: 100px 24px;
		scroll-margin-top: 88px;
	}
	.testimonials-h {
		font-weight: 900;
		font-size: clamp(30px, 4vw, 44px);
		letter-spacing: -0.03em;
		line-height: 1.08;
		margin: 0;
	}
	.testi-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}
	.testi-card {
		background: var(--ap-soft);
		border: 1px solid var(--ap-line);
		border-radius: 20px;
		padding: 26px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 22px;
	}
	.testi-quote {
		font-size: 15px;
		line-height: 1.6;
		color: var(--ap-text);
		margin: 0;
		font-weight: 500;
		letter-spacing: -0.01em;
	}
	.testi-by {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
	}
	.testi-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		color: #fff;
		font-weight: 800;
		font-size: 13px;
		flex-shrink: 0;
	}
	.testi-name {
		display: block;
		font-weight: 700;
		color: var(--ap-text);
	}
	.testi-role {
		display: block;
		color: var(--ap-text-3);
		font-size: 12px;
	}

	/* ─── faq ─────────────────────────────────────────────── */
	.faq {
		padding: 100px 24px 40px;
		scroll-margin-top: 88px;
	}
	.faq-inner {
		max-width: 760px;
	}
	.faq-h {
		font-weight: 900;
		font-size: clamp(32px, 4.2vw, 48px);
		letter-spacing: -0.035em;
		line-height: 1.05;
		margin: 0;
	}
	.faq-list {
		border-top: 1px solid var(--ap-line-2);
	}
	.faq-item {
		border-bottom: 1px solid var(--ap-line-2);
		padding: 0;
	}
	.faq-q {
		list-style: none;
		cursor: pointer;
		font-weight: 700;
		font-size: 17px;
		letter-spacing: -0.015em;
		padding: 22px 36px 22px 0;
		position: relative;
		color: var(--ap-text);
	}
	.faq-q::-webkit-details-marker { display: none; }
	.faq-q::after {
		content: '+';
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		font-size: 22px;
		font-weight: 400;
		color: var(--ap-text-3);
		line-height: 1;
	}
	.faq-item[open] .faq-q::after {
		content: '−';
		color: var(--ap-text);
	}
	.faq-a {
		font-size: 15px;
		line-height: 1.6;
		color: var(--ap-text-2);
		margin: 0 0 22px;
		max-width: 640px;
		padding-right: 28px;
	}

	/* ─── cta strip ───────────────────────────────────────── */
	.cta-strip {
		padding: 60px 24px 100px;
	}
	.cta-row {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 32px;
		padding: 40px 48px;
		background: var(--ap-soft);
		border: 1px solid var(--ap-line);
		border-radius: 28px;
		overflow: hidden;
	}
	.cta-glow {
		position: absolute;
		top: -60%;
		right: -10%;
		width: 420px;
		height: 420px;
		background: radial-gradient(closest-side, rgba(123, 241, 168, 0.28), transparent 70%);
		pointer-events: none;
	}
	.cta-h {
		position: relative;
		font-weight: 800;
		font-size: clamp(22px, 2.4vw, 30px);
		letter-spacing: -0.02em;
		margin: 0 0 6px;
	}
	.cta-p {
		position: relative;
		font-size: 15px;
		color: var(--ap-text-2);
		margin: 0;
	}
	.cta-row > .btn { position: relative; }

	/* ─── footer ──────────────────────────────────────────── */
	.footer {
		background: var(--ap-bg);
		padding: 64px 0 40px;
		border-top: 1px solid var(--ap-line);
	}
	.footer-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: 40px;
		padding-bottom: 48px;
	}
	.footer-brand .brand { margin-bottom: 14px; }
	.footer-tag {
		font-size: 14px;
		color: var(--ap-text-2);
		max-width: 280px;
		line-height: 1.55;
		margin: 0;
	}
	.footer-col { display: flex; flex-direction: column; gap: 10px; }
	.footer-h {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ap-text-3);
		margin: 0 0 6px;
	}
	.footer-col a {
		font-size: 14px;
		color: var(--ap-text-2);
		text-decoration: none;
		transition: color 0.2s;
	}
	.footer-col a:hover { color: var(--ap-text); }

	.footer-bottom {
		padding-top: 24px;
		border-top: 1px solid var(--ap-line);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.footer-bottom p {
		font-size: 12px;
		color: var(--ap-text-3);
		margin: 0;
	}
	.footer-fine {
		max-width: 520px;
		text-align: right;
	}

	/* ─── responsive ──────────────────────────────────────── */
	@media (max-width: 1000px) {
		.preview-body { grid-template-columns: 1fr; }
		.preview-sidebar { display: none; }
		.stats-row { grid-template-columns: 1fr; gap: 40px; }
		.benefits-grid { grid-template-columns: repeat(2, 1fr); }
		.testi-grid { grid-template-columns: 1fr; }
	}

	@media (max-width: 880px) {
		.nav { padding: 16px 20px; }
		.nav.scrolled { padding: 12px 20px; }
		.btn-ghost { display: none; }

		.hero { padding-top: 90px; }
		.preview-stage { margin-top: 40px; }
		.preview-canvas { grid-template-columns: repeat(2, 1fr); }
		.phone-stage { margin-top: 48px; }
		.phone-frame { width: 180px; height: 380px; border-radius: 32px; }

		.featured { padding: 80px 20px 20px; }
		.featured-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }

		.how { padding: 80px 20px; }
		.how-title { margin-bottom: 56px; }
		.how-row { grid-template-columns: 1fr; gap: 48px; }

		.benefits { padding: 24px 20px 80px; }
		.benefits-grid { grid-template-columns: 1fr; }

		.testimonials { padding: 80px 20px; }

		.faq { padding: 80px 20px 20px; }
		.faq-q { font-size: 16px; padding-right: 32px; }

		.cta-row { flex-direction: column; text-align: center; padding: 32px 28px; }

		.footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
		.footer-bottom { flex-direction: column; }
		.footer-fine { text-align: center; }
	}

	@media (prefers-reduced-motion: reduce) {
		.reveal { opacity: 1; transform: none; transition: none; }
		.phone-track { animation: none; }
		.phone-marquee {
			justify-content: center;
			width: 100%;
			overflow: hidden;
		}
		.phone-track:last-child { display: none; }
		.phone-aura { opacity: 0.55; }
	}
</style>
