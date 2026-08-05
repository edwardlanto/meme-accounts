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

<div class="videos-page">
	<header class="videos-hero">
		<div class="hero-copy">
			<h1>Long video → short clips</h1>
			<p>
				Paste a YouTube link or upload a file. AI finds the best moments, ranked by virality — then
				edit captions, reframe, and export in Bulk.
			</p>
		</div>
	</header>

	<section class="import-card" aria-label="Import video">
		{#if userId}
			<BulkClipImportForm userId={userId} oncomplete={onComplete} />
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
		max-width: 560px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 2.5rem;
		color: var(--app-text);
	}
	.videos-hero {
		margin-bottom: 1.25rem;
	}
	.videos-hero h1 {
		margin: 0 0 0.45rem;
		font-size: 1.45rem;
		font-weight: 800;
		line-height: 1.15;
	}
	.videos-hero p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
		color: var(--app-text-2);
		max-width: 42rem;
	}
	.import-card {
		padding: 1rem;
		border: 1px solid var(--bulk-border, #e2e8f0);
		border-radius: 14px;
		background: var(--app-surface-2, #f8fafc);
		box-shadow: 0 2px 12px color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	.foot-hint {
		margin: 1rem 0 0;
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
</style>
