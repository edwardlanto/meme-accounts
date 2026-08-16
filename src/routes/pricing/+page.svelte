<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Check, Lock, ShieldCheck, Sparkles } from 'lucide-svelte';
	import { page } from '$app/stores';
	import MarketingNav from '$lib/components/MarketingNav.svelte';
	import MarketingFooter from '$lib/components/MarketingFooter.svelte';
	import BillingIntervalToggle from '$lib/components/marketing/BillingIntervalToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import { PLAN_CATALOG, PAID_PLAN_IDS, type PaidPlanId, type PlanId } from '$lib/pricing-catalog';
	import { initReveal } from '$lib/marketing/reveal';

	let interval = $state<'month' | 'year'>('month');
	let checkoutBusy = $state<PaidPlanId | null>(null);
	let checkoutError = $state<string | null>(null);

	const user = $derived($page.data.user);
	const yearlySave = 31;
	const paidPlans = PAID_PLAN_IDS;

	async function startCheckout(plan: PaidPlanId) {
		checkoutError = null;
		if (!user) {
			window.location.href = `/?auth=signup&next=${encodeURIComponent(`/checkout?plan=${plan}&interval=${interval}`)}`;
			return;
		}
		if (checkoutBusy === plan) return;
		checkoutBusy = plan;
		try {
			const res = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ plan, interval }),
			});
			const data = await res.json();
			if (!res.ok || !data?.ok || !data?.url) {
				checkoutError = data?.error ?? 'Could not start checkout';
				checkoutBusy = null;
				return;
			}
			window.location.href = data.url;
		} catch {
			checkoutError = 'Network error. Try again.';
			checkoutBusy = null;
		}
	}

	function priceLabel(plan: PlanId) {
		const p = PLAN_CATALOG[plan];
		if (plan === 'free') return { num: '0', per: '/mo' };
		if (interval === 'year') return { num: String(Math.round(p.yearly / 12)), per: '/mo · billed yearly' };
		return { num: String(p.monthly), per: '/mo' };
	}

	function checkoutLabel(plan: PaidPlanId) {
		if (checkoutBusy === plan) return 'Redirecting…';
		if (plan === 'creator') return user ? 'Choose Creator' : 'Start Creator';
		return `Choose ${PLAN_CATALOG[plan].name}`;
	}

	onMount(() => {
		initReveal();
		// Back/forward or a stuck Stripe redirect left busy=true and locked other CTAs.
		const resetBusy = () => {
			checkoutBusy = null;
		};
		window.addEventListener('pageshow', resetBusy);
		return () => window.removeEventListener('pageshow', resetBusy);
	});
</script>

<svelte:head>
	<title>Pricing | Meme Accounts</title>
	<meta name="description" content="Simple creator-first pricing. Start free with 5 carousels/month, upgrade to Creator at $24/mo when you grow." />
</svelte:head>

<div class="marketing-page">
	<MarketingNav />

	<section class="marketing-section pt-10 sm:pt-16">
		<div class="marketing-container">
			<div class="grid items-end gap-8 lg:grid-cols-2 lg:gap-10">
				<div class="min-w-0 lg:min-w-[28rem]">
					<p class="mk-eyebrow"><Sparkles size={12} class="inline" /> Pricing</p>
					<h1 class="mk-hero-title mk-hero-title--pricing text-left">
						<span class="mk-hero-line">Ship more posts.</span>
						<em class="mk-hero-accent mk-hero-line not-italic">Pay for what scales.</em>
					</h1>
					<p class="mk-hero-sub mx-0 text-left">
						Start free with 5 carousels per month. Upgrade when news-to-post, captions, and bulk workflows earn their keep.
					</p>
					<BillingIntervalToggle bind:interval savePercent={yearlySave} align="start" class="mk-pricing-toggle--hero" />
				</div>

				<aside class="mk-card mk-reveal min-w-0">
					<div class="mb-4 flex gap-3">
						<ShieldCheck size={18} class="shrink-0 text-[var(--mk-accent)]" />
						<div>
							<strong class="block text-sm">Stripe-secured checkout</strong>
							<span class="text-sm text-[var(--mk-text-2)]">Card data never touches our servers</span>
						</div>
					</div>
					<div class="flex gap-3">
						<Lock size={18} class="shrink-0 text-[var(--mk-accent)]" />
						<div>
							<strong class="block text-sm">Cancel anytime</strong>
							<span class="text-sm text-[var(--mk-text-2)]">Manage billing in one click from Settings</span>
						</div>
					</div>
				</aside>
			</div>
		</div>
	</section>

	{#if checkoutError}
		<div class="marketing-container pb-4">
			<p class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{checkoutError}</p>
		</div>
	{/if}

	<section class="marketing-section marketing-section--soft pb-20">
		<div class="marketing-container">
			<div class="mk-pricing-grid mk-pricing-grid--4">
				<article class="mk-price-card mk-reveal">
					<div class="mk-price-tier">{PLAN_CATALOG.free.name}</div>
					<div class="mk-price-amount">
						<span class="mk-price-num">${priceLabel('free').num}</span>
						<span class="mk-price-per">{priceLabel('free').per}</span>
					</div>
					<p class="mk-price-note">{PLAN_CATALOG.free.tagline}</p>
					<ul class="mk-price-list">
						{#each PLAN_CATALOG.free.features as item}
							<li><Check size={15} strokeWidth={2.5} class="mt-0.5 shrink-0 text-[var(--mk-accent)]" />{item}</li>
						{/each}
					</ul>
					<Button href={user ? '/dashboard' : '/?auth=signup'} variant="outline" size="marketing" class="mk-price-cta">
						{user ? 'Open studio' : 'Start free'}
					</Button>
				</article>

				{#each paidPlans as planId, i}
					{@const p = PLAN_CATALOG[planId]}
					<article
						class="mk-price-card mk-reveal {planId === 'creator' ? 'mk-price-card--featured' : ''}"
						style="--mk-delay:{0.08 * (i + 1)}s"
					>
						{#if planId === 'creator'}
							<div class="mk-price-badge">Most popular</div>
						{/if}
						<div class="mk-price-tier">{p.name}</div>
						<div class="mk-price-amount">
							<span class="mk-price-num">${priceLabel(planId).num}</span>
							<span class="mk-price-per">{priceLabel(planId).per}</span>
						</div>
						<p class="mk-price-note">
							{interval === 'year' ? `Billed $${p.yearly}/year · cancel anytime` : p.tagline}
						</p>
						<ul class="mk-price-list">
							{#each p.features as item}
								<li><Check size={15} strokeWidth={2.5} class="mt-0.5 shrink-0 text-[var(--mk-accent)]" />{item}</li>
							{/each}
						</ul>
						<Button
							size="marketing"
							variant={planId === 'creator' ? 'default' : 'outline'}
							class="mk-price-cta"
							disabled={checkoutBusy === planId}
							onclick={() => startCheckout(planId)}
						>
							{checkoutLabel(planId)}
							{#if planId === 'creator'}
								<ArrowRight size={16} />
							{/if}
						</Button>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<MarketingFooter />
</div>
