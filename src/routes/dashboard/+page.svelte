<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';
	import {
		ArrowRight, ImagePlus, Sparkles, Layers, Wand2, BarChart3, Trash2
	} from 'lucide-svelte';

	/** Must match `STUDIO_SAVED_TEMPLATE_KIND` in `dashboard/studio/+page.svelte`. */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';

	let loading = $state(true);
	let userId = $state('');
	let studioSavedTemplates = $state<{ id: string; updated_at: string; state?: Record<string, unknown> }[]>(
		[],
	);
	let studioSavedTemplateThumbById = $state<Record<string, string>>({});

	const primaryCards = [
		{ href: '/dashboard/branding', icon: Sparkles, label: 'Generate Image', sub: 'Branding generator', accent: '#7c3aed' },
		{ href: '/dashboard/brand-carousel', icon: Wand2, label: 'Brand Carousel', sub: 'Brand-style carousels', accent: '#06b6d4' },
		{ href: '/dashboard/studio?template=news', icon: Layers, label: 'News Studio', sub: 'News → post', accent: '#f97316' },
		{ href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', sub: 'Track performance', accent: '#22c55e' },
	] as const;

	function studioSavedTemplateName(row: { state?: Record<string, unknown> }): string {
		const raw = String((row.state as Record<string, unknown> | undefined)?._templateName ?? '').trim();
		return raw || 'Untitled template';
	}

	async function hydrateSavedTemplateThumbs() {
		const rows = studioSavedTemplates;
		if (!userId || !rows.length) {
			studioSavedTemplateThumbById = {};
			return;
		}
		const next: Record<string, string> = {};
		await Promise.all(
			rows.map(async (row) => {
				const id = String(row.id ?? '').trim();
				if (!id) return;
				const s = row.state as Record<string, unknown> | undefined;
				const key =
					String(s?.draftPreviewKey ?? '').trim() ||
					String(s?.draftPreviewPath ?? '').trim() ||
					`${userId}/templates/${id}.png`;
				try {
					const { url } = await r2SignRead({ key });
					next[id] = url;
				} catch {
					// ignore
				}
			}),
		);
		studioSavedTemplateThumbById = next;
	}

	function studioSavedTemplatePreviewUrl(row: {
		state?: Record<string, unknown>;
	}): { url: string; fullSlideRaster: boolean } {
		const signed = studioSavedTemplateThumbById[String((row as { id?: string }).id ?? '').trim()];
		if (signed) return { url: signed, fullSlideRaster: true };
		const s = row.state as Record<string, unknown> | undefined;
		const draftPreviewUrl = String(s?.draftPreviewUrl ?? '').trim();
		if (draftPreviewUrl.startsWith('http://') || draftPreviewUrl.startsWith('https://')) {
			return { url: draftPreviewUrl, fullSlideRaster: true };
		}
		const templatePreviewUrl = String(s?.templatePreviewUrl ?? '').trim();
		if (templatePreviewUrl.startsWith('http://') || templatePreviewUrl.startsWith('https://')) {
			return { url: templatePreviewUrl, fullSlideRaster: false };
		}
		return { url: '', fullSlideRaster: false };
	}

	async function deleteStudioSavedTemplate(id: string) {
		if (!confirm('Delete this saved template? This cannot be undone.')) return;
		try {
			const row = studioSavedTemplates.find((x) => x.id === id);
			const s = row?.state as Record<string, unknown> | undefined;
			const key =
				String(s?.draftPreviewKey ?? '').trim() ||
				String(s?.draftPreviewPath ?? '').trim() ||
				`${userId}/templates/${id}.png`;
			if (key) await r2DeleteObject({ key });
		} catch {
			// ignore
		}
		const { error } = await (supabase as any)
			.from('drafts')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
		if (error) {
			alert(error.message ?? 'Could not delete template');
			return;
		}
		studioSavedTemplates = studioSavedTemplates.filter((x) => x.id !== id);
		const next = { ...studioSavedTemplateThumbById };
		delete next[id];
		studioSavedTemplateThumbById = next;
	}

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;

		const savedTplRes = await (supabase as any)
			.from('drafts')
			.select('id,updated_at,state')
			.eq('user_id', user.id)
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
			.order('updated_at', { ascending: false })
			.limit(12);

		studioSavedTemplates = savedTplRes.data ?? [];
		await hydrateSavedTemplateThumbs();
		loading = false;
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
		<section class="saved-section" aria-labelledby="saved-templates-heading">
			<div class="saved-section-head">
				<div class="saved-section-titles">
					<h2 id="saved-templates-heading" class="saved-section-title">Saved templates</h2>
					<p class="saved-section-sub">
						Layouts you saved from News Studio. Open one to keep editing, or manage the full list on
						<a class="saved-section-link" href="/dashboard/carousels">Carousels</a>.
					</p>
				</div>
			</div>

			{#if studioSavedTemplates.length > 0}
				<div class="saved-templates-grid">
					{#each studioSavedTemplates as row (row.id)}
						{@const pv = studioSavedTemplatePreviewUrl(row)}
						<div class="saved-template-tile group">
							<a
								class="saved-template-link"
								href="/dashboard/studio?saved={row.id}"
								aria-label="Open saved template {studioSavedTemplateName(row)}"
							>
								{#if pv.url}
									<img
										src={pv.url}
										alt=""
										class="saved-template-img"
										class:saved-template-img--full={pv.fullSlideRaster}
										referrerpolicy="no-referrer"
										loading="lazy"
										draggable="false"
									/>
								{:else}
									<div class="saved-template-empty">
										<span class="saved-template-empty-text">{studioSavedTemplateName(row)}</span>
									</div>
								{/if}
							</a>
							<button
								type="button"
								class="saved-template-del"
								title="Delete template"
								aria-label="Delete template"
								onclick={() => void deleteStudioSavedTemplate(row.id)}
							>
								<Trash2 size={12} />
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="saved-empty">
					No saved templates yet. In
					<a class="saved-section-link" href="/dashboard/studio?template=news">News Studio</a>, save a
					layout and it will show up here.
				</p>
			{/if}
		</section>
	{/if}

	{#if loading}
		<p class="loading">Loading…</p>
	{/if}
</div>

<style>
	:root:not([data-theme="dark"]) {
		--dash-panel-bg: color-mix(in oklab, var(--app-text) 3%, transparent);
		--dash-panel-border: var(--app-border);
		--dash-panel-border-hover: var(--app-border-hover);
		--dash-t-strong: var(--app-text);
		--dash-t-muted: var(--app-text-3);
	}
	:root[data-theme="dark"] {
		--dash-panel-bg: rgba(255, 255, 255, 0.02);
		--dash-panel-border: rgba(255, 255, 255, 0.06);
		--dash-panel-border-hover: rgba(255, 255, 255, 0.15);
		--dash-t-strong: rgba(255, 255, 255, 0.92);
		--dash-t-muted: rgba(255, 255, 255, 0.38);
	}

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

	.saved-section {
		margin-top: 28px;
		padding: 1rem 1.25rem;
		border-radius: 16px;
		border: 1px solid var(--dash-panel-border);
		background: var(--dash-panel-bg);
	}
	.saved-section-head {
		margin-bottom: 0.75rem;
	}
	.saved-section-title {
		margin: 0 0 0.35rem;
		font-family: 'DM Sans', sans-serif;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--dash-t-strong);
	}
	.saved-section-sub {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--dash-t-muted);
		max-width: 56rem;
	}
	.saved-section-link {
		color: var(--app-text-2);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.saved-section-link:hover {
		color: var(--app-text);
	}
	.saved-empty {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--dash-t-muted);
		line-height: 1.5;
	}
	.saved-templates-grid {
		margin-top: 0.65rem;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
	}
	.saved-template-tile {
		position: relative;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--dash-panel-border);
		background: var(--dash-panel-bg);
		transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
		aspect-ratio: 4 / 5;
	}
	.saved-template-tile:hover {
		transform: translateY(-1px);
		border-color: var(--dash-panel-border-hover);
	}
	:root:not([data-theme="dark"]) .saved-template-tile:hover {
		box-shadow: 0 14px 44px rgba(2, 6, 23, 0.1);
	}
	:root[data-theme="dark"] .saved-template-tile:hover {
		box-shadow: 0 14px 44px rgba(0, 0, 0, 0.34);
	}
	.saved-template-link {
		display: block;
		width: 100%;
		height: 100%;
		text-decoration: none;
	}
	.saved-template-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.saved-template-img--full {
		object-fit: contain;
		background: rgba(0, 0, 0, 0.35);
	}
	.saved-template-empty {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		color: var(--dash-t-muted);
		font-family: 'Space Mono', monospace;
		font-size: 0.7rem;
		text-align: center;
		background: color-mix(in oklab, var(--dash-panel-bg) 70%, transparent);
	}
	.saved-template-empty-text {
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.saved-template-del {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: 1px solid color-mix(in oklab, var(--dash-panel-border) 60%, transparent);
		background: rgba(0, 0, 0, 0.55);
		color: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(6px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transform: translateY(-2px);
		transition: opacity 0.15s, transform 0.15s, background 0.15s;
		cursor: pointer;
	}
	.saved-template-tile:hover .saved-template-del {
		opacity: 1;
		transform: translateY(0);
	}
	.saved-template-del:hover {
		background: rgba(239, 68, 68, 0.55);
	}

	@media (max-width: 980px) {
		.row { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 560px) {
		.dash { padding: 16px 14px 20px; }
		.row { grid-template-columns: 1fr; }
		.hero { height: 220px; }
		.hero-title { font-size: 28px; }
	}

</style>
