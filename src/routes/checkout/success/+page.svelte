<script lang="ts">
	import { ArrowRight, CheckCircle2 } from 'lucide-svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>You're in — Meme Accounts</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<div class="card">
		<div class="icon" aria-hidden="true">
			<CheckCircle2 size={36} strokeWidth={2} />
		</div>
		<span class="eyebrow">Payment confirmed</span>
		<h1>Welcome to {data.planName}.</h1>
		<p>
			Your subscription is active. Head to the studio and ship your next carousel —
			or manage billing anytime from Settings.
		</p>
		<div class="actions">
			<a href="/dashboard" class="primary">
				Open studio
				<ArrowRight size={18} />
			</a>
			<a href="/dashboard/settings?tab=billing" class="ghost">View billing</a>
		</div>
	</div>
</div>

<style>
	.page {
		--lime: #7bf1a8;
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 32px 20px;
		background:
			radial-gradient(ellipse 60% 50% at 70% 0%, color-mix(in oklch, #7bf1a8 45%, transparent), transparent),
			#0a0a0a;
		color: rgba(255, 255, 255, 0.92);
	}
	.card {
		max-width: 480px;
		width: 100%;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.icon {
		width: 64px;
		height: 64px;
		border-radius: 18px;
		background: var(--lime);
		color: #0a0a0a;
		display: grid;
		place-items: center;
		margin-bottom: 8px;
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--lime);
	}
	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(32px, 5vw, 44px);
		letter-spacing: -0.03em;
		font-weight: 700;
		line-height: 1.05;
	}
	p {
		margin: 0;
		color: rgba(255, 255, 255, 0.55);
		font-size: 16px;
		line-height: 1.55;
		max-width: 40ch;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 18px;
	}
	.primary,
	.ghost {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 18px;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 700;
		font-size: 14px;
	}
	.primary {
		background: var(--lime);
		color: #0a0a0a;
	}
	.ghost {
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: rgba(255, 255, 255, 0.75);
	}
	.ghost:hover {
		background: rgba(255, 255, 255, 0.06);
	}
</style>
