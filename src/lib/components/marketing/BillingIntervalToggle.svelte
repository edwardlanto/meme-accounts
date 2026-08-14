<script lang="ts">
	let {
		interval = $bindable<'month' | 'year'>('month'),
		savePercent = 31,
		align = 'center',
		class: className = '',
	}: {
		interval?: 'month' | 'year';
		savePercent?: number;
		align?: 'center' | 'start';
		class?: string;
	} = $props();
</script>

<div class="mk-pricing-toggle mk-pricing-toggle--{align} {className}">
	<div class="mk-pricing-toggle__track" role="group" aria-label="Billing interval">
		<button
			type="button"
			class="mk-pricing-toggle__btn"
			class:is-active={interval === 'month'}
			aria-pressed={interval === 'month'}
			onclick={() => (interval = 'month')}
		>
			Monthly
		</button>
		<button
			type="button"
			class="mk-pricing-toggle__btn"
			class:is-active={interval === 'year'}
			aria-pressed={interval === 'year'}
			onclick={() => (interval = 'year')}
		>
			Yearly
			<span class="mk-pricing-toggle__badge">Save {savePercent}%</span>
		</button>
	</div>
</div>
