<script lang="ts">
	import { onMount } from 'svelte';
	import { Zap, TrendingUp, Layers, ArrowRight, Play, Star, ChevronRight, Sparkles, Target, RefreshCw } from 'lucide-svelte';
	import ThreeHero from '$lib/ThreeHero.svelte';

	let heroVisible = $state(false);
	let statsVisible = $state(false);

	onMount(() => {
		setTimeout(() => heroVisible = true, 100);
		const observer = new IntersectionObserver((entries) => {
			entries.forEach(e => { if (e.isIntersecting) statsVisible = true; });
		}, { threshold: 0.3 });
		const statsEl = document.getElementById('stats');
		if (statsEl) observer.observe(statsEl);
	});

	const stats = [
		{ value: '2.3M+', label: 'Posts Analyzed' },
		{ value: '94%', label: 'Avg Engagement Lift' },
		{ value: '12x', label: 'Faster Than Manual' },
		{ value: '8,400+', label: 'Creators Trust Us' },
	];

	const features = [
		{
			icon: Target,
			color: 'violet',
			title: 'Viral Discovery Engine',
			desc: 'Our Apify pipeline scrapes top creators in your niche. AI reverse-engineers exactly what made each post explode—hook structure, pacing, visual rhythm.',
			badge: 'Powered by Apify'
		},
		{
			icon: Sparkles,
			color: 'cyan',
			title: 'AI Hook Generator',
			desc: 'Claude 3.5 Sonnet analyzes your scraped posts and generates 10 remixed hooks per viral template. Copy the formula, not the content.',
			badge: 'Claude 3.5 Sonnet'
		},
		{
			icon: Layers,
			color: 'violet',
			title: 'Live Canvas Editor',
			desc: 'Drag-and-drop Svelte canvas editor with real-time preview. Apply scraped color palettes, fonts, and layouts to your carousels in seconds.',
			badge: 'Real-time'
		},
		{
			icon: RefreshCw,
			color: 'cyan',
			title: 'Style Extraction',
			desc: 'Drop any Instagram post URL. Our vision model pulls the exact color palette, typography, and layout grid — ready to apply to your next carousel.',
			badge: 'Vision AI'
		},
	];

	const steps = [
		{ n: '01', title: 'Track Competitors', desc: 'Add any Instagram handle. We scrape their top-performing posts automatically every 24 hours.' },
		{ n: '02', title: 'AI Deconstruction', desc: 'Claude analyzes each viral post: the hook type, emotional trigger, content structure, and visual style.' },
		{ n: '03', title: 'Remix & Publish', desc: 'Open the canvas editor, apply the winning formula to your brand, and schedule directly from the app.' },
	];

	const testimonials = [
		{ name: 'Mia Chen', handle: '@mia.creates', avatar: 'MC', text: 'I went from 200 to 12k followers in 6 weeks using Carousel Studio. The hook generator alone is worth 10x the price.', stars: 5, niche: 'Finance Creator' },
		{ name: 'Jordan Rivers', handle: '@jordanrivers', avatar: 'JR', text: 'The style extraction feature is insane. I analyzed 3 top creators and built a whole new brand identity in an afternoon.', stars: 5, niche: 'Fitness Coach' },
		{ name: 'Priya Sood', handle: '@priyasood.co', avatar: 'PS', text: 'My agency manages 40 accounts. Carousel Studio cut our carousel production time from 3 hours to 20 minutes per client.', stars: 5, niche: 'Social Media Agency' },
	];
</script>

<div class="min-h-screen bg-[#0a0a0a] overflow-hidden">

	<!-- NAV -->
	<nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 glass border-b border-white/[0.04]">
		<div class="flex items-center gap-2.5">
			<div class="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center glow-violet">
				<Layers size={14} color="white" />
			</div>
			<span class="font-display font-bold text-base tracking-tight text-white">Carousel<span class="gradient-text">Studio</span></span>
		</div>

		<div class="hidden md:flex items-center gap-8 text-sm text-white/50 font-body">
			<a href="#features" class="hover:text-white transition-colors">Features</a>
			<a href="#how-it-works" class="hover:text-white transition-colors">How it works</a>
			<a href="#pricing" class="hover:text-white transition-colors">Pricing</a>
			<a href="#testimonials" class="hover:text-white transition-colors">Reviews</a>
		</div>

		<div class="flex items-center gap-3">
			<a href="/login" class="text-sm text-white/50 hover:text-white transition-colors hidden md:block font-body">Sign in</a>
			<a href="/signup" class="px-4 py-2 rounded-lg text-sm font-medium font-body text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-cyan-500 transition-all duration-300 glow-violet">
				Start free
			</a>
		</div>
	</nav>

	<!-- HERO -->
	<section class="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden">

		<!-- Three.js canvas -->
		<div class="absolute inset-0 z-0">
			<ThreeHero />
		</div>

		<!-- Grid overlay -->
		<div class="absolute inset-0 z-[1]"
			style="background-image: linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px); background-size: 60px 60px;">
		</div>

		<!-- Radial glow -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full z-[1] animate-pulse-glow"
			style="background: radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, rgba(6,182,212,0.06) 50%, transparent 70%);">
		</div>

		<!-- Content -->
		<div class="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto"
			style="opacity: {heroVisible ? 1 : 0}; transition: opacity 0.8s ease, transform 0.8s ease; transform: {heroVisible ? 'translateY(0)' : 'translateY(24px)'}">

			<!-- Badge -->
			<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-violet-500/20 mb-8">
				<div class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
				<span class="text-xs font-mono text-cyan-400 tracking-widest uppercase">AI-Powered Instagram Growth</span>
			</div>

			<!-- Headline -->
			<h1 class="font-display font-extrabold text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6">
				<span class="text-white">Steal the</span><br/>
				<span class="gradient-text">viral formula.</span><br/>
				<span class="text-white/70" style="font-size: 0.85em">Make it yours.</span>
			</h1>

			<!-- Subhead -->
			<p class="font-body text-lg md:text-xl text-white/50 max-w-2xl mb-10 leading-relaxed">
				Carousel Studio reverse-engineers top Instagram carousels using AI — extracting hooks, color palettes, and content structures — so you can remix them into your own viral posts in minutes.
			</p>

			<!-- CTAs -->
			<div class="flex flex-col sm:flex-row items-center gap-4 mb-16">
				<a href="/signup" class="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold font-body text-white bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-500 hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] transition-all duration-300">
					Start for free
					<ArrowRight size={16} class="group-hover:translate-x-1 transition-transform" />
				</a>
				<button class="group flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-body text-white/70 hover:text-white glass glass-hover transition-all duration-300">
					<div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
						<Play size={10} fill="currentColor" />
					</div>
					Watch demo
				</button>
			</div>

			<!-- Social proof strip -->
			<div class="flex items-center gap-4 text-sm text-white/30 font-body">
				<div class="flex -space-x-2">
					{#each ['MK','SL','JD','AR','TR'] as init}
						<div class="w-7 h-7 rounded-full glass border border-white/10 flex items-center justify-center text-[9px] font-bold text-violet-400">
							{init}
						</div>
					{/each}
				</div>
				<span>Joined by <strong class="text-white/60">8,400+</strong> creators this month</span>
			</div>
		</div>

		<!-- Scroll cue -->
		<div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-40">
			<div class="w-[1px] h-10 bg-gradient-to-b from-transparent to-violet-500 animate-pulse"></div>
		</div>
	</section>

	<!-- STATS BAR -->
	<section id="stats" class="relative z-10 border-y border-white/[0.05] glass">
		<div class="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
			{#each stats as stat, i}
				<div class="flex flex-col items-center text-center"
					style="opacity: {statsVisible ? 1 : 0}; transform: {statsVisible ? 'translateY(0)' : 'translateY(16px)'}; transition: opacity 0.5s ease {i * 0.1}s, transform 0.5s ease {i * 0.1}s">
					<span class="font-display font-extrabold text-3xl md:text-4xl gradient-text mb-1">{stat.value}</span>
					<span class="font-body text-xs text-white/40 uppercase tracking-wider">{stat.label}</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- FEATURES -->
	<section id="features" class="relative z-10 py-28 px-6">
		<div class="max-w-6xl mx-auto">
			<div class="text-center mb-16">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-white/[0.06] mb-5">
					<Zap size={11} class="text-violet-400" />
					<span class="text-xs font-mono text-white/40 uppercase tracking-widest">The Stack</span>
				</div>
				<h2 class="font-display font-bold text-4xl md:text-5xl text-white mb-4">Everything you need to<br/><span class="gradient-text">dominate your niche</span></h2>
				<p class="font-body text-white/40 max-w-xl mx-auto">A complete pipeline from competitor research to polished, published carousel — powered by real scraping and real AI.</p>
			</div>

			<div class="grid md:grid-cols-2 gap-4">
				{#each features as f}
					<div class="group relative p-7 rounded-2xl glass glass-hover transition-all duration-300 cursor-default overflow-hidden">
						<div class="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
							style="background: radial-gradient(ellipse, rgba({f.color === 'violet' ? '139,92,246' : '6,182,212'},0.15) 0%, transparent 70%)">
						</div>

						<div class="flex items-start gap-4">
							<div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {f.color === 'violet' ? 'bg-violet-500/15 text-violet-400' : 'bg-cyan-500/15 text-cyan-400'}">
								{#if f.icon === Target}<Target size={18} />{:else if f.icon === Sparkles}<Sparkles size={18} />{:else if f.icon === Layers}<Layers size={18} />{:else}<RefreshCw size={18} />{/if}
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2 mb-2">
									<h3 class="font-display font-semibold text-base text-white">{f.title}</h3>
									<span class="text-[10px] font-mono px-2 py-0.5 rounded-full {f.color === 'violet' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}">
										{f.badge}
									</span>
								</div>
								<p class="font-body text-sm text-white/45 leading-relaxed">{f.desc}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section id="how-it-works" class="relative z-10 py-28 px-6 border-t border-white/[0.04]">
		<div class="max-w-5xl mx-auto">
			<div class="text-center mb-16">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-white/[0.06] mb-5">
					<TrendingUp size={11} class="text-cyan-400" />
					<span class="text-xs font-mono text-white/40 uppercase tracking-widest">The Process</span>
				</div>
				<h2 class="font-display font-bold text-4xl md:text-5xl text-white mb-4">From <span class="gradient-text">zero to viral</span><br/>in three steps</h2>
			</div>

			<div class="grid md:grid-cols-3 gap-6 relative">
				<div class="absolute top-10 left-[20%] right-[20%] h-[1px] hidden md:block"
					style="background: linear-gradient(90deg, transparent, rgba(139,92,246,0.4) 30%, rgba(6,182,212,0.4) 70%, transparent)">
				</div>

				{#each steps as step}
					<div class="relative p-8 rounded-2xl glass glass-hover transition-all duration-300 text-center group">
						<div class="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center border border-white/[0.06] glass group-hover:border-violet-500/30 transition-colors">
							<span class="font-mono text-2xl font-bold gradient-text">{step.n}</span>
						</div>
						<h3 class="font-display font-semibold text-lg text-white mb-3">{step.title}</h3>
						<p class="font-body text-sm text-white/40 leading-relaxed">{step.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- TESTIMONIALS -->
	<section id="testimonials" class="relative z-10 py-28 px-6 border-t border-white/[0.04]">
		<div class="max-w-6xl mx-auto">
			<div class="text-center mb-16">
				<h2 class="font-display font-bold text-4xl md:text-5xl text-white mb-4">Creators are <span class="gradient-text">already winning</span></h2>
			</div>

			<div class="grid md:grid-cols-3 gap-5">
				{#each testimonials as t}
					<div class="p-7 rounded-2xl glass glass-hover transition-all duration-300 flex flex-col gap-5">
						<div class="flex gap-0.5">
							{#each Array(t.stars) as _}
								<Star size={12} fill="#8B5CF6" stroke="none" />
							{/each}
						</div>
						<p class="font-body text-sm text-white/60 leading-relaxed flex-1">"{t.text}"</p>
						<div class="flex items-center gap-3">
							<div class="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center text-xs font-bold font-mono text-white/70">
								{t.avatar}
							</div>
							<div>
								<p class="font-display font-semibold text-sm text-white">{t.name}</p>
								<p class="font-mono text-xs text-white/30">{t.niche} · {t.handle}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- PRICING -->
	<section id="pricing" class="relative z-10 py-28 px-6 border-t border-white/[0.04]">
		<div class="max-w-4xl mx-auto">
			<div class="text-center mb-16">
				<h2 class="font-display font-bold text-4xl md:text-5xl text-white mb-4">Simple, <span class="gradient-text">creator-first</span> pricing</h2>
				<p class="font-body text-white/40">Start free. Scale when you grow.</p>
			</div>

			<div class="grid md:grid-cols-3 gap-5">
				<div class="p-7 rounded-2xl glass border border-white/[0.06] flex flex-col gap-5">
					<div>
						<p class="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">Free</p>
						<div class="flex items-end gap-1 mb-1">
							<span class="font-display font-extrabold text-4xl text-white">$0</span>
							<span class="font-body text-white/30 mb-1.5">/mo</span>
						</div>
						<p class="font-body text-xs text-white/30">Forever free, no card needed</p>
					</div>
					<ul class="flex flex-col gap-2.5 flex-1">
						{#each ['5 carousels/month', '3 competitor tracks', 'AI hook suggestions', 'Basic canvas editor'] as item}
							<li class="flex items-center gap-2 text-sm font-body text-white/50">
								<ChevronRight size={12} class="text-violet-400 shrink-0" />
								{item}
							</li>
						{/each}
					</ul>
					<a href="/signup" class="w-full text-center py-2.5 rounded-lg text-sm font-semibold font-body text-white/60 glass glass-hover border border-white/[0.06] transition-all">
						Get started
					</a>
				</div>

				<div class="relative p-7 rounded-2xl border border-violet-500/30 flex flex-col gap-5 glow-violet"
					style="background: linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(6,182,212,0.04) 100%)">
					<div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-white bg-gradient-to-r from-violet-600 to-cyan-500 uppercase tracking-widest">
						Most Popular
					</div>
					<div>
						<p class="font-mono text-xs text-violet-400 uppercase tracking-wider mb-3">Pro</p>
						<div class="flex items-end gap-1 mb-1">
							<span class="font-display font-extrabold text-4xl text-white">$29</span>
							<span class="font-body text-white/30 mb-1.5">/mo</span>
						</div>
						<p class="font-body text-xs text-white/30">Billed monthly, cancel anytime</p>
					</div>
					<ul class="flex flex-col gap-2.5 flex-1">
						{#each ['Unlimited carousels', '25 competitor tracks', 'Claude 3.5 Sonnet AI', 'Full canvas editor', 'Style extraction (vision AI)', 'Direct scheduling'] as item}
							<li class="flex items-center gap-2 text-sm font-body text-white/70">
								<ChevronRight size={12} class="text-cyan-400 shrink-0" />
								{item}
							</li>
						{/each}
					</ul>
					<a href="/signup" class="w-full text-center py-2.5 rounded-lg text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all">
						Start Pro free
					</a>
				</div>

				<div class="p-7 rounded-2xl glass border border-white/[0.06] flex flex-col gap-5">
					<div>
						<p class="font-mono text-xs text-white/30 uppercase tracking-wider mb-3">Agency</p>
						<div class="flex items-end gap-1 mb-1">
							<span class="font-display font-extrabold text-4xl text-white">$99</span>
							<span class="font-body text-white/30 mb-1.5">/mo</span>
						</div>
						<p class="font-body text-xs text-white/30">For teams managing multiple brands</p>
					</div>
					<ul class="flex flex-col gap-2.5 flex-1">
						{#each ['Everything in Pro', 'Unlimited accounts', 'Team workspace', 'White-label export', 'Priority Apify scraping', 'API access'] as item}
							<li class="flex items-center gap-2 text-sm font-body text-white/50">
								<ChevronRight size={12} class="text-violet-400 shrink-0" />
								{item}
							</li>
						{/each}
					</ul>
					<a href="/signup" class="w-full text-center py-2.5 rounded-lg text-sm font-semibold font-body text-white/60 glass glass-hover border border-white/[0.06] transition-all">
						Contact us
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA BANNER -->
	<section class="relative z-10 py-24 px-6 border-t border-white/[0.04]">
		<div class="max-w-3xl mx-auto text-center">
			<div class="relative p-12 rounded-3xl overflow-hidden glass border border-violet-500/15">
				<div class="absolute inset-0 opacity-20"
					style="background: radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(6,182,212,0.3) 0%, transparent 60%)">
				</div>
				<div class="relative z-10">
					<h2 class="font-display font-extrabold text-4xl md:text-5xl text-white mb-4">
						Ready to go <span class="gradient-text">viral?</span>
					</h2>
					<p class="font-body text-white/40 mb-8 max-w-md mx-auto">Join 8,400+ creators already using the AI-powered edge to grow faster than their competitors.</p>
					<a href="/signup" class="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold font-body text-white bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-500 hover:shadow-[0_0_50px_rgba(139,92,246,0.4)] transition-all duration-300">
						Get started free — no card needed
						<ArrowRight size={16} />
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- FOOTER -->
	<footer class="relative z-10 border-t border-white/[0.04] px-6 py-10">
		<div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<div class="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
					<Layers size={11} color="white" />
				</div>
				<span class="font-display font-bold text-sm text-white/60">Carousel<span class="gradient-text">Studio</span></span>
			</div>
			<p class="font-mono text-xs text-white/20">© 2026 Carousel Studio. Built with SvelteKit + Claude AI.</p>
			<div class="flex gap-6 text-xs font-body text-white/30">
				<a href="/privacy" class="hover:text-white/60 transition-colors">Privacy</a>
				<a href="/terms" class="hover:text-white/60 transition-colors">Terms</a>
				<a href="/docs" class="hover:text-white/60 transition-colors">Docs</a>
			</div>
		</div>
	</footer>

</div>
