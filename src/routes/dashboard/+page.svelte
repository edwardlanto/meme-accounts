<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';
	import {
		ArrowRight, ImagePlus, Trash2, ArrowUpRight, Rows3, Video, LayoutTemplate
	} from 'lucide-svelte';

	/** Must match `DRAFT_KIND` in `dashboard/studio/+page.svelte`. */
	const STUDIO_WORKSPACE_DRAFT_KIND = 'news_studio';
	/** Must match `STUDIO_SAVED_TEMPLATE_KIND` in `dashboard/studio/+page.svelte`. */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';

	type DraftRow = { id: string; updated_at: string; state?: Record<string, unknown>; created_at?: string };

	let loading = $state(true);
	let userId = $state('');
	let recentCarousels = $state<DraftRow[]>([]);
	let recentCarouselThumbById = $state<Record<string, string>>({});
	let studioSavedTemplates = $state<DraftRow[]>([]);
	let studioSavedTemplateThumbById = $state<Record<string, string>>({});

	const primaryCards = [
		{ href: '/dashboard/templates', icon: LayoutTemplate, label: 'Templates', sub: 'Layouts & starters' },
		{ href: '/dashboard/carousels', icon: ImagePlus, label: 'Carousels', sub: 'Your generated posts' },
		{ href: '/dashboard/bulk', icon: Rows3, label: 'Bulk', sub: 'Edit slideshows + clips' },
		{ href: '/dashboard/videos', icon: Video, label: 'Videos', sub: 'Paste link → find clips' },
	] as const;

	function stripMarkup(s: string): string {
		return String(s ?? '')
			.replace(/<\/?[^>]+>/g, '')
			.replace(/\*\*|__/g, '')
			.replace(/[*_]/g, '');
	}

	function timeAgo(dateStr: string): string {
		const d = new Date(dateStr);
		const diff = Date.now() - d.getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	function carouselTitle(d: DraftRow): string {
		const slides = d.state?.slides;
		if (Array.isArray(slides) && slides.length) {
			const t = stripMarkup(String(slides[0] ?? ''))
				.trim()
				.replace(/\s+/g, ' ');
			if (t) return t.length > 64 ? `${t.slice(0, 61)}…` : t;
		}
		const src = d.state?.source;
		if (typeof src === 'string' && src.trim()) {
			const t = src.trim();
			return t.length > 64 ? `${t.slice(0, 61)}…` : t;
		}
		return 'Untitled carousel';
	}

	function studioSavedTemplateName(row: DraftRow): string {
		const raw = String((row.state as Record<string, unknown> | undefined)?._templateName ?? '').trim();
		return raw || 'Untitled template';
	}

	async function signPreviewKey(key: string): Promise<string> {
		const k = String(key ?? '').trim();
		if (!k) return '';
		try {
			const { url } = await r2SignRead({ key: k });
			return String(url ?? '').trim();
		} catch {
			return '';
		}
	}

	async function hydrateRecentCarouselThumbs() {
		const rows = recentCarousels;
		if (!userId || !rows.length) {
			recentCarouselThumbById = {};
			return;
		}
		const next: Record<string, string> = {};
		await Promise.all(
			rows.map(async (row) => {
				const id = String(row.id ?? '').trim();
				if (!id) return;
				const s = row.state;
				const key =
					String(s?.draftPreviewKey ?? '').trim() || String(s?.draftPreviewPath ?? '').trim();
				const url = await signPreviewKey(key);
				if (url) next[id] = url;
			}),
		);
		recentCarouselThumbById = next;
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
				const s = row.state;
				const key =
					String(s?.draftPreviewKey ?? '').trim() ||
					String(s?.draftPreviewPath ?? '').trim() ||
					`${userId}/templates/${id}.png`;
				const url = await signPreviewKey(key);
				if (url) next[id] = url;
			}),
		);
		studioSavedTemplateThumbById = next;
	}

	function draftPreviewUrl(
		row: DraftRow,
		signedMap: Record<string, string>,
	): { url: string; fullSlideRaster: boolean } {
		const id = String(row.id ?? '').trim();
		const signed = signedMap[id];
		if (signed) return { url: signed, fullSlideRaster: true };
		const s = row.state;
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
			const s = row?.state;
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

	async function deleteRecentCarousel(id: string) {
		if (!confirm('Delete this carousel draft? This cannot be undone.')) return;
		try {
			const row = recentCarousels.find((x) => x.id === id);
			const s = row?.state;
			const key =
				String(s?.draftPreviewKey ?? '').trim() || String(s?.draftPreviewPath ?? '').trim();
			if (key) await r2DeleteObject({ key });
		} catch {
			// ignore
		}
		const { error } = await (supabase as any)
			.from('drafts')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.eq('kind', STUDIO_WORKSPACE_DRAFT_KIND);
		if (error) {
			alert(error.message ?? 'Could not delete carousel');
			return;
		}
		recentCarousels = recentCarousels.filter((x) => x.id !== id);
		const next = { ...recentCarouselThumbById };
		delete next[id];
		recentCarouselThumbById = next;
	}

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;

		const [draftRes, savedTplRes] = await Promise.all([
			(supabase as any)
				.from('drafts')
				.select('id,updated_at,created_at,state')
				.eq('user_id', user.id)
				.eq('kind', STUDIO_WORKSPACE_DRAFT_KIND)
				.order('updated_at', { ascending: false })
				.limit(8),
			(supabase as any)
				.from('drafts')
				.select('id,updated_at,state')
				.eq('user_id', user.id)
				.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
				.order('updated_at', { ascending: false })
				.limit(12),
		]);

		recentCarousels = draftRes.data ?? [];
		studioSavedTemplates = savedTplRes.data ?? [];
		await Promise.all([hydrateRecentCarouselThumbs(), hydrateSavedTemplateThumbs()]);
		loading = false;
	});
</script>

<div class="dash dash-page">
	<!-- ── Hero ─────────────────────────────────────────── -->
	<section class="hero">
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="hero-inner">
			<div class="hero-eyebrow">
				<span class="hero-dot"></span>
				<span>Studio</span>
			</div>
			<h1 class="hero-title dash-page-title">Create your next post</h1>
			<div class="hero-actions">
				<a href="/dashboard/templates" class="ma-btn ma-btn-primary">
					Browse templates
					<ArrowRight size={14} />
				</a>
				<a href="/dashboard/bulk" class="ma-btn ma-btn-ghost">Open Bulk</a>
			</div>
		</div>
	</section>

	<!-- ── Quick actions ─────────────────────────────────── -->
	<section class="row">
		{#each primaryCards as c, i (c.href)}
			{@const Icon = c.icon}
			<a class="card" href={c.href} style={`--d:${i * 0.05}s`}>
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

	<!-- ── Recent carousels ───────────────────────────────── -->
	<section class="saved-section" aria-labelledby="recent-carousels-heading" aria-busy={loading}>
			<div class="saved-section-head saved-section-head--row">
				<div class="saved-section-titles">
					<h2 id="recent-carousels-heading" class="saved-section-title">Recent carousels</h2>
					<p class="saved-section-sub">
						Your latest Studio drafts - open one to keep editing.
					</p>
				</div>
				<a class="ma-btn ma-btn-ghost ma-btn-sm" href="/dashboard/carousels">
					View all
					<ArrowRight size={13} />
				</a>
			</div>

			{#if loading}
				<div class="saved-templates-grid" aria-hidden="true">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="saved-template-tile saved-template-skel">
							<div class="saved-template-skel-bar"></div>
						</div>
					{/each}
				</div>
			{:else if recentCarousels.length > 0}
				<div class="saved-templates-grid">
					{#each recentCarousels as row (row.id)}
						{@const pv = draftPreviewUrl(row, recentCarouselThumbById)}
						<div class="saved-template-tile group">
							<a
								class="saved-template-link"
								href="/dashboard/studio?draft={row.id}"
								aria-label="Open carousel {carouselTitle(row)}"
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
										<span class="saved-template-empty-text">{carouselTitle(row)}</span>
									</div>
								{/if}
								<div class="saved-template-meta">
									<span class="saved-template-meta-title">{carouselTitle(row)}</span>
									<span class="saved-template-meta-time">{timeAgo(row.updated_at)}</span>
								</div>
							</a>
							<button
								type="button"
								class="saved-template-del"
								title="Delete carousel"
								aria-label="Delete carousel"
								onclick={() => void deleteRecentCarousel(row.id)}
							>
								<Trash2 size={12} />
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="saved-empty">
					No carousels yet.
					<a class="saved-section-link" href="/dashboard/templates">Pick a template</a>
					to start one - it will show up here.
				</p>
			{/if}
		</section>

		<!-- ── Saved templates ────────────────────────────────── -->
		<section class="saved-section" aria-labelledby="saved-templates-heading" aria-busy={loading}>
			<div class="saved-section-head">
				<div class="saved-section-titles">
					<h2 id="saved-templates-heading" class="saved-section-title">Saved templates</h2>
					<p class="saved-section-sub">
						Layouts you saved from Studio. Open one to keep editing, or manage the full list on
						<a class="saved-section-link" href="/dashboard/carousels">Carousels</a>.
					</p>
				</div>
			</div>

			{#if loading}
				<div class="saved-templates-grid" aria-hidden="true">
					{#each [0, 1, 2, 3] as i (`saved-${i}`)}
						<div class="saved-template-tile saved-template-skel">
							<div class="saved-template-skel-bar"></div>
						</div>
					{/each}
				</div>
			{:else if studioSavedTemplates.length > 0}
				<div class="saved-templates-grid">
					{#each studioSavedTemplates as row (row.id)}
						{@const pv = draftPreviewUrl(row, studioSavedTemplateThumbById)}
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
					<a class="saved-section-link" href="/dashboard/studio">Studio</a>, save a
					layout and it will show up here.
				</p>
			{/if}
		</section>
</div>

<style>
	/* ─── tokens (match marketing homepage) ─────────────────── */
	.dash {
		--ap-text:   #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-text-3: #9a9aa1;
		--ap-line:   rgba(15, 15, 16, 0.08);
		--ap-line-2: rgba(15, 15, 16, 0.14);
		--ap-soft:   #f6f7f9;
		--ap-soft-2: #eef1f5;
		--ap-bg:     #ffffff;
		--ap-accent: #7bf1a8;

		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		letter-spacing: -0.01em;
		-webkit-font-smoothing: antialiased;
		color: var(--ap-text);
	}

	/* ─── Hero (light soft — same language as homepage) ─────── */
	.hero {
		position: relative;
		border-radius: 24px;
		overflow: hidden;
		min-height: 260px;
		display: flex;
		align-items: center;
		isolation: isolate;
		background: var(--ap-soft);
		border: 1px solid var(--ap-line);
		animation: dash-fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.hero-glow {
		position: absolute;
		top: -30%;
		left: 12%;
		width: 640px;
		height: 420px;
		background:
			radial-gradient(closest-side, rgba(123, 241, 168, 0.28), transparent 72%),
			radial-gradient(closest-side at 78% 40%, rgba(232, 255, 72, 0.12), transparent 70%);
		filter: blur(8px);
		pointer-events: none;
		z-index: 0;
	}

	.hero-inner {
		position: relative;
		z-index: 1;
		padding: 36px 40px;
		max-width: 720px;
	}
	.hero-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid var(--ap-line);
		color: var(--ap-text-2);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin-bottom: 18px;
	}
	.hero-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: var(--ap-accent);
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.22);
	}
	.hero-title {
		margin: 0 0 14px;
		color: var(--ap-text);
	}
	.hero-sub {
		margin: 0 0 24px;
		color: var(--ap-text-2);
		font-weight: 400;
	}
	.hero-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
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
	.card:hover {
		transform: translateY(-2px);
		border-color: var(--ap-line-2);
		box-shadow: 0 14px 32px -16px rgba(15, 15, 16, 0.14);
	}
	.card-icon {
		position: relative;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background: var(--ap-soft-2);
		color: var(--ap-text);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s, color 0.25s;
	}
	.card:hover .card-icon {
		transform: scale(1.05) rotate(-2deg);
		background: var(--ap-accent);
		color: #0f0f10;
	}
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
		box-shadow: 0 18px 40px -18px rgba(15, 15, 16, 0.16);
	}
	.saved-template-skel {
		pointer-events: none;
		background:
			linear-gradient(110deg, #eef1f5 8%, #f7f8fa 18%, #eef1f5 33%);
		background-size: 200% 100%;
		animation: dash-skel 1.15s ease-in-out infinite;
	}
	.saved-template-skel-bar {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 14px;
		height: 10px;
		border-radius: 6px;
		background: rgba(15, 15, 16, 0.08);
	}
	@keyframes dash-skel {
		0% { background-position: 100% 0; }
		100% { background-position: -100% 0; }
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
		.hero { min-height: 220px; }
		.hero-inner { padding: 28px 24px; }
		.hero-title { font-size: 26px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.hero, .card, .saved-section { animation: none; }
	}

	.saved-section-head--row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}
	.saved-template-meta {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 28px 12px 12px;
		background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.72) 55%);
		display: flex;
		flex-direction: column;
		gap: 2px;
		pointer-events: none;
	}
	.saved-template-meta-title {
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: -0.01em;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.saved-template-meta-time {
		color: rgba(255, 255, 255, 0.7);
		font-size: 10.5px;
		font-weight: 500;
	}
	@media (max-width: 640px) {
		.saved-section-head--row { flex-direction: column; align-items: stretch; }
	}

</style>
