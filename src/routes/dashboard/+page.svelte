<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		ArrowRight, ImagePlus, Sparkles, Layers, Wand2, BarChart3, Bookmark
	} from 'lucide-svelte';

	let loading = $state(true);

	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';

	type StudioSavedRow = {
		id: string;
		updated_at: string;
		state: { _templateName?: string; templatePreviewUrl?: string } | null;
	};

	let studioSavedTemplates = $state<StudioSavedRow[]>([]);
	let studioTemplatesLoading = $state(false);

	const primaryCards = [
		{ href: '/dashboard/branding', icon: Sparkles, label: 'Generate Image', sub: 'Branding generator', accent: '#7c3aed' },
		{ href: '/dashboard/brand-carousel', icon: Wand2, label: 'Brand Carousel', sub: 'Brand-style carousels', accent: '#06b6d4' },
		{ href: '/dashboard/studio?template=news', icon: Layers, label: 'News Studio', sub: 'News → post', accent: '#f97316' },
		{ href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', sub: 'Track performance', accent: '#22c55e' },
	] as const;

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		loading = false;
		studioTemplatesLoading = true;
		const { data, error } = await supabase
			.from('drafts')
			.select('id,updated_at,state')
			.eq('user_id', user.id)
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
			.order('updated_at', { ascending: false })
			.limit(24);
		studioTemplatesLoading = false;
		if (!error && data) studioSavedTemplates = data as StudioSavedRow[];
	});
</script>

<div class="dash">
	<div class="hero">
		<div class="hero-bg"></div>
		<div class="hero-inner">
			<h1 class="hero-title">Start by generating a free image</h1>
			<p class="hero-sub">Upload a style reference, choose a size preset, and generate a branded slideshow.</p>
			<div class="hero-actions">
				<a href="/dashboard/branding" class="hero-btn">
					Generate
					<ArrowRight size={16} />
				</a>
				<a href="/dashboard/carousels/new" class="hero-btn-secondary">
					New carousel
					<ImagePlus size={16} />
				</a>
			</div>
		</div>
	</div>

	<div class="row">
		{#each primaryCards as c (c.href)}
			{@const Icon = c.icon}
			<a class="card" href={c.href} style="--accent:{c.accent}">
				<div class="card-icon"><Icon size={18} /></div>
				<div class="card-body">
					<p class="card-title">{c.label}</p>
					<p class="card-sub">{c.sub}</p>
				</div>
				<div class="card-go"><ArrowRight size={16} /></div>
			</a>
		{/each}
	</div>

	{#if !loading}
		<div class="saved-section">
			<h2 class="saved-heading">Saved Studio templates</h2>
			<p class="saved-sub">Layouts and copy you saved from News Studio open as a new session. Saving also updates Studio drafts under Carousels.</p>
			{#if studioTemplatesLoading}
				<p class="loading">Loading templates…</p>
			{:else if studioSavedTemplates.length === 0}
				<p class="saved-empty">None yet — use <strong>Save template</strong> in the studio sidebar.</p>
			{:else}
				<div class="saved-grid">
					{#each studioSavedTemplates as row (row.id)}
						{@const preview = (row.state?.templatePreviewUrl ?? '').trim()}
						<a class="saved-card" href="/dashboard/studio?saved={row.id}">
							{#if preview}
								<div class="saved-thumb" aria-hidden="true">
									<img src={preview} alt="" referrerpolicy="no-referrer" />
								</div>
							{:else}
								<div class="saved-icon"><Bookmark size={16} /></div>
							{/if}
							<div class="saved-body">
								<p class="saved-title">{row.state?._templateName?.trim() || 'Untitled template'}</p>
								<p class="saved-meta">
									{new Date(row.updated_at).toLocaleString(undefined, {
										month: 'short',
										day: 'numeric',
										year: 'numeric',
									})}
								</p>
							</div>
							<div class="saved-go"><ArrowRight size={16} /></div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if loading}
		<p class="loading">Loading…</p>
	{/if}
</div>

<style>
	.dash {
		padding: 20px 22px 28px;
		max-width: 1160px;
		margin: 0 auto;
	}

	.hero {
		position: relative;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--app-border);
		background: color-mix(in oklab, var(--app-text) 3%, transparent);
		height: 240px;
		display: flex;
		align-items: center;
	}
	.hero-bg {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(1200px 600px at 20% 30%, rgba(96,165,250,0.45), transparent 60%),
			radial-gradient(900px 520px at 70% 60%, rgba(59,130,246,0.35), transparent 55%),
			linear-gradient(180deg, color-mix(in oklab, var(--app-text) 6%, transparent), color-mix(in oklab, var(--app-text) 2%, transparent));
		filter: saturate(1.05);
	}
	.hero-inner {
		position: relative;
		padding: 28px 28px;
	}
	.hero-title {
		margin: 0;
		font-family: 'DM Sans', sans-serif;
		font-weight: 800;
		letter-spacing: -0.02em;
		font-size: 34px;
		color: var(--app-text);
	}
	.hero-sub {
		margin: 8px 0 0;
		font-size: 13px;
		color: var(--app-text-2);
		max-width: 62ch;
	}
	.hero-actions { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
	.hero-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 10px 14px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text) 86%, transparent);
		border: 1px solid color-mix(in oklab, var(--app-bg) 40%, transparent);
		color: color-mix(in oklab, var(--app-bg) 92%, transparent);
		text-decoration: none;
		font-weight: 700;
		font-size: 13px;
	}
	.hero-btn:hover { background: color-mix(in oklab, var(--app-text) 92%, transparent); }
	.hero-btn-secondary {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 10px 14px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text) 4%, transparent);
		border: 1px solid var(--app-border);
		color: var(--app-text-2);
		text-decoration: none;
		font-weight: 700;
		font-size: 13px;
	}
	.hero-btn-secondary:hover {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		color: var(--app-text);
	}

	.row {
		margin-top: 16px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 12px;
		border-radius: 14px;
		background: color-mix(in oklab, var(--app-text) 3%, transparent);
		border: 1px solid var(--app-border);
		text-decoration: none;
		color: var(--app-text);
		transition: transform 0.15s, background 0.15s, border-color 0.15s;
	}
	.card:hover {
		transform: translateY(-1px);
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
		border-color: var(--app-border-hover);
	}
	.card-icon {
		width: 34px; height: 34px;
		border-radius: 12px;
		background: color-mix(in oklab, var(--app-text) 4%, transparent);
		border: 1px solid var(--app-border);
		display: flex; align-items: center; justify-content: center;
		color: color-mix(in srgb, var(--accent) 80%, white);
	}
	.card-title { margin: 0; font-weight: 800; font-size: 13px; color: var(--app-text); }
	.card-sub { margin: 2px 0 0; font-size: 11px; color: var(--app-text-2); }
	.card-body { flex: 1; min-width: 0; }
	.card-go { color: var(--app-text-3); }
	.card:hover .card-go { color: var(--app-text-2); }

	.loading { margin-top: 14px; font-size: 12px; color: var(--app-text-3); font-family: 'Space Mono', monospace; }

	@media (max-width: 980px) {
		.row { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 560px) {
		.dash { padding: 16px 14px 20px; }
		.row { grid-template-columns: 1fr; }
		.hero { height: 220px; }
		.hero-title { font-size: 28px; }
	}

	.saved-section {
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--app-border);
	}
	.saved-heading {
		margin: 0;
		font-family: 'DM Sans', sans-serif;
		font-weight: 800;
		font-size: 15px;
		color: var(--app-text);
		letter-spacing: -0.02em;
	}
	.saved-sub {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--app-text-2);
		max-width: 70ch;
		line-height: 1.45;
	}
	.saved-empty {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--app-text-3);
	}
	.saved-grid {
		margin-top: 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 10px;
	}
	.saved-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 12px;
		background: color-mix(in oklab, var(--app-text) 3%, transparent);
		border: 1px solid var(--app-border);
		text-decoration: none;
		color: var(--app-text);
		transition: transform 0.15s, background 0.15s, border-color 0.15s;
	}
	.saved-card:hover {
		transform: translateY(-1px);
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
		border-color: var(--app-border-hover);
	}
	.saved-icon {
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
		border: 1px solid var(--app-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #a78bfa;
	}
	.saved-thumb {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--app-border);
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		flex-shrink: 0;
	}
	.saved-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.saved-body { flex: 1; min-width: 0; }
	.saved-title {
		margin: 0;
		font-weight: 700;
		font-size: 13px;
		color: var(--app-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.saved-meta {
		margin: 2px 0 0;
		font-size: 10px;
		font-family: 'Space Mono', monospace;
		color: var(--app-text-3);
	}
	.saved-go { color: var(--app-text-3); flex-shrink: 0; }
	.saved-card:hover .saved-go { color: var(--app-text-2); }
</style>
