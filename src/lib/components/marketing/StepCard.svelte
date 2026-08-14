<script lang="ts">
	let {
		num,
		title,
		description,
		delay = '0s',
	}: {
		num: string;
		title: string;
		description: string;
		delay?: string;
	} = $props();
</script>

<div class="mk-card mk-reveal" style="--mk-delay:{delay}">
	<div class="mk-step-num">{num}</div>
	<h3 class="mk-feature-title">{title}</h3>
	<p class="mk-feature-desc">{description}</p>
</div>
