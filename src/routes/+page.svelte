<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, ChevronRight, Check, Sparkles, Zap, TrendingUp, Globe } from 'lucide-svelte';

	let mounted = $state(false);
	let scrollY = $state(0);
	let fanAngle = $state(0);
	let carouselOffset = $state(0); // slow cinematic sweep ±degrees

	const words = ['Schedule.', 'Analyze.', 'Discover.', 'Grow.', 'Repeat.'];
	let wordIdx = $state(0);
	let wordVisible = $state(true);

	const galleryCards = [
		{ img: '/placeholders/placeholder-square.jpeg',   label: 'Brand Identity',     num: '01' },
		{ img: '/placeholders/placeholder-vertical.jpeg', label: 'News Template',       num: '02' },
		{ img: '/placeholders/placeholder-horizontal.jpeg',label: 'Tweet Carousel',    num: '03' },
		{ img: '/placeholders/placeholder-square.jpeg',   label: 'Text Carousel',      num: '04' },
		{ img: '/placeholders/placeholder-vertical.jpeg', label: 'Article Breakdown',  num: '05' },
		{ img: '/placeholders/placeholder-horizontal.jpeg',label: 'Brand Studio',      num: '06' },
		{ img: '/placeholders/placeholder-square.jpeg',   label: 'Image Quote',        num: '07' },
	];

	const platforms = [
		{ name: 'Instagram', color: '#E1306C', bg: 'rgba(225,48,108,0.10)', icon: 'instagram' },
		{ name: 'TikTok',    color: '#010101', bg: 'rgba(0,0,0,0.07)',       icon: 'tiktok' },
		{ name: 'Facebook',  color: '#1877F2', bg: 'rgba(24,119,242,0.10)',  icon: 'facebook' },
		{ name: 'LinkedIn',  color: '#0A66C2', bg: 'rgba(10,102,194,0.10)', icon: 'linkedin' },
		{ name: 'X / Twitter',color:'#000000', bg: 'rgba(0,0,0,0.07)',      icon: 'x' },
		{ name: 'YouTube',   color: '#FF0000', bg: 'rgba(255,0,0,0.09)',     icon: 'youtube' },
	];

	const features = [
		{ n: '01', title: 'Viral Discovery', desc: 'Track any creator. Our pipeline scrapes their top posts and AI reverse-engineers exactly what made each one explode.', tag: 'Apify + Claude', gradient: 'from-violet-500/10 to-purple-500/5' },
		{ n: '02', title: 'News to Post', desc: 'Pull breaking news, auto-rewrite into punchy captions, generate editorial images with Vertex AI — in one click.', tag: 'TheNewsAPI + Imagen', gradient: 'from-cyan-500/10 to-blue-500/5' },
		{ n: '03', title: 'AI Hook Generator', desc: 'Claude analyzes viral hooks from your niche and generates 10 remixed versions tailored to your brand voice.', tag: 'Claude 3.5 Sonnet', gradient: 'from-lime-400/10 to-emerald-500/5' },
		{ n: '04', title: 'Carousel Editor', desc: 'Build multi-slide carousels with a live canvas editor. Export each slide as a 1080×1350 PNG, ready to post.', tag: 'Export-ready', gradient: 'from-orange-400/10 to-red-500/5' },
	];

	const testimonials = [
		{ name: 'Mia Chen',     handle: '@mia.creates', initials: 'MC', text: 'I went from 200 to 12k followers in 6 weeks. The hook generator alone is worth 10x the price.', niche: 'Finance Creator',     color: '#8B5CF6' },
		{ name: 'Jordan Rivers',handle: '@jordanrivers', initials: 'JR', text: 'The news-to-post feature is insane. Fresh content every morning in under 2 minutes.',          niche: 'Fitness Coach',       color: '#06B6D4' },
		{ name: 'Priya Sood',   handle: '@priyasood.co', initials: 'PS', text: 'My agency manages 40 accounts. Carousel Studio cut our production time from 3 hours to 20 minutes.', niche: 'Social Media Agency', color: '#E8FF48' },
	];

	const marqueeItems = ['Schedule', 'Discover', 'Analyze', 'Create', 'Export', 'Grow', 'Repeat'];

	const steps = [
		{ n: '01', title: 'Track Competitors',  desc: 'Add any Instagram handle. We scrape their top-performing posts automatically and rank them by engagement.' },
		{ n: '02', title: 'AI Deconstruction',  desc: 'Claude analyzes each viral post — the hook type, emotional trigger, content structure, and what made it spread.' },
		{ n: '03', title: 'Create & Schedule',  desc: 'Open the editor, remix the winning formula for your brand, and export or schedule directly from the app.' },
	];

	// Hero: 3D arc — shared perspective lives on parent, cards just rotateY + scale
	const hwFanPositions = [
		{ rotateY:  65, scale: 0.74, zIndex: 1 },
		{ rotateY:  40, scale: 0.84, zIndex: 2 },
		{ rotateY:  18, scale: 0.93, zIndex: 3 },
		{ rotateY:   0, scale: 1.00, zIndex: 7 },
		{ rotateY: -18, scale: 0.93, zIndex: 3 },
		{ rotateY: -40, scale: 0.84, zIndex: 2 },
		{ rotateY: -65, scale: 0.74, zIndex: 1 },
	];

	// Gallery section: original 2D fan (playing-card spread)
	const fanPositions = [
		{ rotate: -24, tx: -600, ty: 90,  scale: 0.80, zIndex: 1 },
		{ rotate: -15, tx: -370, ty: 38,  scale: 0.88, zIndex: 2 },
		{ rotate:  -7, tx: -185, ty:  9,  scale: 0.94, zIndex: 3 },
		{ rotate:   0, tx:    0, ty:  0,  scale: 1.00, zIndex: 7 },
		{ rotate:   7, tx:  185, ty:  9,  scale: 0.94, zIndex: 3 },
		{ rotate:  15, tx:  370, ty: 38,  scale: 0.88, zIndex: 2 },
		{ rotate:  24, tx:  600, ty: 90,  scale: 0.80, zIndex: 1 },
	];

	onMount(() => {
		mounted = true;
		window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

		const cycle = setInterval(() => {
			wordVisible = false;
			setTimeout(() => { wordIdx = (wordIdx + 1) % words.length; wordVisible = true; }, 350);
		}, 2400);

		// Cinematic carousel animation
		let t = 0;
		let raf: number;
		function animateFan() {
			t += 0.003;
			// Gentle vertical float (35s cycle)
			fanAngle = Math.sin(t) * 5;
			// Slow cinematic left-right sweep of the whole arc (≈12s cycle, ±6°)
			carouselOffset = Math.sin(t * 3.0) * 6;
			raf = requestAnimationFrame(animateFan);
		}
		raf = requestAnimationFrame(animateFan);

		return () => {
			clearInterval(cycle);
			cancelAnimationFrame(raf);
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,700;1,9..144,900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="root" class:mounted>
	<div class="noise"></div>

	<!-- ═══ NAV ═══════════════════════════════════════════════════════ -->
	<nav class="nav" class:scrolled={scrollY > 40}>
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="#features">Features</a>
			<a href="#gallery">Templates</a>
			<a href="#pricing">Pricing</a>
			<a href="#how">How it works</a>
		</div>
		<div class="nav-actions">
			<a href="/login" class="nav-signin">Sign in</a>
			<a href="/signup" class="btn-cta-nav">Start free →</a>
		</div>
	</nav>

	<!-- ═══ HERO (white centered) ════════════════════════════════════ -->
	<section class="hero-white">
		<!-- Centered copy block -->
		<div class="hw-copy">
			<span class="hw-eyebrow">Behind the Designs</span>
			<h1 class="hw-headline">
				Curious What<br/>
				<em>We've Created?</em>
			</h1>
			<p class="hw-sub">
				Explore AI-powered carousels, branded templates, and viral post formats
				built for Instagram, TikTok, Facebook and beyond.
			</p>
			<a href="/signup" class="hw-cta">
				<span class="hw-cta-text">See more Templates</span>
				<div class="hw-cta-circle">
					<ArrowRight size={18} />
				</div>
			</a>
		</div>

		<!-- Full-width fan gallery — shared perspective on parent -->
		<div class="hw-fan-wrap">
			<div class="hw-fan" style="transform: translateY({fanAngle * 1.6}px)">
				{#each galleryCards as card, i}
					{@const pos = hwFanPositions[i]}
					<div
						class="hw-card"
						style="transform: rotateY({pos.rotateY + carouselOffset}deg) scale({pos.scale}); z-index: {pos.zIndex};"
					>
						<img src={card.img} alt={card.label} class="hw-card-img" />
					</div>
				{/each}
			</div>

			<!-- Labels under the four inner cards -->
			<div class="hw-labels">
				{#each galleryCards as card, i}
					{#if i >= 1 && i <= 4}
						<div class="hw-label">
							<span class="hw-label-num">#{card.num}</span>
							<span class="hw-label-text">{card.label}</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══ MARQUEE (dark surface) ════════════════════════════════════ -->
	<div class="marquee-wrap">
		<div class="marquee-track">
			{#each [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems] as item, i}
				<span class="marquee-item">
					{item}
					{#if i % 2 === 0}<span class="marquee-dot">✦</span>{/if}
				</span>
			{/each}
		</div>
	</div>

	<!-- ═══ PLATFORMS (light cream) ═══════════════════════════════════ -->
	<section class="section-light platforms-section">
		<div class="container">
			<div class="platforms-header">
				<span class="eyebrow-light">Supported Platforms</span>
				<h2 class="title-light">One workflow.<br/><em>Every platform.</em></h2>
				<p class="body-light">Schedule, publish, and analyze across all major social networks from a single dashboard.</p>
			</div>

			<div class="platforms-grid">
				{#each platforms as p}
					<div class="platform-card" style="--accent: {p.color}; --bg: {p.bg}">
						<div class="platform-icon-wrap">
							{#if p.icon === 'instagram'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="none">
									<rect width="24" height="24" rx="6" fill="url(#ig2)"/>
									<defs><linearGradient id="ig2" x1="0" y1="24" x2="24" y2="0">
										<stop stop-color="#f09433"/><stop offset=".25" stop-color="#e6683c"/>
										<stop offset=".5" stop-color="#dc2743"/><stop offset=".75" stop-color="#cc2366"/>
										<stop offset="1" stop-color="#bc1888"/>
									</linearGradient></defs>
									<circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.5" fill="none"/>
									<circle cx="17" cy="7" r="1" fill="white"/>
									<rect x="3" y="3" width="18" height="18" rx="5" stroke="white" stroke-width="1.5" fill="none"/>
								</svg>
							{:else if p.icon === 'tiktok'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#010101">
									<path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.73a4.85 4.85 0 01-1-.04z"/>
								</svg>
							{:else if p.icon === 'facebook'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#1877F2">
									<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
								</svg>
							{:else if p.icon === 'linkedin'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#0A66C2">
									<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
								</svg>
							{:else if p.icon === 'x'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#000">
									<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
								</svg>
							{:else if p.icon === 'youtube'}
								<svg viewBox="0 0 24 24" width="28" height="28" fill="#FF0000">
									<path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
								</svg>
							{/if}
						</div>
						<span class="platform-name">{p.name}</span>
						<div class="platform-check">
							<Check size={11} />
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══ GALLERY FAN (light warm white) ════════════════════════════ -->
	<section id="gallery" class="section-gallery">
		<div class="container">
			<div class="gallery-layout">
				<div class="gallery-text">
					<span class="eyebrow-orange">From Our Studio</span>
					<h2 class="gallery-headline">
						Curious What<br/>We've Created?
					</h2>
					<p class="gallery-sub">
						Explore the carousel templates and branded designs you can create with Carousel Studio.
					</p>
					<a href="/signup" class="gallery-cta">
						<span>Explore Templates</span>
						<div class="gallery-cta-circle">
							<ArrowRight size={16} />
						</div>
					</a>
				</div>

				<div class="gallery-fan-wrap">
					<div class="gallery-fan" style="transform: rotate({fanAngle}deg)">
						{#each galleryCards as card, i}
							{@const pos = fanPositions[i]}
							<div
								class="fan-card"
								style="
									transform: rotate({pos.rotate}deg) translateX({pos.tx}px) translateY({pos.ty}px) scale({pos.scale});
									z-index: {pos.zIndex};
									animation-delay: {i * 0.15}s;
								"
							>
								<img src={card.img} alt={card.label} class="fan-card-img" />
								<div class="fan-card-overlay"></div>
							</div>
						{/each}
					</div>

					<div class="fan-labels">
						{#each galleryCards.slice(1, 5) as card, i}
							<div class="fan-label">
								<span class="fan-label-num">#{card.num}</span>
								<span class="fan-label-text">{card.label}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ═══ FEATURES (dark) ═══════════════════════════════════════════ -->
	<section id="features" class="section-dark section-pad">
		<div class="container">
			<div class="section-header-dark">
				<span class="eyebrow-lime">The Toolkit</span>
				<h2 class="title-dark">Everything you need<br/><em>to dominate your niche.</em></h2>
			</div>

			<div class="features-grid">
				{#each features as f}
					<div class="feature-card">
						<div class="feature-gradient bg-gradient-to-br {f.gradient}"></div>
						<div class="feature-num">{f.n}</div>
						<div class="feature-body">
							<div class="feature-top">
								<h3 class="feature-title">{f.title}</h3>
								<span class="feature-tag">{f.tag}</span>
							</div>
							<p class="feature-desc">{f.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══ STATS BENTO (dark surface) ════════════════════════════════ -->
	<section class="section-surface section-pad">
		<div class="container">
			<div class="bento">
				<div class="bento-cell bento-big">
					<p class="bento-eyebrow">Posts analyzed by AI</p>
					<span class="bento-num">2.3M+</span>
					<p class="bento-sub">and counting, every week</p>
				</div>
				<div class="bento-cell">
					<span class="bento-num bento-num--md">94%</span>
					<p class="bento-label">avg engagement lift</p>
				</div>
				<div class="bento-cell">
					<span class="bento-num bento-num--md">12×</span>
					<p class="bento-label">faster than manual creation</p>
				</div>
				<div class="bento-cell bento-quote-cell">
					<div class="bento-stars">★★★★★</div>
					<p class="bento-quote">"The best investment I made for my content business this year."</p>
					<div class="bento-author">
						<div class="bento-avatar">JR</div>
						<div>
							<p class="bento-author-name">Jordan Rivers</p>
							<p class="bento-author-handle">@jordanrivers · Fitness Coach</p>
						</div>
					</div>
				</div>
				<div class="bento-cell bento-platform-cell">
					<p class="bento-label" style="margin-bottom: 12px;">Platforms</p>
					<div class="bento-platform-list">
						{#each ['IG', 'TK', 'FB', 'LI', 'YT', 'X'] as p}
							<span class="bento-platform-badge">{p}</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ═══ HOW IT WORKS (light cream) ════════════════════════════════ -->
	<section id="how" class="section-light section-pad">
		<div class="container">
			<div class="section-header-light">
				<span class="eyebrow-light">The Process</span>
				<h2 class="title-light">From zero to viral<br/><em>in three steps.</em></h2>
			</div>

			<div class="steps-grid">
				{#each steps as step, i}
					<div class="step-card">
						<div class="step-connector" class:hidden={i === steps.length - 1}></div>
						<div class="step-num-wrap">
							<span class="step-num">{step.n}</span>
						</div>
						<div class="step-content">
							<h3 class="step-title">{step.title}</h3>
							<p class="step-desc">{step.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══ TESTIMONIALS (dark) ════════════════════════════════════════ -->
	<section class="section-dark section-pad">
		<div class="container">
			<div class="section-header-dark">
				<span class="eyebrow-lime">Social Proof</span>
				<h2 class="title-dark">Creators are<br/><em>already winning.</em></h2>
			</div>

			<div class="testimonials-grid">
				{#each testimonials as t, i}
					<div class="testimonial-card" style="--delay: {i * 0.1}s; --color: {t.color}">
						<div class="t-quote-mark">"</div>
						<p class="t-text">{t.text}</p>
						<div class="t-author">
							<div class="t-avatar" style="background: {t.color}22; border-color: {t.color}44; color: {t.color}">
								{t.initials}
							</div>
							<div>
								<p class="t-name">{t.name}</p>
								<p class="t-meta">{t.niche} · {t.handle}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══ PRICING (light cream) ══════════════════════════════════════ -->
	<section id="pricing" class="section-light section-pad">
		<div class="container">
			<div class="section-header-light">
				<span class="eyebrow-light">Pricing</span>
				<h2 class="title-light">Simple,<br/><em>creator-first pricing.</em></h2>
				<p class="body-light">Start free. Scale when you grow.</p>
			</div>

			<div class="pricing-grid">
				<div class="price-card">
					<div class="price-tier-label">Free</div>
					<div class="price-amount">
						<span class="price-num">$0</span>
						<span class="price-period">/mo</span>
					</div>
					<p class="price-note">No card needed. Forever free.</p>
					<ul class="price-features">
						{#each ['5 carousels/month', '3 competitor tracks', 'AI hook suggestions', 'Basic canvas editor'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-dark">Get started</a>
				</div>

				<div class="price-card price-card--featured">
					<div class="price-badge">Most popular</div>
					<div class="price-tier-label" style="color: #0a0a0a">Pro</div>
					<div class="price-amount">
						<span class="price-num" style="color:#0a0a0a">$29</span>
						<span class="price-period" style="color:rgba(10,10,10,0.45)">/mo</span>
					</div>
					<p class="price-note" style="color:rgba(10,10,10,0.5)">Cancel anytime.</p>
					<ul class="price-features price-features--dark">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'News-to-Post (Vertex AI)', 'Full canvas + export', 'Style extraction'] as item}
							<li><span class="price-check" style="color:#0a0a0a">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-dark">Start Pro free</a>
				</div>

				<div class="price-card">
					<div class="price-tier-label">Agency</div>
					<div class="price-amount">
						<span class="price-num">$99</span>
						<span class="price-period">/mo</span>
					</div>
					<p class="price-note">For teams managing multiple brands.</p>
					<ul class="price-features">
						{#each ['Everything in Pro', 'Unlimited accounts', 'Team workspace', 'White-label export', 'API access'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-dark">Contact us</a>
				</div>
			</div>
		</div>
	</section>

	<!-- ═══ CTA (dark) ══════════════════════════════════════════════════ -->
	<section class="section-dark cta-section">
		<div class="cta-orb"></div>
		<div class="cta-inner">
			<span class="eyebrow-lime">✦ Ready?</span>
			<h2 class="cta-headline">
				Stop watching others go viral.<br/>
				<em>Start your free account today.</em>
			</h2>
			<a href="/signup" class="btn-lime btn-xl">
				Get started free — no card needed
				<ArrowRight size={20} />
			</a>
			<div class="cta-platforms">
				<span class="cta-platforms-label">Works with</span>
				<!-- small platform row -->
				<div style="display:flex;gap:8px;align-items:center">
					{#each ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube'] as name}
						<span class="cta-platform-tag">{name}</span>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- ═══ FOOTER (dark) ══════════════════════════════════════════════ -->
	<footer class="footer">
		<div class="footer-inner">
			<div class="footer-brand">
				<a href="/" class="logo">
					<span class="logo-mark">CS</span>
					<span class="logo-text">Carousel<em>Studio</em></span>
				</a>
				<p class="footer-tagline">AI-powered content for serious social creators.</p>
				<div class="footer-social">
					{#each [
						{ label: 'X', href: '#', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z' },
						{ label: 'Instagram', href: '#', path: null, isIg: true },
						{ label: 'LinkedIn', href: '#', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' }
					] as s}
						<a href={s.href} class="footer-social-link" aria-label={s.label}>
							{#if s.isIg}
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none">
									<circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
									<circle cx="17" cy="7" r="1" fill="currentColor"/>
									<rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
									<path d={s.path}/>
								</svg>
							{/if}
						</a>
					{/each}
				</div>
			</div>

			<div class="footer-cols">
				<div class="footer-col">
					<p class="footer-col-title">Product</p>
					<a href="#features">Features</a>
					<a href="#pricing">Pricing</a>
					<a href="#gallery">Templates</a>
					<a href="/dashboard">Dashboard</a>
				</div>
				<div class="footer-col">
					<p class="footer-col-title">Platforms</p>
					<a href="#">Instagram</a>
					<a href="#">TikTok</a>
					<a href="#">Facebook</a>
					<a href="#">LinkedIn</a>
				</div>
				<div class="footer-col">
					<p class="footer-col-title">Legal</p>
					<a href="/privacy">Privacy</a>
					<a href="/terms">Terms</a>
					<a href="#">Cookie Policy</a>
				</div>
			</div>
		</div>
		<div class="footer-bottom">
			<p>© 2026 Carousel Studio. Built with SvelteKit + Claude AI.</p>
			<p>Made with ♥ for creators worldwide.</p>
		</div>
	</footer>
</div>

<style>
	/* ── Global tokens ───────────────────────────────────────────── */
	:root {
		--lime:   #E8FF48;
		--orange: #FF6B35;
		--dark:   #080808;
		--surface:#111111;
		--s2:     #1A1A1A;
		--cream:  #F5F0E6;
		--cream2: #EDE8DA;
		--warm:   #FAFAF7;
		--d-text: #F0EDE8;
		--d-muted:rgba(240,237,232,0.5);
		--d-dim:  rgba(240,237,232,0.22);
		--d-border:rgba(255,255,255,0.06);
		--l-text: #0F0A05;
		--l-muted:rgba(15,10,5,0.5);
		--l-dim:  rgba(15,10,5,0.3);
		--l-border:rgba(15,10,5,0.08);
		--font-display: 'Fraunces', Georgia, serif;
		--font-body:    'DM Sans', sans-serif;
		--font-mono:    'Space Mono', monospace;
	}

	/* ── Base ─────────────────────────────────────────────────────── */
	.root {
		font-family: var(--font-body);
		overflow-x: hidden;
		opacity: 0;
		transition: opacity 0.5s ease;
	}
	.root.mounted { opacity: 1; }

	.noise {
		position: fixed; inset: 0; pointer-events: none; z-index: 1000;
		opacity: 0.018;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
		background-size: 256px;
	}

	.container { max-width: 1160px; margin: 0 auto; }

	/* ── Section types ────────────────────────────────────────────── */
	.section-dark    { background: var(--dark); color: var(--d-text); }
	.section-surface { background: var(--surface); color: var(--d-text); }
	.section-light   { background: var(--cream); color: var(--l-text); }
	.section-gallery { background: var(--warm); color: var(--l-text); }
	.section-pad     { padding: 100px 48px; }

	/* ── Nav ──────────────────────────────────────────────────────── */
	.nav {
		position: fixed; top: 0; left: 0; right: 0; z-index: 200;
		display: flex; align-items: center; justify-content: space-between;
		padding: 18px 48px;
		background: rgba(8,8,8,0);
		backdrop-filter: blur(0px);
		transition: all 0.3s ease;
		border-bottom: 1px solid transparent;
	}
	.nav.scrolled {
		background: rgba(8,8,8,0.9);
		backdrop-filter: blur(24px);
		border-bottom-color: var(--d-border);
	}

	.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
	.logo-mark {
		width: 32px; height: 32px;
		background: var(--lime); color: #000;
		border-radius: 8px;
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-mono); font-size: 11px; font-weight: 700;
		letter-spacing: 0.05em; flex-shrink: 0;
	}
	.logo-text {
		font-family: var(--font-display); font-size: 17px; font-weight: 700;
		color: var(--l-text); letter-spacing: -0.02em; transition: color 0.3s;
	}
	.logo-text em { font-style: italic; color: var(--orange); transition: color 0.3s; }

	.nav-links { display: flex; gap: 36px; }
	.nav-links a {
		font-size: 14px; color: rgba(10,10,10,0.5); text-decoration: none;
		transition: color 0.2s; font-weight: 400;
	}
	.nav-links a:hover { color: var(--l-text); }

	.nav-actions { display: flex; align-items: center; gap: 16px; }
	.nav-signin { font-size: 14px; color: rgba(10,10,10,0.5); text-decoration: none; transition: color 0.2s; }
	.nav-signin:hover { color: var(--l-text); }

	/* When scrolled into dark territory — flip to light text */
	.nav.scrolled .logo-text { color: var(--d-text); }
	.nav.scrolled .logo-text em { color: var(--lime); }
	.nav.scrolled .nav-links a { color: var(--d-muted); }
	.nav.scrolled .nav-links a:hover { color: var(--d-text); }
	.nav.scrolled .nav-signin { color: var(--d-muted); }
	.nav.scrolled .nav-signin:hover { color: var(--d-text); }

	.btn-cta-nav {
		display: inline-flex; align-items: center;
		padding: 9px 20px; background: #0a0a0a; color: #fff;
		border-radius: 100px; font-size: 13px; font-weight: 600;
		font-family: var(--font-body); text-decoration: none;
		transition: all 0.2s; letter-spacing: -0.01em;
	}
	.btn-cta-nav:hover { background: #222; }
	.nav.scrolled .btn-cta-nav { background: var(--lime); color: #000; }
	.nav.scrolled .btn-cta-nav:hover { background: #f0ff70; }

	/* ── Buttons ──────────────────────────────────────────────────── */
	.btn-lime {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 13px 26px; background: var(--lime); color: #000;
		border-radius: 12px; font-weight: 600; font-size: 15px;
		font-family: var(--font-body); text-decoration: none;
		transition: all 0.2s; border: none; cursor: pointer;
	}
	.btn-lime:hover { background: #f0ff70; transform: translateY(-1px); box-shadow: 0 10px 36px rgba(232,255,72,0.3); }
	.btn-sm  { padding: 10px 18px !important; font-size: 13px !important; border-radius: 10px !important; }
	.btn-lg  { padding: 16px 32px !important; font-size: 16px !important; }
	.btn-xl  { padding: 20px 40px !important; font-size: 18px !important; border-radius: 16px !important; }

	.btn-ghost {
		display: inline-flex; align-items: center; gap: 6px;
		font-size: 14px; color: var(--d-muted); text-decoration: none; transition: color 0.2s;
	}
	.btn-ghost:hover { color: var(--d-text); }

	.btn-dark {
		display: block; text-align: center;
		padding: 13px 24px; background: #0a0a0a; color: #fff;
		border-radius: 10px; font-size: 14px; font-weight: 600;
		text-decoration: none; transition: all 0.2s;
	}
	.btn-dark:hover { background: #1a1a1a; transform: translateY(-1px); }

	.btn-outline-dark {
		display: block; text-align: center;
		padding: 13px 24px; border: 1.5px solid var(--l-border);
		border-radius: 10px; color: var(--l-muted); text-decoration: none;
		font-size: 14px; font-weight: 500; transition: all 0.2s;
	}
	.btn-outline-dark:hover { border-color: rgba(15,10,5,0.2); color: var(--l-text); }

	/* ── Eyebrows & headings ──────────────────────────────────────── */
	.eyebrow-lime {
		display: inline-block;
		font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em;
		text-transform: uppercase; color: var(--lime); margin-bottom: 16px;
	}
	.eyebrow-light {
		display: inline-block;
		font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em;
		text-transform: uppercase; color: var(--l-muted); margin-bottom: 16px;
	}
	.eyebrow-orange {
		display: inline-block;
		font-family: var(--font-mono); font-size: 11px; font-weight: 700;
		letter-spacing: 0.12em; text-transform: uppercase;
		color: var(--orange); margin-bottom: 16px;
	}

	.title-dark {
		font-family: var(--font-display); font-size: clamp(36px, 4vw, 56px);
		font-weight: 900; line-height: 1.05; letter-spacing: -0.03em;
		color: var(--d-text); margin: 0 0 20px;
	}
	.title-dark em { font-style: italic; color: var(--d-muted); }

	.title-light {
		font-family: var(--font-display); font-size: clamp(36px, 4vw, 56px);
		font-weight: 900; line-height: 1.05; letter-spacing: -0.03em;
		color: var(--l-text); margin: 0 0 20px;
	}
	.title-light em { font-style: italic; color: var(--l-muted); }

	.body-light { font-size: 16px; line-height: 1.65; color: var(--l-muted); max-width: 480px; }

	.section-header-dark { margin-bottom: 64px; }
	.section-header-light { margin-bottom: 64px; text-align: center; }
	.section-header-light .body-light { margin: 0 auto; }

	/* ── Hero ─────────────────────────────────────────────────────── */
	.hero {
		min-height: 100vh; padding: 120px 48px 80px;
		position: relative; overflow: hidden;
	}

	.hero-orb {
		position: absolute; border-radius: 50%;
		pointer-events: none; filter: blur(80px);
	}
	.hero-orb--1 {
		width: 500px; height: 500px;
		top: 10%; left: 55%;
		background: radial-gradient(ellipse, rgba(232,255,72,0.07), transparent 70%);
	}
	.hero-orb--2 {
		width: 400px; height: 400px;
		bottom: 5%; left: 20%;
		background: radial-gradient(ellipse, rgba(139,92,246,0.06), transparent 70%);
	}

	.hero-inner {
		max-width: 1160px; margin: 0 auto; width: 100%;
		display: grid; grid-template-columns: 1fr 1fr;
		gap: 80px; align-items: center; position: relative; z-index: 1;
	}

	.hero-left { display: flex; flex-direction: column; gap: 28px; }

	.hero-badge {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 8px 16px;
		border: 1px solid rgba(232,255,72,0.25);
		border-radius: 100px;
		font-family: var(--font-mono); font-size: 11px;
		color: var(--lime); letter-spacing: 0.08em;
		width: fit-content; background: rgba(232,255,72,0.06);
	}
	.badge-pulse {
		width: 6px; height: 6px; border-radius: 50%;
		background: var(--lime);
		animation: pulse-dot 2s ease-in-out infinite;
	}
	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50%       { opacity: 0.4; transform: scale(0.75); }
	}

	.hero-headline {
		font-family: var(--font-display);
		font-size: clamp(50px, 5.5vw, 80px);
		font-weight: 900; line-height: 1.0;
		letter-spacing: -0.03em; color: var(--d-text); margin: 0;
	}

	.word-cycle {
		display: inline-block; font-style: italic; color: var(--lime);
		transition: opacity 0.3s ease, transform 0.3s ease;
		opacity: 0; transform: translateY(10px);
	}
	.word-cycle.visible { opacity: 1; transform: translateY(0); }

	.hero-dim { color: rgba(240,237,232,0.3); }

	.hero-desc {
		font-size: 18px; line-height: 1.7;
		color: var(--d-muted); max-width: 480px; margin: 0; font-weight: 300;
	}

	.hero-ctas { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }

	.hero-proof { display: flex; align-items: center; gap: 12px; }
	.proof-avatars { display: flex; }
	.proof-avatar {
		width: 30px; height: 30px; border-radius: 50%;
		border: 2px solid var(--dark);
		display: flex; align-items: center; justify-content: center;
		font-size: 9px; font-weight: 700; font-family: var(--font-mono);
		color: var(--d-text); margin-right: -8px;
		background: hsl(calc(var(--hue, 0) + 200), 40%, 25%);
	}
	.proof-text { font-size: 13px; color: var(--d-dim); margin-left: 16px; }
	.proof-text strong { color: var(--d-muted); }

	/* Platform icons row in hero */
	.hero-platforms {
		max-width: 1160px; margin: 64px auto 0;
		display: flex; align-items: center; gap: 20px;
		padding: 0 0; position: relative; z-index: 1;
	}
	.hero-platforms-label {
		font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
		text-transform: uppercase; color: var(--d-dim); white-space: nowrap;
	}
	.hero-platforms-icons { display: flex; gap: 10px; flex-wrap: wrap; }
	.hpi {
		width: 38px; height: 38px; border-radius: 10px;
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(255,255,255,0.08);
		display: flex; align-items: center; justify-content: center;
		transition: all 0.2s; cursor: default;
	}
	.hpi:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); border-color: rgba(255,255,255,0.15); }

	/* ── Product preview ──────────────────────────────────────────── */
	.hero-right { display: flex; justify-content: center; align-items: center; }
	.product-preview { position: relative; width: 360px; height: 480px; }

	.preview-card {
		position: absolute; border-radius: 16px;
		border: 1px solid var(--d-border);
		background: var(--surface); overflow: hidden;
	}
	.preview-card--back {
		width: 260px; height: 160px; top: 0; right: 0;
		transform: rotate(4deg); background: var(--s2);
		animation: float-back 5s ease-in-out infinite;
	}
	.preview-card--mid {
		width: 280px; height: 165px; top: 80px; left: 0;
		transform: rotate(-2deg); padding: 20px; z-index: 2;
		animation: float-mid 5s ease-in-out 0.5s infinite;
	}
	.preview-card--front {
		width: 200px; height: 280px; bottom: 0; right: 20px; z-index: 3;
		display: flex; flex-direction: column; overflow: hidden;
		animation: float-front 5s ease-in-out 1s infinite;
	}
	@keyframes float-back  { 0%,100%{transform:rotate(4deg) translateY(0)} 50%{transform:rotate(4deg) translateY(-8px)} }
	@keyframes float-mid   { 0%,100%{transform:rotate(-2deg) translateY(0)} 50%{transform:rotate(-2deg) translateY(-6px)} }
	@keyframes float-front { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

	.pc-header {
		display: flex; align-items: center; gap: 5px;
		padding: 10px 14px; border-bottom: 1px solid var(--d-border);
	}
	.pc-dot { width: 8px; height: 8px; border-radius: 50%; }
	.pc-dot.r { background: #ff5f57; } .pc-dot.y { background: #ffbd2e; } .pc-dot.g { background: #28c840; }
	.pc-title { font-family: var(--font-mono); font-size: 10px; color: var(--d-dim); margin-left: 8px; }
	.pc-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
	.pc-bar { height: 6px; border-radius: 3px; background: var(--d-border); }
	.pc-stat { display: flex; align-items: baseline; gap: 4px; margin-top: 4px; }
	.pc-num { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--lime); }
	.pc-label { font-size: 11px; color: var(--d-dim); }

	.pc-hook-label { font-family: var(--font-mono); font-size: 9px; color: var(--lime); letter-spacing: 0.1em; margin-bottom: 8px; }
	.pc-hook-text  { font-family: var(--font-display); font-size: 14px; font-weight: 700; font-style: italic; color: var(--d-text); line-height: 1.3; margin-bottom: 12px; }
	.pc-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
	.pc-tag { font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; border-radius: 100px; border: 1px solid var(--d-border); color: var(--d-dim); }
	.pc-tag.accent { background: rgba(232,255,72,0.1); border-color: rgba(232,255,72,0.25); color: var(--lime); }
	.pc-remix-btn { font-size: 11px; font-family: var(--font-mono); color: var(--lime); }

	.news-card-img {
		flex: 1;
		background: linear-gradient(135deg, #1a1a2e 0%, #0c2340 100%);
		position: relative;
	}
	.news-card-img::after {
		content: ''; position: absolute; inset: 0;
		background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85));
	}
	.news-card-text { padding: 12px; background: #000; }
	.news-source {
		font-family: Georgia, serif; font-size: 9px; font-style: italic;
		color: var(--lime); letter-spacing: 2px; margin-bottom: 6px; text-align: center;
	}
	.news-headline {
		font-family: 'Bebas Neue', Impact, sans-serif; font-size: 15px;
		color: #fff; line-height: 1.1; letter-spacing: 1px; margin: 0; text-transform: uppercase;
	}
	.news-headline em { color: var(--lime); font-style: normal; }

	.float-pill {
		position: absolute;
		display: flex; align-items: center; gap: 6px;
		padding: 8px 14px; border-radius: 100px;
		background: var(--surface); border: 1px solid var(--d-border); z-index: 10;
		animation: float-pill-anim 4s ease-in-out infinite;
	}
	.float-pill--1 { top: 20px; left: 10px; animation-delay: 0.3s; }
	.float-pill--2 { bottom: 50px; left: -10px; animation-delay: 1.2s; }
	@keyframes float-pill-anim { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
	.pill-num { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--lime); }
	.pill-label { font-size: 11px; color: var(--d-dim); }
	.pill-icon { font-size: 13px; }

	/* ── Marquee ──────────────────────────────────────────────────── */
	.marquee-wrap {
		overflow: hidden;
		border-top: 1px solid var(--d-border); border-bottom: 1px solid var(--d-border);
		padding: 16px 0; background: var(--surface);
	}
	.marquee-track {
		display: flex; width: max-content;
		animation: marquee 30s linear infinite;
	}
	@keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-25%)} }
	.marquee-item {
		display: flex; align-items: center; gap: 16px;
		padding: 0 28px;
		font-family: var(--font-display); font-size: 17px;
		font-weight: 700; font-style: italic;
		color: var(--d-dim); white-space: nowrap;
	}
	.marquee-dot { color: var(--lime); font-style: normal; font-size: 12px; }

	/* ── Platforms section ────────────────────────────────────────── */
	.platforms-section { padding: 80px 48px; }
	.platforms-header { text-align: center; margin-bottom: 48px; }
	.platforms-header .body-light { margin: 0 auto; }

	.platforms-grid {
		display: grid; grid-template-columns: repeat(6, 1fr);
		gap: 16px;
	}

	.platform-card {
		display: flex; flex-direction: column; align-items: center; gap: 10px;
		padding: 24px 16px;
		border-radius: 16px;
		background: var(--bg, rgba(15,10,5,0.04));
		border: 1.5px solid var(--l-border);
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		cursor: default; position: relative; overflow: hidden;
	}
	.platform-card::before {
		content: ''; position: absolute; inset: 0;
		background: var(--bg); opacity: 0;
		transition: opacity 0.25s;
	}
	.platform-card:hover { transform: translateY(-4px); border-color: rgba(15,10,5,0.12); box-shadow: 0 8px 32px rgba(15,10,5,0.08); }
	.platform-card:hover::before { opacity: 1; }

	.platform-icon-wrap { position: relative; z-index: 1; }
	.platform-name { font-size: 12px; font-weight: 600; color: var(--l-muted); font-family: var(--font-body); position: relative; z-index: 1; text-align: center; }
	.platform-check {
		width: 18px; height: 18px; border-radius: 50%;
		background: rgba(16,185,129,0.15); color: #10b981;
		display: flex; align-items: center; justify-content: center;
		position: relative; z-index: 1;
	}

	/* ── Gallery Fan ──────────────────────────────────────────────── */
	.section-gallery { padding: 80px 48px 120px; overflow: hidden; }

	.gallery-layout {
		display: grid; grid-template-columns: 1fr 1fr;
		gap: 80px; align-items: center;
	}

	.gallery-text { display: flex; flex-direction: column; }

	.gallery-headline {
		font-family: var(--font-display);
		font-size: clamp(40px, 4.5vw, 62px);
		font-weight: 900; line-height: 1.0;
		letter-spacing: -0.03em; color: var(--l-text);
		margin: 0 0 20px;
	}

	.gallery-sub {
		font-size: 17px; line-height: 1.65;
		color: var(--l-muted); max-width: 380px; margin: 0 0 36px;
	}

	.gallery-cta {
		display: inline-flex; align-items: center; gap: 14px;
		font-size: 15px; font-weight: 600; color: var(--l-text);
		text-decoration: none; width: fit-content;
		transition: gap 0.2s;
	}
	.gallery-cta:hover { gap: 18px; }
	.gallery-cta-circle {
		width: 38px; height: 38px; border-radius: 50%;
		background: var(--orange); color: white;
		display: flex; align-items: center; justify-content: center;
		transition: transform 0.2s;
	}
	.gallery-cta:hover .gallery-cta-circle { transform: scale(1.1); }

	.gallery-fan-wrap {
		position: relative; display: flex; flex-direction: column; align-items: center;
	}

	.gallery-fan {
		position: relative;
		width: 680px; height: 320px;
		display: flex; align-items: flex-end; justify-content: center;
		transform-origin: center bottom;
		transition: transform 0.1s linear;
	}

	.fan-card {
		position: absolute;
		width: 140px; height: 200px;
		border-radius: 16px; overflow: hidden;
		border: 1px solid rgba(15,10,5,0.1);
		box-shadow: 0 8px 32px rgba(15,10,5,0.12);
		transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s;
		animation: fan-float 4s ease-in-out infinite;
		cursor: pointer;
		bottom: 0;
	}
	.fan-card:nth-child(1) { animation-delay: 0.0s; }
	.fan-card:nth-child(2) { animation-delay: 0.2s; }
	.fan-card:nth-child(3) { animation-delay: 0.4s; }
	.fan-card:nth-child(4) { animation-delay: 0.6s; }
	.fan-card:nth-child(5) { animation-delay: 0.8s; }
	.fan-card:nth-child(6) { animation-delay: 1.0s; }
	.fan-card:nth-child(7) { animation-delay: 1.2s; }

	@keyframes fan-float {
		0%, 100% { margin-bottom: 0; }
		50% { margin-bottom: 6px; }
	}

	.fan-card:hover {
		transform: translateY(-20px) scale(1.06) !important;
		box-shadow: 0 24px 60px rgba(15,10,5,0.2);
		z-index: 10 !important;
	}

	.fan-card-img {
		width: 100%; height: 100%;
		object-fit: cover; display: block;
	}

	.fan-card-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(to bottom, transparent 40%, rgba(15,10,5,0.3));
	}

	.fan-labels {
		display: flex; gap: 24px; margin-top: 28px;
		justify-content: center;
	}
	.fan-label { text-align: center; }
	.fan-label-num {
		display: block; font-family: var(--font-mono); font-size: 12px;
		font-weight: 700; color: var(--orange); margin-bottom: 4px;
	}
	.fan-label-text {
		display: block; font-size: 12px; font-weight: 600; color: var(--l-muted);
	}

	/* ── Features ─────────────────────────────────────────────────── */
	.features-grid {
		display: grid; grid-template-columns: 1fr 1fr;
		gap: 2px; border: 1px solid var(--d-border);
		border-radius: 20px; overflow: hidden;
	}
	.feature-card {
		padding: 44px; background: var(--dark);
		display: flex; gap: 28px; align-items: flex-start;
		border: 1px solid var(--d-border);
		transition: background 0.2s;
		position: relative; overflow: hidden;
	}
	.feature-card:hover { background: var(--surface); }
	.feature-gradient {
		position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s;
	}
	.feature-card:hover .feature-gradient { opacity: 1; }

	.feature-num {
		font-family: var(--font-display); font-size: 52px;
		font-weight: 900; font-style: italic; color: rgba(232,255,72,0.1);
		line-height: 1; min-width: 64px; transition: color 0.2s;
		position: relative; z-index: 1;
	}
	.feature-card:hover .feature-num { color: rgba(232,255,72,0.5); }

	.feature-body { flex: 1; position: relative; z-index: 1; }
	.feature-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
	.feature-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--d-text); }
	.feature-tag {
		font-family: var(--font-mono); font-size: 10px;
		padding: 3px 10px; border-radius: 100px;
		border: 1px solid var(--d-border); color: var(--d-dim); letter-spacing: 0.05em;
	}
	.feature-desc { font-size: 14px; line-height: 1.7; color: var(--d-muted); margin: 0; }

	/* ── Bento ────────────────────────────────────────────────────── */
	.bento {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		grid-template-rows: auto auto;
		gap: 16px;
	}
	.bento-cell {
		padding: 40px; border-radius: 20px;
		border: 1px solid var(--d-border); background: var(--dark);
		display: flex; flex-direction: column; gap: 8px;
	}
	.bento-big { background: var(--s2); }
	.bento-quote-cell { grid-column: span 2; }
	.bento-platform-cell {}

	.bento-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--d-dim); margin: 0; }
	.bento-num {
		font-family: var(--font-display); font-size: 72px; font-weight: 900;
		color: var(--lime); line-height: 1; display: block;
	}
	.bento-num--md { font-size: 56px; }
	.bento-sub { font-size: 12px; color: var(--d-dim); font-family: var(--font-mono); margin: 0; }
	.bento-label { font-size: 14px; color: var(--d-muted); margin: 0; }
	.bento-stars { font-size: 14px; color: #FBBF24; letter-spacing: 2px; margin-bottom: 12px; }
	.bento-quote {
		font-family: var(--font-display); font-size: 22px; font-style: italic;
		font-weight: 700; color: var(--d-text); line-height: 1.4; margin: 0 0 24px;
	}
	.bento-author { display: flex; align-items: center; gap: 12px; }
	.bento-avatar {
		width: 36px; height: 36px; border-radius: 50%;
		background: var(--s2); display: flex; align-items: center; justify-content: center;
		font-family: var(--font-mono); font-size: 11px; color: var(--d-dim); flex-shrink: 0;
		border: 1px solid var(--d-border);
	}
	.bento-author-name { font-size: 13px; font-weight: 600; color: var(--d-muted); margin: 0 0 2px; }
	.bento-author-handle { font-size: 11px; color: var(--d-dim); margin: 0; font-family: var(--font-mono); }

	.bento-platform-list { display: flex; flex-wrap: wrap; gap: 8px; }
	.bento-platform-badge {
		padding: 4px 10px; border-radius: 6px;
		background: var(--s2); border: 1px solid var(--d-border);
		font-family: var(--font-mono); font-size: 10px; color: var(--d-dim);
		letter-spacing: 0.05em;
	}

	/* ── Steps ────────────────────────────────────────────────────── */
	.steps-grid {
		display: grid; grid-template-columns: repeat(3, 1fr);
		gap: 0;
	}
	.step-card {
		padding: 48px 40px;
		border: 1.5px solid var(--l-border);
		border-right: none;
		position: relative;
		transition: background 0.2s;
	}
	.step-card:last-child { border-right: 1.5px solid var(--l-border); }
	.step-card:hover { background: var(--cream2); }

	.step-connector {
		position: absolute; top: 50%; right: -1px;
		width: 24px; height: 1.5px;
		background: linear-gradient(90deg, var(--l-border), transparent);
		transform: translateY(-50%);
	}
	.step-connector.hidden { display: none; }

	.step-num-wrap {
		width: 48px; height: 48px; border-radius: 12px;
		background: var(--l-text); display: flex; align-items: center; justify-content: center;
		margin-bottom: 20px;
	}
	.step-num {
		font-family: var(--font-display); font-size: 16px; font-weight: 900;
		color: var(--cream); letter-spacing: -0.03em;
	}
	.step-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--l-text); margin-bottom: 12px; }
	.step-desc { font-size: 14px; line-height: 1.7; color: var(--l-muted); margin: 0; }

	/* ── Testimonials ─────────────────────────────────────────────── */
	.testimonials-grid {
		display: grid; grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}
	.testimonial-card {
		padding: 40px; border-radius: 20px;
		border: 1px solid var(--d-border); background: var(--surface);
		display: flex; flex-direction: column; gap: 20px;
		transition: border-color 0.25s, transform 0.25s;
		position: relative; overflow: hidden;
	}
	.testimonial-card::before {
		content: ''; position: absolute;
		top: -60px; right: -60px;
		width: 120px; height: 120px; border-radius: 50%;
		background: var(--color, rgba(255,255,255,0.03));
		opacity: 0.3;
	}
	.testimonial-card:hover { border-color: var(--color, var(--d-border)); transform: translateY(-4px); }

	.t-quote-mark {
		font-family: var(--font-display); font-size: 60px;
		font-weight: 900; line-height: 1; color: var(--color, var(--d-border));
		opacity: 0.4; height: 32px; display: block; margin-bottom: -12px;
	}
	.t-text { font-size: 15px; line-height: 1.7; color: var(--d-muted); flex: 1; margin: 0; }
	.t-author { display: flex; align-items: center; gap: 12px; }
	.t-avatar {
		width: 40px; height: 40px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-mono); font-size: 12px; font-weight: 700;
		flex-shrink: 0; border: 1px solid;
	}
	.t-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--d-text); margin: 0 0 2px; }
	.t-meta { font-size: 11px; color: var(--d-dim); font-family: var(--font-mono); margin: 0; }

	/* ── Pricing ──────────────────────────────────────────────────── */
	.pricing-grid {
		display: grid; grid-template-columns: repeat(3, 1fr);
		gap: 20px; align-items: start;
	}
	.price-card {
		padding: 36px; border-radius: 20px;
		border: 1.5px solid var(--l-border); background: white;
		display: flex; flex-direction: column; gap: 24px;
		position: relative; transition: box-shadow 0.25s, transform 0.25s;
	}
	.price-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(15,10,5,0.1); }
	.price-card--featured {
		border-color: var(--l-text);
		background: var(--l-text);
		box-shadow: 0 8px 40px rgba(15,10,5,0.2);
	}
	.price-badge {
		position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
		background: var(--lime); color: #000;
		font-size: 10px; font-family: var(--font-mono); font-weight: 700;
		letter-spacing: 0.08em; text-transform: uppercase;
		padding: 4px 14px; border-radius: 100px; white-space: nowrap;
	}
	.price-tier-label {
		font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em;
		text-transform: uppercase; color: var(--l-muted);
	}
	.price-amount { display: flex; align-items: baseline; gap: 4px; }
	.price-num {
		font-family: var(--font-display); font-size: 52px; font-weight: 900;
		color: var(--l-text); letter-spacing: -0.03em;
	}
	.price-period { font-size: 16px; color: var(--l-dim); }
	.price-note { font-size: 12px; color: var(--l-dim); margin: 0; }
	.price-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; flex: 1; }
	.price-features li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--l-muted); }
	.price-features--dark li { color: rgba(255,255,255,0.65); }
	.price-check { font-size: 12px; font-weight: 700; color: var(--l-dim); flex-shrink: 0; }

	/* ── CTA section ──────────────────────────────────────────────── */
	.cta-section { padding: 140px 48px; position: relative; overflow: hidden; text-align: center; }
	.cta-orb {
		position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
		width: 700px; height: 400px; border-radius: 50%;
		background: radial-gradient(ellipse, rgba(232,255,72,0.07), transparent 65%);
		pointer-events: none;
	}
	.cta-inner {
		max-width: 780px; margin: 0 auto;
		display: flex; flex-direction: column; align-items: center; gap: 32px;
		position: relative; z-index: 1;
	}
	.cta-headline {
		font-family: var(--font-display);
		font-size: clamp(36px, 4.5vw, 64px);
		font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
		color: var(--d-text); margin: 0;
	}
	.cta-headline em { font-style: italic; color: var(--lime); }

	.cta-platforms { display: flex; align-items: center; gap: 12px; }
	.cta-platforms-label { font-size: 12px; color: var(--d-dim); font-family: var(--font-mono); }
	.cta-platform-tag {
		font-size: 11px; font-family: var(--font-mono); padding: 4px 10px;
		border-radius: 6px; border: 1px solid var(--d-border); color: var(--d-dim);
	}

	/* ── Footer ───────────────────────────────────────────────────── */
	.footer { background: var(--dark); border-top: 1px solid var(--d-border); padding: 64px 48px 32px; }
	.footer-inner {
		max-width: 1160px; margin: 0 auto;
		display: grid; grid-template-columns: 1.5fr 1fr;
		gap: 80px; margin-bottom: 48px;
	}
	.footer-brand { display: flex; flex-direction: column; gap: 16px; }
	.footer-tagline { font-size: 14px; color: var(--d-muted); max-width: 280px; line-height: 1.6; }
	.footer-social { display: flex; gap: 10px; }
	.footer-social-link {
		width: 36px; height: 36px; border-radius: 10px;
		background: var(--s2); border: 1px solid var(--d-border);
		display: flex; align-items: center; justify-content: center;
		color: var(--d-dim); text-decoration: none;
		transition: all 0.2s;
	}
	.footer-social-link:hover { color: var(--d-text); background: var(--surface); border-color: var(--d-border); }

	.footer-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
	.footer-col { display: flex; flex-direction: column; gap: 12px; }
	.footer-col-title {
		font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
		text-transform: uppercase; color: var(--d-dim); margin-bottom: 4px;
	}
	.footer-col a {
		font-size: 14px; color: var(--d-muted); text-decoration: none; transition: color 0.2s;
	}
	.footer-col a:hover { color: var(--d-text); }

	.footer-bottom {
		max-width: 1160px; margin: 0 auto;
		display: flex; justify-content: space-between; align-items: center;
		padding-top: 24px; border-top: 1px solid var(--d-border);
		font-size: 12px; color: var(--d-dim); font-family: var(--font-mono);
	}

	/* ══════════════════════════════════════════════════════════════
	   WHITE HERO
	══════════════════════════════════════════════════════════════ */
	.hero-white {
		background: #ffffff;
		padding: 164px 48px 0;
		overflow: hidden;
		text-align: center;
		position: relative;
	}

	/* ── Centered copy block ────────────────────────────────────── */
	.hw-copy {
		max-width: 760px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 22px;
	}

	.hw-eyebrow {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 18px;
		font-weight: 700;
		color: var(--orange);
		display: block;
		letter-spacing: -0.01em;
	}

	.hw-headline {
		font-family: var(--font-display);
		font-size: clamp(54px, 7.5vw, 100px);
		font-weight: 900;
		line-height: 0.97;
		letter-spacing: -0.04em;
		color: #0a0a0a;
		margin: 0;
	}
	.hw-headline em {
		font-style: italic;
		color: #0a0a0a;
	}

	.hw-sub {
		font-size: 17px;
		line-height: 1.65;
		color: rgba(10,10,10,0.45);
		max-width: 540px;
		margin: 4px 0 6px;
		font-weight: 400;
	}

	/* ── Pill + circle CTA ─────────────────────────────────────── */
	.hw-cta {
		display: inline-flex;
		align-items: center;
		border: 1.5px solid rgba(10,10,10,0.13);
		border-radius: 100px;
		overflow: hidden;
		text-decoration: none;
		background: #fff;
		transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
	}
	.hw-cta:hover {
		border-color: rgba(10,10,10,0.25);
		transform: translateY(-2px);
		box-shadow: 0 10px 32px rgba(10,10,10,0.09);
	}
	.hw-cta-text {
		padding: 11px 22px 11px 26px;
		font-size: 15px;
		font-weight: 600;
		color: #0a0a0a;
		font-family: var(--font-body);
		white-space: nowrap;
	}
	.hw-cta-circle {
		width: 42px; height: 42px;
		border-radius: 50%;
		background: var(--orange);
		color: #fff;
		display: flex; align-items: center; justify-content: center;
		margin: 3px;
		flex-shrink: 0;
		transition: background 0.2s, transform 0.2s;
	}
	.hw-cta:hover .hw-cta-circle {
		background: #ff7f50;
		transform: scale(1.08);
	}

	/* ── Fan gallery wrapper ────────────────────────────────────── */
	.hw-fan-wrap {
		position: relative;
		margin-top: 64px;
		padding-bottom: 80px;
		/* clip horizontal bleed of the outermost tilted cards */
		overflow: hidden;
	}

	.hw-fan {
		/* Shared vanishing point — all children rotate around the same Z-axis */
		/* Shared single vanishing point for the whole arc */
		perspective: 1100px;
		perspective-origin: 50% 50%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 430px;
		padding: 0 20px;
		box-sizing: border-box;
		transition: transform 0.12s linear;
		overflow: visible;
	}

	/* ── Individual fan cards ───────────────────────────────────── */
	.hw-card {
		flex: 0 0 178px;
		height: 310px;
		/* Large pill-like radius matching the reference */
		border-radius: 30px;
		overflow: hidden;
		border: 1px solid rgba(10,10,10,0.07);
		box-shadow:
			0 2px 12px rgba(10,10,10,0.05),
			0 16px 48px rgba(10,10,10,0.12);
		/* rotate from bottom-centre so all bases stay level */
		transform-origin: center bottom;
		/* smooth out the JS-driven carouselOffset sweeps */
		transition: transform 0.08s linear, box-shadow 0.3s;
		backface-visibility: hidden;
		will-change: transform;
	}
	.hw-card:hover {
		box-shadow:
			0 8px 32px rgba(10,10,10,0.12),
			0 32px 80px rgba(10,10,10,0.22);
		z-index: 20 !important;
	}
	.hw-card-img {
		width: 100%; height: 100%;
		object-fit: cover; display: block;
	}

	/* ── Labels row below fan ───────────────────────────────────── */
	.hw-labels {
		display: flex;
		gap: 56px;
		justify-content: center;
		margin-top: 28px;
		padding: 0 48px;
	}
	.hw-label { text-align: center; }
	.hw-label-num {
		display: block;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--orange);
		margin-bottom: 4px;
		letter-spacing: 0.04em;
	}
	.hw-label-text {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: rgba(10,10,10,0.45);
		font-family: var(--font-body);
		white-space: nowrap;
	}
</style>
