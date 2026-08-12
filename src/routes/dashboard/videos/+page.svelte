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
			<p class="dash-page-sub">
				Paste a YouTube link or upload a file. AI finds the best moments, ranked by virality - then
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
		color: var(--app-text);
	}
	.videos-hero {
		margin-bottom: 1.25rem;
	}
	.videos-hero p {
		color: var(--app-text-2);
	}
	.import-card {
		max-width: 560px;
		padding: 1.1rem;
		border: 1px solid var(--app-border);
		border-radius: 18px;
		background: var(--app-surface-2);
		box-shadow: 0 1px 2px rgba(15, 15, 16, 0.04), 0 8px 22px -10px rgba(15, 15, 16, 0.1);
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
