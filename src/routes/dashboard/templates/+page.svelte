<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Trash2 } from 'lucide-svelte';
	import { supabase } from '$lib/supabase';
	import { fetchDraftLibraryRows } from '$lib/studio/draft-library';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';
	import { STARTER_TEMPLATES } from '$lib/templates';
	import StarterTemplateGrid from '$lib/components/templates/StarterTemplateGrid.svelte';
	import { libraryCardImageUrl } from '$lib/client/optimize-image-url';

	/** Must match `STUDIO_SAVED_TEMPLATE_KIND` in `dashboard/studio/+page.svelte`. */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';

	type SavedRow = { id: string; updated_at: string; state?: Record<string, unknown> };

	let mounted = $state(false);
	let userId = $state('');
	let savedLoading = $state(true);
	let savedTemplates = $state<SavedRow[]>([]);
	let savedThumbs = $state<Record<string, string>>({});

	function savedName(row: SavedRow): string {
		return String(row.state?._templateName ?? '').trim() || 'Untitled template';
	}

	function savedPreview(row: SavedRow): string {
		const signed = savedThumbs[row.id];
		if (signed) return libraryCardImageUrl(signed);
		const s = row.state;
		const draft = String(s?.draftPreviewUrl ?? '').trim();
		if (draft.startsWith('http://') || draft.startsWith('https://')) return libraryCardImageUrl(draft);
		const tpl = String(s?.templatePreviewUrl ?? '').trim();
		if (tpl.startsWith('http://') || tpl.startsWith('https://')) return libraryCardImageUrl(tpl);
		return '';
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

	async function hydrateThumbs(uid: string, rows: SavedRow[]) {
		const next: Record<string, string> = {};
		await Promise.all(
			rows.map(async (row) => {
				const id = String(row.id ?? '').trim();
				if (!id) return;
				const s = row.state;
				const key =
					String(s?.draftPreviewKey ?? '').trim() ||
					String(s?.draftPreviewPath ?? '').trim() ||
					`${uid}/templates/${id}.png`;
				const url = await signPreviewKey(key);
				if (url) next[id] = url;
			}),
		);
		savedThumbs = next;
	}

	async function deleteSaved(id: string) {
		if (!confirm('Delete this saved template? This cannot be undone.')) return;
		try {
			const row = savedTemplates.find((x) => x.id === id);
			const s = row?.state;
			const key =
				String(s?.draftPreviewKey ?? '').trim() ||
				String(s?.draftPreviewPath ?? '').trim() ||
				`${userId}/templates/${id}.png`;
			if (key) await r2DeleteObject({ key });
		} catch {
			/* ignore */
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
		savedTemplates = savedTemplates.filter((x) => x.id !== id);
		const next = { ...savedThumbs };
		delete next[id];
		savedThumbs = next;
	}

	onMount(() => {
		mounted = true;
		void (async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				goto('/login?next=/dashboard/templates');
				return;
			}
			userId = user.id;
			savedTemplates = await fetchDraftLibraryRows(supabase, {
				userId: user.id,
				kind: STUDIO_SAVED_TEMPLATE_KIND,
				limit: 40,
			});
			await hydrateThumbs(user.id, savedTemplates);
			savedLoading = false;
		})();
	});
</script>

<div class="page-wrap dash-page" class:mounted>
	<header class="page-hero">
		<div class="page-hero-text">
			<h1 class="page-title dash-page-title">Templates</h1>
		</div>
	</header>

	<section class="templates-section reveal" style="--d:0.04s">
		<div class="section-head">
			<h2 class="section-title">Your templates</h2>
			<p class="section-sub">
				Named layouts from Studio → Save template. Open one to keep editing, or replace it from Studio.
			</p>
		</div>
		{#if savedLoading}
			<p class="saved-hint">Loading your templates…</p>
		{:else if savedTemplates.length === 0}
			<p class="saved-hint">
				None yet. Design in Studio, then Save template - it will land here.
			</p>
		{:else}
			<div class="saved-grid">
				{#each savedTemplates as row, i (row.id)}
					{@const preview = savedPreview(row)}
					<div class="saved-card" style="--d:{0.06 + i * 0.03}s">
						<a
							class="saved-link"
							href="/dashboard/studio?saved={row.id}"
							aria-label="Open {savedName(row)}"
						>
							<div class="saved-preview">
								{#if preview}
									<img src={preview} alt="" referrerpolicy="no-referrer" loading="lazy" draggable="false" />
								{:else}
									<span class="saved-fallback">{savedName(row)}</span>
								{/if}
							</div>
							<div class="saved-footer">
								<p class="saved-name">{savedName(row)}</p>
								<p class="saved-meta">Opens in Studio</p>
							</div>
						</a>
						<button
							type="button"
							class="saved-del"
							title="Delete template"
							aria-label="Delete {savedName(row)}"
							onclick={() => void deleteSaved(row.id)}
						>
							<Trash2 size={12} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="templates-section reveal" style="--d:0.08s">
		<div class="section-head">
			<h2 class="section-title">Start from a template</h2>
			<p class="section-sub">
				Hand-crafted layouts that open straight into Studio - {STARTER_TEMPLATES.length} templates.
			</p>
		</div>
		<StarterTemplateGrid templates={STARTER_TEMPLATES} />
	</section>
</div>

<style>
	:root:not([data-theme='dark']) {
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-soft: #f6f7f9;
		--ap-bg: #ffffff;
		--panel-bg: #ffffff;
		--panel-bg-2: #f6f7f9;
		--panel-border: rgba(15, 15, 16, 0.08);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--shadow-soft: 0 1px 2px rgba(15, 15, 16, 0.04), 0 8px 22px -10px rgba(15, 15, 16, 0.1);
	}
	:root[data-theme='dark'] {
		--ap-text: #f5f5f5;
		--ap-text-2: rgba(245, 245, 245, 0.66);
		--ap-soft: #161616;
		--ap-bg: #0a0a0a;
		--panel-bg: rgba(255, 255, 255, 0.025);
		--panel-bg-2: rgba(255, 255, 255, 0.045);
		--panel-border: rgba(255, 255, 255, 0.07);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--shadow-soft: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 12px 28px -16px rgba(0, 0, 0, 0.55);
	}

	.page-wrap {
		font-family: var(--font-body);
	}
	.reveal {
		opacity: 0;
		transform: translateY(14px);
		transition:
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s),
			transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
	}
	.page-wrap.mounted .reveal {
		opacity: 1;
		transform: none;
	}
	.page-hero {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
		margin-bottom: 36px;
	}
	.page-hero-text {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.page-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 10px;
		width: fit-content;
		border-radius: 999px;
		background: var(--panel-bg-2);
		border: 1px solid var(--panel-border);
		color: var(--t);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.page-eyebrow-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #7bf1a8;
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.22);
	}
	.page-title {
		color: var(--t-strong);
	}
	.page-sub {
		color: var(--t);
	}
	.section-head {
		margin-bottom: 16px;
	}
	.section-title {
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		margin: 0 0 4px;
	}
	.section-sub {
		font-size: 13px;
		line-height: 1.5;
		color: var(--t);
		margin: 0;
	}
	.templates-section {
		margin-bottom: 40px;
	}
	.saved-hint {
		margin: 0;
		font-size: 13px;
		color: var(--t);
	}
	.saved-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
	}
	@media (max-width: 979px) {
		.saved-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 719px) {
		.saved-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.saved-card {
		position: relative;
		border-radius: 16px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		box-shadow: var(--shadow-soft);
		overflow: hidden;
	}
	.saved-link {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
	}
	.saved-preview {
		aspect-ratio: 4 / 5;
		background: #0a0a0c;
		overflow: hidden;
	}
	.saved-preview img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.saved-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 16px;
		text-align: center;
		font-size: 13px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.72);
	}
	.saved-footer {
		padding: 10px 12px 12px;
		border-top: 1px solid var(--panel-border);
	}
	.saved-name {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.saved-meta {
		margin: 2px 0 0;
		font-size: 10px;
		color: var(--t);
	}
	.saved-del {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.saved-card:hover .saved-del {
		opacity: 1;
	}
	.saved-del:hover {
		background: rgba(220, 38, 38, 0.85);
	}
</style>
