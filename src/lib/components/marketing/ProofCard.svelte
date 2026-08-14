<script lang="ts">
	let {
		title,
		format,
		platform,
		image,
		class: className = '',
		delay = '0s',
	}: {
		title: string;
		format: string;
		platform: string;
		image: string;
		class?: string;
		delay?: string;
	} = $props();
</script>

<div class="mk-proof-card mk-reveal {className}" style="--mk-delay:{delay}">
	<img src={image} alt="" loading="lazy" />
	<div class="mk-proof-card-content">
		<h3 class="mk-proof-title">{title}</h3>
		<div class="mk-proof-stats">
			<div>
				<p class="mk-proof-stat-label">Format</p>
				<p class="mk-proof-stat-value">{format}</p>
			</div>
			<div>
				<p class="mk-proof-stat-label">Platform</p>
				<p class="mk-proof-stat-value">{platform}</p>
			</div>
		</div>
	</div>
</div>
