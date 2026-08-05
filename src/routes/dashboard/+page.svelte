<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';
	import {
		ArrowRight, ImagePlus, Sparkles, Layers, BarChart3, Trash2, ArrowUpRight, Rows3, Video
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
		{ href: '/dashboard/branding',       icon: Sparkles,  label: 'Generate Image', sub: 'Branding generator',  accent: '#7c3aed', tint: '#f3e8ff' },
		{ href: '/dashboard/carousels',      icon: ImagePlus, label: 'Carousels', sub: 'Templates & layouts', accent: '#0891b2', tint: '#cffafe' },
		{ href: '/dashboard/bulk',           icon: Rows3,     label: 'Bulk',     sub: 'Edit slideshows + clips', accent: '#0f766e', tint: '#ccfbf1' },
		{ href: '/dashboard/videos',         icon: Video,     label: 'Videos',   sub: 'Paste link → find clips', accent: '#e11d48', tint: '#ffe4e6' },
		{ href: '/dashboard/studio?template=news', icon: Layers, label: 'News Studio', sub: 'News → post', accent: '#ea580c', tint: '#ffedd5' },
		{ href: '/dashboard/analytics',      icon: BarChart3, label: 'Analytics',      sub: 'Track performance',    accent: '#16a34a', tint: '#dcfce7' },
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
	<!-- ── Hero ─────────────────────────────────────────── -->
	<section class="hero">
		<div class="hero-bg" aria-hidden="true"></div>
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="hero-inner">
			<div class="hero-eyebrow">
				<span class="hero-dot"></span>
				<span>Studio</span>
			</div>
			<h1 class="hero-title">Start by generating a free image</h1>
			<p class="hero-sub">
				Upload a style reference, choose a size preset, and generate a branded slideshow in seconds.
			</p>
			<div class="hero-actions">
				<a href="/dashboard/branding" class="btn btn-dark">
					Generate
					<ArrowRight size={14} />
				</a>
				<a href="/dashboard/carousels/new" class="btn btn-ghost">
					New carousel
					<ImagePlus size={14} />
				</a>
			</div>
		</div>
	</section>

	<!-- ── Quick actions ─────────────────────────────────── -->
	<section class="row">
		{#each primaryCards as c, i (c.href)}
			{@const Icon = c.icon}
			<a class="card" href={c.href} style={`--accent:${c.accent}; --tint:${c.tint}; --d:${i * 0.05}s`}>
				<div class="card-icon">
					<Icon size={18} />
				</div>
				<div class="card-body">
					<p class="card-title">{c.label}</p>
					<p class="card-sub">{c.sub}</p>
				</div>
				<div class="card-go">
					<ArrowUpRight size={15} />
				</div>
			</a>
		{/each}
	</section>

	<!-- ── Saved templates ────────────────────────────────── -->
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
	/* ─── tokens ────────────────────────────────────────────── */
	.dash {
		--ap-text:   #0a0a0a;
		--ap-text-2: rgba(10, 10, 10, 0.62);
		--ap-text-3: rgba(10, 10, 10, 0.42);
		--ap-line:   rgba(10, 10, 10, 0.08);
		--ap-line-2: rgba(10, 10, 10, 0.16);
		--ap-soft:   #f6f5f1;
		--ap-bg:     #ffffff;
		--ap-accent: #0a0a0a;

		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		max-width: 1180px;
		margin: 0 auto;
		padding: 32px 32px 64px;
		letter-spacing: -0.01em;
		-webkit-font-smoothing: antialiased;
	}
	:global(:root[data-theme='dark']) .dash {
		--ap-text:   #f5f5f5;
		--ap-text-2: rgba(245, 245, 245, 0.66);
		--ap-text-3: rgba(245, 245, 245, 0.42);
		--ap-line:   rgba(255, 255, 255, 0.08);
		--ap-line-2: rgba(255, 255, 255, 0.14);
		--ap-soft:   #161616;
		--ap-bg:     #0a0a0a;
		--ap-accent: #ffffff;
	}

	/* ─── Hero ──────────────────────────────────────────────── */
	.hero {
		position: relative;
		border-radius: 24px;
		overflow: hidden;
		min-height: 280px;
		display: flex;
		align-items: center;
		isolation: isolate;
		background: linear-gradient(180deg, #1c1f22 0%, #0a0c0e 100%);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.06) inset,
			0 28px 60px -28px rgba(10, 10, 10, 0.32),
			0 12px 24px -14px rgba(10, 10, 10, 0.18);
		animation: dash-fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.hero-bg {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(900px 500px at 18% 20%, rgba(96, 165, 250, 0.32), transparent 65%),
			radial-gradient(700px 420px at 80% 80%, rgba(147, 51, 234, 0.22), transparent 60%);
		z-index: -2;
	}
	.hero-glow {
		position: absolute;
		inset: -40%;
		background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 255, 255, 0.04) 90deg, transparent 180deg);
		opacity: 0.6;
		animation: hero-spin 28s linear infinite;
		z-index: -1;
		pointer-events: none;
	}
	@keyframes hero-spin {
		from { transform: rotate(0deg); }
		to   { transform: rotate(360deg); }
	}

	.hero-inner {
		position: relative;
		padding: 36px 40px;
		max-width: 720px;
	}
	.hero-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.10);
		color: rgba(255, 255, 255, 0.86);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		backdrop-filter: blur(8px);
		margin-bottom: 18px;
	}
	.hero-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: #34d399;
		box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18);
	}
	.hero-title {
		margin: 0 0 14px;
		font-family: 'Satoshi', sans-serif;
		font-weight: 800;
		font-size: clamp(30px, 3.2vw, 44px);
		line-height: 1.04;
		letter-spacing: -0.025em;
		color: #ffffff;
	}
	.hero-sub {
		margin: 0 0 24px;
		font-size: 15px;
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.72);
		max-width: 56ch;
		font-weight: 400;
	}
	.hero-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	/* ─── Buttons ───────────────────────────────────────────── */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 18px;
		border-radius: 999px;
		font-family: inherit;
		font-weight: 600;
		font-size: 13.5px;
		text-decoration: none;
		border: 1px solid transparent;
		transition: transform 0.22s ease, background 0.22s ease, border-color 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-dark {
		background: #ffffff;
		color: #0a0a0a;
		border-color: #ffffff;
	}
	.btn-dark:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 28px -10px rgba(255, 255, 255, 0.35);
	}
	.btn-ghost {
		color: rgba(255, 255, 255, 0.92);
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(6px);
	}
	.btn-ghost:hover {
		background: rgba(255, 255, 255, 0.10);
		border-color: rgba(255, 255, 255, 0.22);
	}

	/* ─── Quick action cards ────────────────────────────────── */
	.row {
		margin-top: 18px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}
	.card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 14px;
		border-radius: 16px;
		background: var(--ap-bg);
		border: 1px solid var(--ap-line);
		text-decoration: none;
		color: var(--ap-text);
		overflow: hidden;
		transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s;
		animation: dash-fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s) both;
	}
	.card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(120% 80% at 100% 0%, var(--tint), transparent 65%);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}
	:global(:root[data-theme='dark']) .card::before {
		background: radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 65%);
	}
	.card:hover {
		transform: translateY(-2px);
		border-color: var(--ap-line-2);
		box-shadow: 0 14px 32px -16px rgba(10, 10, 10, 0.18);
	}
	:global(:root[data-theme='dark']) .card:hover {
		box-shadow: 0 14px 32px -16px rgba(0, 0, 0, 0.5);
	}
	.card:hover::before { opacity: 1; }
	.card-icon {
		position: relative;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background: var(--tint);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	:global(:root[data-theme='dark']) .card-icon {
		background: color-mix(in oklab, var(--accent) 18%, transparent);
		color: color-mix(in srgb, var(--accent) 70%, white);
	}
	.card:hover .card-icon { transform: scale(1.05) rotate(-2deg); }
	.card-body { flex: 1; min-width: 0; position: relative; }
	.card-title {
		margin: 0;
		font-weight: 700;
		font-size: 13.5px;
		letter-spacing: -0.01em;
		color: var(--ap-text);
	}
	.card-sub {
		margin: 2px 0 0;
		font-size: 11.5px;
		color: var(--ap-text-2);
	}
	.card-go {
		position: relative;
		color: var(--ap-text-3);
		transition: color 0.25s, transform 0.25s;
	}
	.card:hover .card-go {
		color: var(--ap-text);
		transform: translate(2px, -2px);
	}

	/* ─── Saved templates ───────────────────────────────────── */
	.saved-section {
		margin-top: 36px;
		padding: 24px 26px 22px;
		border-radius: 22px;
		border: 1px solid var(--ap-line);
		background: var(--ap-bg);
		animation: dash-fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
	}
	:global(:root[data-theme='dark']) .saved-section {
		background: rgba(255, 255, 255, 0.02);
	}
	.saved-section-head { margin-bottom: 16px; }
	.saved-section-title {
		margin: 0 0 6px;
		font-family: 'Satoshi', sans-serif;
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--ap-text);
	}
	.saved-section-sub {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ap-text-2);
		max-width: 56rem;
	}
	.saved-section-link {
		color: var(--ap-text);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: var(--ap-line-2);
		transition: text-decoration-color 0.2s;
	}
	.saved-section-link:hover {
		text-decoration-color: var(--ap-text);
	}
	.saved-empty {
		margin: 0;
		font-size: 13px;
		color: var(--ap-text-2);
		line-height: 1.55;
	}
	.saved-templates-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 14px;
	}
	.saved-template-tile {
		position: relative;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--ap-line);
		background: var(--ap-soft);
		transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s;
		aspect-ratio: 4 / 5;
	}
	.saved-template-tile:hover {
		transform: translateY(-3px);
		border-color: var(--ap-line-2);
		box-shadow: 0 18px 40px -18px rgba(10, 10, 10, 0.18);
	}
	:global(:root[data-theme='dark']) .saved-template-tile:hover {
		box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.55);
	}
	.saved-template-link {
		display: block; width: 100%; height: 100%; text-decoration: none;
	}
	.saved-template-img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
		color: var(--ap-text-3);
		font-family: 'Satoshi', sans-serif;
		font-size: 0.7rem;
		text-align: center;
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
		top: 0.6rem;
		right: 0.6rem;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.55);
		color: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(6px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transform: translateY(-2px);
		transition: opacity 0.18s, transform 0.18s, background 0.18s;
		cursor: pointer;
	}
	.saved-template-tile:hover .saved-template-del {
		opacity: 1;
		transform: translateY(0);
	}
	.saved-template-del:hover { background: rgba(239, 68, 68, 0.65); }

	.loading {
		margin-top: 18px;
		font-size: 12px;
		color: var(--ap-text-3);
		font-family: 'Satoshi', sans-serif;
	}

	/* ─── motion ────────────────────────────────────────────── */
	@keyframes dash-fade-up {
		from { opacity: 0; transform: translateY(14px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* ─── responsive ────────────────────────────────────────── */
	@media (max-width: 1080px) {
		.row { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 640px) {
		.dash { padding: 22px 18px 40px; }
		.row  { grid-template-columns: 1fr; }
		.hero { min-height: 240px; }
		.hero-inner { padding: 28px 24px; }
		.hero-title { font-size: 26px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.hero-glow { animation: none; }
		.hero, .card, .saved-section { animation: none; }
	}
</style>
