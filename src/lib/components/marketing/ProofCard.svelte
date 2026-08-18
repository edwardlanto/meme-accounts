<script lang="ts">
	import { ArrowUpRight } from 'lucide-svelte';

	let {
		title,
		description = '',
		format,
		platform,
		formatLabel = 'Format',
		platformLabel = 'Platform',
		href = '',
		featured = false,
		wide = false,
		visual = '',
		index = '',
		class: className = '',
		delay = '0s',
	}: {
		title: string;
		description?: string;
		format: string;
		platform: string;
		formatLabel?: string;
		platformLabel?: string;
		href?: string;
		featured?: boolean;
		wide?: boolean;
		visual?: 'mix' | '';
		index?: string;
		class?: string;
		delay?: string;
	} = $props();
</script>

{#if href}
	<a
		{href}
		class="mk-proof-card mk-proof-card--text {className}"
		class:mk-proof-card--featured={featured}
		class:mk-proof-card--wide={wide}
		style="--mk-delay:{delay}"
		aria-label={title}
	>
		{@render cardBody()}
	</a>
{:else}
	<div
		class="mk-proof-card mk-proof-card--text {className}"
		class:mk-proof-card--featured={featured}
		class:mk-proof-card--wide={wide}
		style="--mk-delay:{delay}"
	>
		{@render cardBody()}
	</div>
{/if}

{#snippet cardBody()}
	{#if index}
		<span class="mk-proof-index" aria-hidden="true">{index}</span>
	{/if}

	<div class="mk-proof-card-content">
		<div class="mk-proof-card-body">
			<div class="mk-proof-card-main">
				<h3 class="mk-proof-title">{title}</h3>
				{#if description}
					<p class="mk-proof-desc">{description}</p>
				{/if}
			</div>

			{#if visual === 'mix'}
				<div class="mk-proof-mix" aria-hidden="true">
					<div class="mk-proof-mix-pane">
						<span class="mk-proof-mix-kicker">Cover</span>
						<p class="mk-proof-mix-copy">Photo first</p>
					</div>
					<div class="mk-proof-mix-pane">
						<span class="mk-proof-mix-kicker">Story</span>
						<p class="mk-proof-mix-copy">Then a longer beat</p>
					</div>
					<div class="mk-proof-mix-pane">
						<span class="mk-proof-mix-kicker">Text</span>
						<p class="mk-proof-mix-copy">Or just type</p>
					</div>
				</div>
			{/if}
		</div>

		<div class="mk-proof-card-foot">
			<div class="mk-proof-stats">
				<div>
					<p class="mk-proof-stat-label">{formatLabel}</p>
					<p class="mk-proof-stat-value">{format}</p>
				</div>
				<div>
					<p class="mk-proof-stat-label">{platformLabel}</p>
					<p class="mk-proof-stat-value">{platform}</p>
				</div>
			</div>
			{#if href}
				<span class="mk-proof-link-icon" aria-hidden="true">
					<ArrowUpRight size={18} />
				</span>
			{/if}
		</div>
	</div>
{/snippet}
