<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import BulkClipImportForm from '$lib/components/bulk/BulkClipImportForm.svelte';
	import {
		stashClipImportResult,
		type BulkClipImportResult,
	} from '$lib/studio/bulk-video-clips';
	import { ArrowRight } from 'lucide-svelte';

	let userId = $state('');

	onMount(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			goto('/login');
			return;
		}
		userId = user.id;
	});

	function onComplete(result: BulkClipImportResult) {
		stashClipImportResult(result);
		goto('/dashboard/bulk');
	}
</script>

<svelte:head>
	<title>Clip finder - Social Poster</title>
</svelte:head>

<div class="videos-page dash-page">
	<header class="videos-hero page-hero">
		<div class="hero-copy page-hero-text">
			<h1 class="dash-page-title">Videos</h1>
		</div>
	</header>

	<section class="workspace" aria-label="Import video">
		{#if userId}
			<div class="workspace-card">
				<BulkClipImportForm userId={userId} layout="split" oncomplete={onComplete} />
			</div>
		{:else}
			<div class="workspace-card workspace-loading" aria-hidden="true">
				<div class="skel skel-form"></div>
				<div class="skel skel-recent"></div>
			</div>
		{/if}
	</section>

	<p class="foot-hint">
		After <strong>Find clips</strong>, you'll open
		<a href="/dashboard/bulk">Bulk</a>
		with one slide per clip.
		<ArrowRight size={14} />
	</p>
</div>

<style>
	.videos-page {
		color: var(--app-text);
	}
	.videos-hero {
		margin-bottom: 1.35rem;
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1.5rem;
	}
	.videos-hero p {
		color: var(--app-text-2);
		max-width: 54ch;
	}
	.workspace {
		width: 100%;
	}
	.workspace-card {
		width: 100%;
		padding: 1.25rem;
		border: 1px solid var(--app-border);
		border-radius: 20px;
		background:
			radial-gradient(90% 70% at 100% 0%, color-mix(in oklab, var(--app-accent, #7bf1a8) 14%, transparent), transparent 55%),
			var(--app-surface-2);
		box-shadow:
			0 1px 2px rgba(15, 15, 16, 0.04),
			0 14px 36px -18px rgba(15, 15, 16, 0.14);
	}
	.workspace-loading {
		display: grid;
		grid-template-columns: minmax(280px, 0.92fr) minmax(300px, 1.08fr);
		gap: 1.35rem;
		min-height: 280px;
	}
	.skel {
		border-radius: 14px;
		background: linear-gradient(
			90deg,
			var(--app-surface-3) 0%,
			color-mix(in oklab, var(--app-surface-3) 40%, white) 50%,
			var(--app-surface-3) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.2s ease-in-out infinite;
	}
	.skel-form {
		min-height: 240px;
	}
	.skel-recent {
		min-height: 240px;
	}
	.foot-hint {
		margin: 1.1rem 0 0;
		font-size: 0.78rem;
		color: var(--app-text-3);
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.foot-hint a {
		color: var(--app-text);
		font-weight: 650;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}

	@media (max-width: 900px) {
		.workspace-loading {
			grid-template-columns: 1fr;
		}
	}
</style>
