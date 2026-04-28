<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Check, Zap, TrendingUp, Globe, Sparkles } from 'lucide-svelte';
	import ArcGalleryHero from '$lib/components/ArcGalleryHero.svelte';
	import MultiOrbitSemiCircle from '../lib/components/MultiOrbitSemiCircle.svelte';
	import CtaWithMarquee from '$lib/components/CtaWithMarquee.svelte';

	let mounted = $state(false);
	let scrollY = $state(0);
	const memoryImages = [
		'https://images.unsplash.com/photo-1755004609214-c252674df1ca?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1750218537952-0ae056c7f53a?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1755038995605-038a7345658f?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1546238232-20216dec9f72?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1753724223372-9a1df8eb5212?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1754079132860-5b37dab49daa?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1754079132962-2f6c62f14d33?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1754764987594-2236e7736115?q=80&w=400&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1755048796967-75a82d214846?q=80&w=400&auto=format&fit=crop',
	];

	const words = ['Schedule.', 'Analyze.', 'Discover.', 'Grow.', 'Repeat.'];
	let wordIdx = $state(0);
	let wordVisible = $state(true);

	// (Hero now uses ArcGalleryHero)

	const platforms = [
		{ name: 'Instagram',   color: '#E1306C', icon: 'instagram' },
		{ name: 'TikTok',      color: '#010101', icon: 'tiktok'    },
		{ name: 'Facebook',    color: '#1877F2', icon: 'facebook'  },
		{ name: 'LinkedIn',    color: '#0A66C2', icon: 'linkedin'  },
		{ name: 'X / Twitter', color: '#000000', icon: 'x'         },
		{ name: 'YouTube',     color: '#FF0000', icon: 'youtube'   },
		{ name: 'Reddit',      color: '#FF4500', icon: 'reddit',    abbr: 'R'  },
		{ name: 'Pinterest',   color: '#E60023', icon: 'pinterest', abbr: 'P'  },
		{ name: 'Threads',     color: '#111111', icon: 'threads',   abbr: 'Th' },
		{ name: 'Snapchat',    color: '#FFFC00', icon: 'snapchat',  abbr: 'Sc' },
		{ name: 'Bluesky',     color: '#0085FF', icon: 'bluesky',   abbr: 'B'  },
		{ name: 'Google Business', color: '#34A853', icon: 'gmb',   abbr: 'G'  },
	];

	const features = [
		{ n: '01', title: 'Viral Discovery',    desc: 'Track any creator. AI reverse-engineers exactly what made each post explode.',  tag: 'Apify + Claude'      },
		{ n: '02', title: 'News to Post',        desc: 'Pull breaking news, rewrite into punchy captions, generate images — one click.', tag: 'TheNewsAPI + Imagen' },
		{ n: '03', title: 'AI Hook Generator',   desc: 'Claude analyzes viral hooks from your niche and generates 10 remixed versions.', tag: 'Claude 3.5 Sonnet'   },
		{ n: '04', title: 'Carousel Editor',     desc: 'Build multi-slide carousels with a live canvas editor. Export 1080×1350 PNGs.',  tag: 'Export-ready'        },
	];

	const testimonials = [
		{ name: 'Mia Chen',      handle: '@mia.creates',  initials: 'MC', text: 'I went from 200 to 12k followers in 6 weeks. The hook generator alone is worth 10× the price.', niche: 'Finance Creator',     color: '#8B5CF6' },
		{ name: 'Jordan Rivers', handle: '@jordanrivers', initials: 'JR', text: 'The news-to-post feature is insane. Fresh content every morning in under 2 minutes.',            niche: 'Fitness Coach',       color: '#06B6D4' },
		{ name: 'Priya Sood',    handle: '@priyasood.co', initials: 'PS', text: 'My agency manages 40 accounts. Cut our production time from 3 hours to 20 minutes.',             niche: 'Social Media Agency', color: '#E8FF48' },
	];

	const marqueeItems = ['Schedule', 'Discover', 'Analyze', 'Create', 'Export', 'Grow', 'Repeat'];

	const steps = [
		{ n: '01', title: 'Track Competitors', desc: 'Add any Instagram handle. We scrape their top-performing posts and rank by engagement.' },
		{ n: '02', title: 'AI Deconstruction', desc: 'Claude analyzes each viral post — hook type, emotional trigger, content structure.' },
		{ n: '03', title: 'Create & Schedule', desc: 'Remix the winning formula for your brand and export or schedule directly from the app.' },
	];

	// (Hero visuals now handled by ArcGalleryHero)

	onMount(() => {
		mounted = true;
		window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

		const cycle = setInterval(() => {
			wordVisible = false;
			setTimeout(() => { wordIdx = (wordIdx + 1) % words.length; wordVisible = true; }, 350);
		}, 2400);

		// Scroll-reveal — only on .reveal elements, not section wrappers
		const io = new IntersectionObserver((entries) => {
			entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
		}, { threshold: 0.06, rootMargin: '0px 0px -20px 0px' });
		const revealEls = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
		revealEls.forEach((el) => io.observe(el));
		// Ensure above-the-fold hero content is visible immediately even if
		// IntersectionObserver callbacks are delayed (Safari/WebKit can be flaky on first paint).
		requestAnimationFrame(() => {
			for (const el of revealEls) {
				const r = el.getBoundingClientRect();
				if (r.top < window.innerHeight * 0.92 && r.bottom > 0) el.classList.add('visible');
			}
		});

		return () => { clearInterval(cycle); io.disconnect(); };
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,700;1,9..144,900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="root" class:mounted>
	<div class="noise"></div>

	<!-- NAV -->
	<nav class="nav" class:scrolled={scrollY > 40}>
		<a href="/" class="logo">
			<span class="logo-mark">CS</span>
			<span class="logo-text">Carousel<em>Studio</em></span>
		</a>
		<div class="nav-links">
			<a href="#features">Features</a>
			<a href="#how">How it works</a>
			<a href="#pricing">Pricing</a>
		</div>
		<div class="nav-actions">
			<a href="/login" class="nav-signin">Sign in</a>
			<a href="/signup" class="btn-cta-nav">Start free →</a>
		</div>
	</nav>

	<!-- ═══════════════════════════════════════════════════════
	     ACT 1 — HERO  (Rocket.com-style)
	═══════════════════════════════════════════════════════ -->
	<section class="hero-white">
		<ArcGalleryHero images={memoryImages} className="hero-arc-gallery" />
	</section>

	<!-- MARQUEE — chapter break -->
	<div class="marquee-wrap">
		<div class="marquee-track">
			{#each [...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems] as item, i}
				<span class="marquee-item">{item}</span>
				{#if i % 2 === 0}<span class="marquee-sep"><span class="marquee-dot">✦</span></span>{/if}
			{/each}
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════════
	     ACT 2 — DARK  (Krea.ai: glassmorphism, bento, depth)
	═══════════════════════════════════════════════════════ -->

	<!-- INTEGRATIONS (replaces old Supported Platforms section) -->
	<MultiOrbitSemiCircle items={platforms} />
	<CtaWithMarquee />

	<!-- FEATURES BENTO -->
	<section id="features" class="section-dark section-pad">
		<div class="container">
			<div class="section-header reveal">
				<span class="eyebrow-lime">The Toolkit</span>
				<h2 class="title-dark">Everything you need<br/><em>to dominate your niche.</em></h2>
			</div>
			<div class="bento-features">
				{#each features as f, i}
					<div class="bento-feat reveal" style="--delay:{i * 0.1}s">
						<div class="bf-accent"></div>
						<div class="bf-num">{f.n}</div>
						<div class="bf-body">
							<div class="bf-top">
								<h3 class="bf-title">{f.title}</h3>
								<span class="bf-tag">{f.tag}</span>
							</div>
							<p class="bf-desc">{f.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- STATS BENTO -->
	<section class="section-surface section-pad">
		<div class="container">
			<div class="stats-bento">
				<div class="stat-cell stat-big reveal">
					<p class="stat-eyebrow">Posts analyzed by AI</p>
					<span class="stat-num">2.3M+</span>
					<p class="stat-sub">and counting, every week</p>
				</div>
				<div class="stat-cell reveal" style="--delay:0.08s">
					<span class="stat-num stat-md">94%</span>
					<p class="stat-label">avg engagement lift</p>
				</div>
				<div class="stat-cell reveal" style="--delay:0.16s">
					<span class="stat-num stat-md">12×</span>
					<p class="stat-label">faster than manual creation</p>
				</div>
				<div class="stat-cell stat-quote-cell reveal" style="--delay:0.1s">
					<div class="stat-stars">★★★★★</div>
					<p class="stat-quote">"The best investment I made for my content business this year."</p>
					<div class="stat-author">
						<div class="stat-avatar">JR</div>
						<div>
							<p class="stat-name">Jordan Rivers</p>
							<p class="stat-handle">@jordanrivers · Fitness Coach</p>
						</div>
					</div>
				</div>
				<div class="stat-cell stat-platforms-cell reveal" style="--delay:0.18s">
					<p class="stat-label" style="margin-bottom:14px">Platforms supported</p>
					<div class="stat-platform-pills">
						{#each ['IG', 'TK', 'FB', 'LI', 'YT', 'X'] as p}
							<span class="stat-pill">{p}</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section id="how" class="section-dark section-pad">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-mono">The Process</span>
				<h2 class="title-dark">From zero to viral<br/><em>in three steps.</em></h2>
			</div>
			<div class="steps-row">
				{#each steps as step, i}
					<div class="step-card reveal" style="--delay:{i * 0.12}s">
						<div class="step-num-wrap">
							<span class="step-num">{step.n}</span>
						</div>
						{#if i < steps.length - 1}
							<div class="step-arrow">→</div>
						{/if}
						<h3 class="step-title">{step.title}</h3>
						<p class="step-desc">{step.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- TESTIMONIALS -->
	<section class="section-surface section-pad">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-lime">Social Proof</span>
				<h2 class="title-dark">Creators are<br/><em>already winning.</em></h2>
			</div>
			<div class="testimonials-grid">
				{#each testimonials as t, i}
					<div class="t-card reveal" style="--color:{t.color}; --delay:{i * 0.1}s">
						<div class="t-quote-glyph">"</div>
						<p class="t-text">{t.text}</p>
						<div class="t-author">
							<div class="t-avatar" style="background:{t.color}22; border-color:{t.color}55; color:{t.color}">{t.initials}</div>
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

	<!-- PRICING -->
	<section id="pricing" class="section-dark section-pad">
		<div class="container">
			<div class="section-header center reveal">
				<span class="eyebrow-mono">Pricing</span>
				<h2 class="title-dark">Simple,<br/><em>creator-first pricing.</em></h2>
				<p class="body-muted">Start free. Scale when you grow.</p>
			</div>
			<div class="pricing-grid">
				<div class="price-card reveal">
					<div class="price-tier">Free</div>
					<div class="price-amount">
						<span class="price-num">$0</span>
						<span class="price-per">/mo</span>
					</div>
					<p class="price-note">No card needed. Forever free.</p>
					<ul class="price-list">
						{#each ['5 carousels/month', '3 competitor tracks', 'AI hook suggestions', 'Basic canvas editor'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-glass">Get started</a>
				</div>

				<div class="price-card price-featured reveal" style="--delay:0.08s">
					<div class="price-badge">Most popular</div>
					<div class="price-tier" style="color:#0a0a0a">Pro</div>
					<div class="price-amount">
						<span class="price-num" style="color:#0a0a0a">$29</span>
						<span class="price-per" style="color:rgba(10,10,10,0.45)">/mo</span>
					</div>
					<p class="price-note" style="color:rgba(10,10,10,0.5)">Cancel anytime.</p>
					<ul class="price-list price-list--dark">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'News-to-Post (Vertex AI)', 'Full canvas + export', 'Style extraction'] as item}
							<li><span class="price-check" style="color:#0a0a0a">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-dark-solid">Start Pro free</a>
				</div>

				<div class="price-card reveal" style="--delay:0.16s">
					<div class="price-tier">Agency</div>
					<div class="price-amount">
						<span class="price-num">$99</span>
						<span class="price-per">/mo</span>
					</div>
					<p class="price-note">For teams managing multiple brands.</p>
					<ul class="price-list">
						{#each ['Everything in Pro', 'Unlimited accounts', 'Team workspace', 'White-label export', 'API access'] as item}
							<li><span class="price-check">✓</span>{item}</li>
						{/each}
					</ul>
					<a href="/signup" class="btn-outline-glass">Contact us</a>
				</div>
			</div>
		</div>
	</section>

	<!-- FINAL CTA -->
	<section class="cta-section">
		<div class="cta-orb"></div>
		<div class="cta-inner reveal">
			<span class="eyebrow-lime">✦ Ready?</span>
			<h2 class="cta-headline">
				Stop watching others go viral.<br/>
				<em>Start your free account today.</em>
			</h2>
			<a href="/signup" class="btn-lime-xl">
				Get started free — no card needed
				<ArrowRight size={20} />
			</a>
			<div class="cta-platforms">
				<span class="cta-label">Works with</span>
				<div class="cta-platform-tags">
					{#each ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube'] as name}
						<span class="cta-tag">{name}</span>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="footer">
		<div class="footer-inner">
			<div class="footer-brand">
				<a href="/" class="logo">
					<span class="logo-mark">CS</span>
					<span class="logo-text" style="color:var(--d-text)">Carousel<em style="color:var(--lime)">Studio</em></span>
				</a>
				<p class="footer-tag">AI-powered content for serious social creators.</p>
			</div>
			<div class="footer-cols">
				<div class="footer-col">
					<p class="footer-col-title">Product</p>
					<a href="#features">Features</a>
					<a href="#pricing">Pricing</a>
					<a href="/dashboard">Dashboard</a>
				</div>
				<div class="footer-col">
					<p class="footer-col-title">Platforms</p>
					<a href="#">Instagram</a>
					<a href="#">TikTok</a>
					<a href="#">LinkedIn</a>
				</div>
				<div class="footer-col">
					<p class="footer-col-title">Legal</p>
					<a href="/privacy">Privacy</a>
					<a href="/terms">Terms</a>
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
/* ════════════════════════════════════════════════════════════
   TOKENS
════════════════════════════════════════════════════════════ */
:root {
	--lime:    #E8FF48;
	--orange:  #FF6B35;
	--dark:    #080808;
	--surface: #0f0f0f;
	--s2:      #1a1a1a;
	--cream:   #F5F0E6;
	--light:   #ffffff;

	--d-text:   #F0EDE8;
	--d-muted:  rgba(240,237,232,0.55);
	--d-dim:    rgba(240,237,232,0.28);
	--d-border: rgba(255,255,255,0.07);

	--l-text:   #0a0505;
	--l-muted:  rgba(10,5,5,0.5);
	--l-dim:    rgba(10,5,5,0.28);

	--font-display: 'Fraunces', Georgia, serif;
	--font-body:    'DM Sans', sans-serif;
	--font-mono:    'Space Mono', monospace;

	--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ════════════════════════════════════════════════════════════
   BASE
════════════════════════════════════════════════════════════ */
.root {
	font-family: var(--font-body);
	overflow-x: hidden;
	/* Don't hide the entire page before hydration. */
	opacity: 1;
}
.root.mounted { opacity: 1; }

.noise {
	position: fixed; inset: 0; pointer-events: none; z-index: 900; opacity: 0.02;
	background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
	background-size: 256px;
}

.container { max-width: 1160px; margin: 0 auto; padding: 0 48px; }

/* ════════════════════════════════════════════════════════════
   SCROLL REVEAL  — only on child elements, never section wrappers
════════════════════════════════════════════════════════════ */
.reveal {
	/* Never hide content by default (prevents blank page if IO/hydration misbehaves). */
	opacity: 1;
	transform: none;
}
/* Reveal no longer uses a hidden state, so `.visible` is redundant. */

/* ════════════════════════════════════════════════════════════
   NAV
════════════════════════════════════════════════════════════ */
.nav {
	position: fixed; top: 0; left: 0; right: 0; z-index: 200;
	display: flex; align-items: center; justify-content: space-between;
	padding: 20px 48px;
	transition: all 0.3s ease;
}
.nav.scrolled {
	background: rgba(255,255,255,0.88);
	backdrop-filter: blur(24px);
	-webkit-backdrop-filter: blur(24px);
	border-bottom: 1px solid rgba(0,0,0,0.07);
	padding: 14px 48px;
	box-shadow: 0 1px 0 rgba(0,0,0,0.04);
}

.logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.logo-mark {
	width: 32px; height: 32px; background: var(--dark); color: #fff;
	border-radius: 8px; display: flex; align-items: center; justify-content: center;
	font-family: var(--font-mono); font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.logo-text {
	font-family: var(--font-display); font-size: 17px; font-weight: 700;
	color: var(--l-text); letter-spacing: -0.02em;
}
.logo-text em { font-style: italic; color: var(--orange); }

.nav-links { display: flex; gap: 36px; }
.nav-links a {
	font-size: 14px; color: var(--l-muted); text-decoration: none;
	font-weight: 500; transition: color 0.2s;
}
.nav-links a:hover { color: var(--l-text); }

.nav-actions { display: flex; align-items: center; gap: 16px; }
.nav-signin { font-size: 14px; color: var(--l-muted); text-decoration: none; transition: color 0.2s; }
.nav-signin:hover { color: var(--l-text); }
.btn-cta-nav {
	display: inline-flex; align-items: center;
	padding: 9px 22px; background: var(--dark); color: #fff;
	border-radius: 100px; font-size: 13px; font-weight: 600;
	font-family: var(--font-body); text-decoration: none; transition: all 0.2s;
}
.btn-cta-nav:hover { background: #222; transform: translateY(-1px); }

/* ════════════════════════════════════════════════════════════
   ACT 1 — WHITE HERO  (Arc gallery)
════════════════════════════════════════════════════════════ */
.hero-white {
	background: #fff;
	padding-top: 0;
	overflow: visible;
	position: relative;
}

/* Subtle grid texture */
.hero-white::before {
	content: '';
	position: absolute; inset: 0; pointer-events: none; z-index: 0;
	background-image:
		linear-gradient(rgba(0,0,0,0.022) 1px, transparent 1px),
		linear-gradient(90deg, rgba(0,0,0,0.022) 1px, transparent 1px);
	background-size: 40px 40px;
	mask-image: radial-gradient(ellipse 80% 70% at 50% 0%, black 20%, transparent 100%);
}

/* ════════════════════════════════════════════════════════════
   MARQUEE — chapter break
════════════════════════════════════════════════════════════ */
.marquee-wrap {
	overflow: hidden; background: var(--dark);
	border-top: 1px solid rgba(255,255,255,0.05);
	border-bottom: 1px solid rgba(255,255,255,0.05);
	padding: 18px 0;
}
.marquee-track {
	display: flex; width: max-content;
	animation: marquee 28s linear infinite;
}
@keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-25%)} }
.marquee-item {
	display: flex; align-items: center; gap: 18px;
	padding: 0 18px;
	font-family: var(--font-display); font-size: 18px;
	font-weight: 700; font-style: italic;
	color: #fff;
	white-space: nowrap;
}
.marquee-sep {
	width: 64px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
}
.marquee-dot {
	color: var(--lime);
	font-style: normal;
	font-size: 11px;
	/* Center the ✦ within the line box */
	display: inline-flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	transform: translateY(-0.03em);
}

/* ════════════════════════════════════════════════════════════
   SHARED DARK UTILITIES
════════════════════════════════════════════════════════════ */
.section-dark    { background: var(--dark); color: var(--d-text); }
.section-surface { background: var(--surface); color: var(--d-text); }
.section-pad     { padding: 100px 48px; }
.section-light { background: var(--light); color: var(--l-text); }

/* Light section overrides (re-use shared typography safely) */
.section-light .title-dark { color: var(--l-text); }
.section-light .title-dark em { color: var(--l-muted); }
.section-light .body-muted { color: var(--l-muted); }
.section-light .eyebrow-mono { color: rgba(10,5,5,0.42); }
.section-header { margin-bottom: 60px; }
.section-header.center { text-align: center; }
.section-header.center .body-muted { margin: 0 auto; }

.eyebrow-lime {
	display: inline-block; font-family: var(--font-mono);
	font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
	color: var(--lime); margin-bottom: 14px;
}
.eyebrow-mono {
	display: inline-block; font-family: var(--font-mono);
	font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
	color: var(--d-dim); margin-bottom: 14px;
}
.title-dark {
	font-family: var(--font-display);
	font-size: clamp(36px, 4.2vw, 56px);
	font-weight: 900; line-height: 1.05;
	letter-spacing: -0.03em; color: var(--d-text); margin: 0 0 20px;
}
.title-dark em { font-style: italic; color: var(--d-muted); }
.body-muted { font-size: 16px; line-height: 1.65; color: var(--d-muted); max-width: 480px; }

/* ════════════════════════════════════════════════════════════
   PLATFORMS
════════════════════════════════════════════════════════════ */
.platforms-section { padding: 80px 48px; }

/* Auto-moving platforms carousel */
/* (Old auto-marquee carousel styles removed — section now uses MultiOrbitSemiCircle) */

/* ════════════════════════════════════════════════════════════
   FEATURES BENTO
════════════════════════════════════════════════════════════ */
.bento-features {
	display: grid;
	grid-template-columns: 1.15fr 1fr;
	grid-template-rows: 1fr 1fr;
	gap: 14px;
}
.bento-feat:nth-child(1) { grid-row: span 2; }
.bento-feat:nth-child(4) { grid-column: span 2; }

.bento-feat {
	padding: 40px; border-radius: 22px;
	background: rgba(255,255,255,0.03);
	border: 1px solid rgba(255,255,255,0.07);
	display: flex; gap: 24px; align-items: flex-start;
	position: relative; overflow: hidden;
	transition: background 0.25s, border-color 0.25s;
}
.bento-feat:hover { background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.12); }

.bf-accent {
	position: absolute; top: -60px; right: -60px;
	width: 160px; height: 160px; border-radius: 50%;
	background: radial-gradient(circle, rgba(232,255,72,0.06) 0%, transparent 70%);
	pointer-events: none;
}
.bf-num {
	font-family: var(--font-display); font-size: 56px; font-weight: 900; font-style: italic;
	color: rgba(232,255,72,0.07); line-height: 1; min-width: 68px;
	transition: color 0.2s; flex-shrink: 0;
}
.bento-feat:hover .bf-num { color: rgba(232,255,72,0.3); }
.bf-body { flex: 1; }
.bf-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.bf-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--d-text); }
.bf-tag {
	font-family: var(--font-mono); font-size: 10px;
	padding: 3px 10px; border-radius: 100px;
	border: 1px solid var(--d-border); color: var(--d-dim);
}
.bf-desc { font-size: 14px; line-height: 1.7; color: var(--d-muted); margin: 0; }

/* ════════════════════════════════════════════════════════════
   STATS BENTO
════════════════════════════════════════════════════════════ */
.stats-bento {
	display: grid;
	grid-template-columns: 2fr 1fr 1fr;
	grid-template-rows: auto auto;
	gap: 14px;
}
.stat-cell {
	padding: 40px; border-radius: 22px;
	border: 1px solid var(--d-border);
	background: rgba(255,255,255,0.02);
	display: flex; flex-direction: column; gap: 8px;
}
.stat-big { background: rgba(255,255,255,0.04); }
.stat-quote-cell { grid-column: span 2; }

.stat-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--d-dim); margin: 0; }
.stat-num {
	font-family: var(--font-display); font-size: 72px; font-weight: 900;
	color: var(--lime); line-height: 1; display: block;
}
.stat-md { font-size: 56px; }
.stat-sub { font-size: 12px; color: var(--d-dim); font-family: var(--font-mono); margin: 0; }
.stat-label { font-size: 14px; color: var(--d-muted); margin: 0; }
.stat-stars { font-size: 14px; color: #FBBF24; letter-spacing: 2px; margin-bottom: 12px; }
.stat-quote {
	font-family: var(--font-display); font-size: 20px; font-style: italic;
	font-weight: 700; color: var(--d-text); line-height: 1.45; margin: 0 0 24px;
}
.stat-author { display: flex; align-items: center; gap: 12px; }
.stat-avatar {
	width: 36px; height: 36px; border-radius: 50%;
	background: var(--s2); display: flex; align-items: center; justify-content: center;
	font-family: var(--font-mono); font-size: 11px; color: var(--d-dim);
	border: 1px solid var(--d-border); flex-shrink: 0;
}
.stat-name { font-size: 13px; font-weight: 600; color: var(--d-muted); margin: 0 0 2px; }
.stat-handle { font-size: 11px; color: var(--d-dim); margin: 0; font-family: var(--font-mono); }
.stat-platform-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.stat-pill {
	padding: 4px 10px; border-radius: 6px;
	background: rgba(255,255,255,0.04); border: 1px solid var(--d-border);
	font-family: var(--font-mono); font-size: 10px; color: var(--d-dim);
}

/* ════════════════════════════════════════════════════════════
   HOW IT WORKS
════════════════════════════════════════════════════════════ */
.steps-row {
	display: grid; grid-template-columns: repeat(3,1fr);
	gap: 0; position: relative;
}
.step-card {
	padding: 48px 36px 48px 40px;
	border: 1px solid var(--d-border);
	border-right: none; position: relative;
	transition: background 0.2s;
}
.step-card:last-child { border-right: 1px solid var(--d-border); }
.step-card:hover { background: rgba(255,255,255,0.03); }
.step-arrow {
	position: absolute; top: 50%; right: -16px;
	font-size: 20px; color: var(--d-dim);
	transform: translateY(-50%); z-index: 2;
}
.step-num-wrap {
	width: 48px; height: 48px; border-radius: 12px;
	background: rgba(255,255,255,0.06); border: 1px solid var(--d-border);
	display: flex; align-items: center; justify-content: center;
	margin-bottom: 24px;
}
.step-num { font-family: var(--font-display); font-size: 16px; font-weight: 900; color: var(--d-muted); }
.step-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--d-text); margin-bottom: 12px; }
.step-desc { font-size: 14px; line-height: 1.7; color: var(--d-muted); margin: 0; }

/* ════════════════════════════════════════════════════════════
   TESTIMONIALS
════════════════════════════════════════════════════════════ */
.testimonials-grid {
	display: grid; grid-template-columns: repeat(3,1fr); gap: 16px;
}
.t-card {
	padding: 40px; border-radius: 22px;
	border: 1px solid var(--d-border);
	background: rgba(255,255,255,0.025);
	display: flex; flex-direction: column; gap: 20px;
	transition: border-color 0.25s, transform 0.25s, background 0.25s;
	position: relative; overflow: hidden;
}
.t-card::before {
	content: ''; position: absolute; top: -50px; right: -50px;
	width: 120px; height: 120px; border-radius: 50%;
	background: var(--color, transparent); opacity: 0.08;
}
.t-card:hover {
	border-color: color-mix(in srgb, var(--color) 30%, transparent);
	transform: translateY(-4px); background: rgba(255,255,255,0.04);
}
.t-quote-glyph {
	font-family: var(--font-display); font-size: 64px;
	font-weight: 900; line-height: 1; color: var(--color, var(--d-border));
	opacity: 0.35; height: 36px; display: block; margin-bottom: -14px;
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

/* ════════════════════════════════════════════════════════════
   PRICING
════════════════════════════════════════════════════════════ */
.pricing-grid {
	display: grid; grid-template-columns: repeat(3,1fr);
	gap: 16px; align-items: start;
}
.price-card {
	padding: 36px; border-radius: 22px;
	border: 1px solid var(--d-border);
	background: rgba(255,255,255,0.03);
	display: flex; flex-direction: column; gap: 20px;
	position: relative; transition: box-shadow 0.25s, transform 0.25s;
}
.price-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
.price-featured {
	background: var(--lime); border-color: transparent;
	box-shadow: 0 8px 40px rgba(232,255,72,0.25);
}
.price-badge {
	position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
	background: #0a0a0a; color: var(--lime);
	font-size: 10px; font-family: var(--font-mono); font-weight: 700;
	letter-spacing: 0.08em; text-transform: uppercase;
	padding: 4px 14px; border-radius: 100px; white-space: nowrap;
}
.price-tier {
	font-family: var(--font-mono); font-size: 11px;
	letter-spacing: 0.1em; text-transform: uppercase; color: var(--d-muted);
}
.price-amount { display: flex; align-items: baseline; gap: 4px; }
.price-num {
	font-family: var(--font-display); font-size: 52px; font-weight: 900;
	color: var(--d-text); letter-spacing: -0.03em;
}
.price-per { font-size: 16px; color: var(--d-dim); }
.price-note { font-size: 12px; color: var(--d-dim); margin: 0; }
.price-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.price-list li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--d-muted); }
.price-list--dark li { color: rgba(10,10,10,0.75); }
.price-check { font-size: 12px; font-weight: 700; color: var(--d-dim); flex-shrink: 0; }
.btn-outline-glass {
	display: block; text-align: center; padding: 13px 24px;
	border: 1px solid var(--d-border); border-radius: 12px;
	color: var(--d-muted); text-decoration: none;
	font-size: 14px; font-weight: 600;
	background: rgba(255,255,255,0.04); transition: all 0.2s;
}
.btn-outline-glass:hover { border-color: rgba(255,255,255,0.2); color: var(--d-text); }
.btn-dark-solid {
	display: block; text-align: center; padding: 13px 24px;
	background: #0a0a0a; color: #fff;
	border-radius: 12px; font-size: 14px; font-weight: 600;
	text-decoration: none; transition: all 0.2s;
}
.btn-dark-solid:hover { background: #1a1a1a; }

/* ════════════════════════════════════════════════════════════
   FINAL CTA
════════════════════════════════════════════════════════════ */
.cta-section {
	background: var(--dark); padding: 140px 48px;
	position: relative; overflow: hidden; text-align: center;
}
.cta-orb {
	position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
	width: 800px; height: 420px; border-radius: 50%;
	background: radial-gradient(ellipse, rgba(232,255,72,0.07), transparent 65%);
	pointer-events: none;
}
.cta-inner {
	max-width: 760px; margin: 0 auto; position: relative; z-index: 1;
	display: flex; flex-direction: column; align-items: center; gap: 32px;
}
.cta-headline {
	font-family: var(--font-display);
	font-size: clamp(36px, 4.5vw, 64px);
	font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
	color: var(--d-text); margin: 0;
}
.cta-headline em { font-style: italic; color: var(--lime); }
.btn-lime-xl {
	display: inline-flex; align-items: center; gap: 10px;
	padding: 20px 40px; background: var(--lime); color: #0a0a0a;
	border-radius: 16px; font-size: 17px; font-weight: 700;
	font-family: var(--font-body); text-decoration: none; transition: all 0.2s;
}
.btn-lime-xl:hover { background: #f0ff70; transform: translateY(-2px); box-shadow: 0 16px 48px rgba(232,255,72,0.3); }
.cta-platforms { display: flex; align-items: center; gap: 12px; }
.cta-label { font-size: 12px; color: var(--d-dim); font-family: var(--font-mono); }
.cta-platform-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.cta-tag {
	font-size: 11px; font-family: var(--font-mono); padding: 4px 10px;
	border-radius: 6px; border: 1px solid var(--d-border); color: var(--d-dim);
}

/* ════════════════════════════════════════════════════════════
   FOOTER
════════════════════════════════════════════════════════════ */
.footer {
	background: var(--dark); border-top: 1px solid var(--d-border);
	padding: 64px 48px 32px;
}
.footer-inner {
	max-width: 1160px; margin: 0 auto;
	display: grid; grid-template-columns: 1.4fr 1fr;
	gap: 80px; margin-bottom: 48px;
}
.footer-brand { display: flex; flex-direction: column; gap: 16px; }
.footer-tag { font-size: 14px; color: var(--d-muted); max-width: 280px; line-height: 1.6; }
.footer-cols { display: grid; grid-template-columns: repeat(3,1fr); gap: 40px; }
.footer-col { display: flex; flex-direction: column; gap: 12px; }
.footer-col-title {
	font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
	text-transform: uppercase; color: var(--d-dim); margin-bottom: 4px;
}
.footer-col a { font-size: 14px; color: var(--d-muted); text-decoration: none; transition: color 0.2s; }
.footer-col a:hover { color: var(--d-text); }
.footer-bottom {
	max-width: 1160px; margin: 0 auto;
	display: flex; justify-content: space-between; align-items: center;
	padding-top: 24px; border-top: 1px solid var(--d-border);
	font-size: 12px; color: var(--d-dim); font-family: var(--font-mono);
}

/* ════════════════════════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
	.nav-links { display: none; }
	.container { padding: 0 24px; }
	.section-pad { padding: 72px 24px; }
	.platforms-section { padding: 60px 24px; }
	.bento-features { grid-template-columns: 1fr; }
	.bento-feat:nth-child(1) { grid-row: auto; }
	.bento-feat:nth-child(4) { grid-column: auto; }
	.stats-bento { grid-template-columns: 1fr 1fr; }
	.stat-quote-cell { grid-column: span 2; }
	.steps-row { grid-template-columns: 1fr; }
	.step-card { border-right: 1px solid var(--d-border); border-bottom: none; }
	.step-card:last-child { border-bottom: 1px solid var(--d-border); }
	.step-arrow { display: none; }
	.testimonials-grid { grid-template-columns: 1fr; }
	.pricing-grid { grid-template-columns: 1fr; }
	.footer-inner { grid-template-columns: 1fr; gap: 40px; }
}

@media (max-width: 600px) {
	.nav { padding: 16px 24px; }
	.btn-cta-nav { display: none; }
	.hero-white { padding-top: 60px; }
	.stats-bento { grid-template-columns: 1fr; }
	.stat-quote-cell { grid-column: auto; }
	.footer-bottom { flex-direction: column; gap: 8px; text-align: center; }
}
</style>
