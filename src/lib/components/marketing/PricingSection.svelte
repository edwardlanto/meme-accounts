<script lang="ts">
	import { page } from '$app/stores';
	import { Check } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import BillingIntervalToggle from './BillingIntervalToggle.svelte';
	import { PLAN_CATALOG, PAID_PLAN_IDS, type PlanId } from '$lib/pricing-catalog';

	let {
		showToggle = true,
	}: {
		showToggle?: boolean;
	} = $props();

	let interval = $state<'month' | 'year'>('month');
	const user = $derived($page.data.user);
	const yearlySave = 31;

	function priceLabel(plan: PlanId) {
		const p = PLAN_CATALOG[plan];
		if (plan === 'free') return { num: '0', per: '/mo' };
		if (interval === 'year') {
			return { num: String(Math.round(p.yearly / 12)), per: '/mo · billed yearly' };
		}
		return { num: String(p.monthly), per: '/mo' };
	}

	function checkoutHref(planId: PlanId) {
		if (planId === 'free') return user ? '/dashboard' : '/?auth=signup';
		if (!user) return `/?auth=signup&next=${encodeURIComponent(`/checkout?plan=${planId}&interval=${interval}`)}`;
		return `/checkout?plan=${planId}&interval=${interval}`;
	}
</script>

{#if showToggle}
	<BillingIntervalToggle bind:interval savePercent={yearlySave} />
{/if}

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
		<Button href={checkoutHref('free')} variant="outline" size="marketing" class="mk-price-cta">
			{user ? 'Open studio' : 'Start free'}
		</Button>
	</article>

	{#each PAID_PLAN_IDS as planId, i}
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
				{#if interval === 'year'}
					Billed ${p.yearly}/year · cancel anytime
				{:else}
					{p.tagline}
				{/if}
			</p>
			<ul class="mk-price-list">
				{#each p.features as item}
					<li><Check size={15} strokeWidth={2.5} class="mt-0.5 shrink-0 text-[var(--mk-accent)]" />{item}</li>
				{/each}
			</ul>
			<Button
				href={checkoutHref(planId)}
				size="marketing"
				variant={planId === 'creator' ? 'default' : 'outline'}
				class="mk-price-cta"
			>
				{planId === 'creator' ? 'Choose Creator' : `Choose ${p.name}`}
			</Button>
		</article>
	{/each}
</div>
