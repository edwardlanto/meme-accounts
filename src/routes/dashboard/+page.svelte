<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';
	import {
		ArrowRight,
		ImagePlus,
		Trash2,
		ArrowUpRight,
		Rows3,
		Video,
		LayoutTemplate,
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

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
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			goto('/login');
			return;
		}
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

<div class="dash-page flex flex-col gap-8">
	<!-- Hero -->
	<Card.Root class="relative overflow-hidden bg-muted/40 py-0">
		<div
			class="pointer-events-none absolute -top-[30%] left-[12%] h-[420px] w-[640px] bg-[radial-gradient(closest-side,rgba(123,241,168,0.28),transparent_72%),radial-gradient(closest-side_at_78%_40%,rgba(232,255,72,0.12),transparent_70%)] blur-sm"
			aria-hidden="true"
		></div>
		<Card.Content class="relative z-10 flex min-h-[220px] flex-col justify-center gap-5 px-8 py-9 sm:px-10">
			<Badge variant="secondary" class="w-fit gap-1.5 rounded-full px-3 py-1">
				<span class="size-1.5 rounded-full bg-primary" aria-hidden="true"></span>
				Studio
			</Badge>
			<h1 class="dash-page-title text-foreground">Create your next post</h1>
			<div class="flex flex-wrap gap-2.5">
				<Button href="/dashboard/templates" size="lg">
					Browse templates
					<ArrowRight data-icon="inline-end" />
				</Button>
				<Button href="/dashboard/bulk" variant="outline" size="lg">Open Bulk</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Quick actions -->
	<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
		{#each primaryCards as c (c.href)}
			{@const Icon = c.icon}
			<a href={c.href} class="group block outline-none">
				<Card.Root
					size="sm"
					class="h-full transition-colors group-hover:bg-muted/50 group-focus-visible:ring-2 group-focus-visible:ring-ring"
				>
					<Card.Content class="flex items-center gap-3 py-1">
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground ring-1 ring-foreground/10"
						>
							<Icon class="size-[18px]" />
						</div>
						<div class="min-w-0 flex-1">
							<Card.Title class="text-sm font-semibold">{c.label}</Card.Title>
							<Card.Description class="text-xs">{c.sub}</Card.Description>
						</div>
						<ArrowUpRight
							class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
						/>
					</Card.Content>
				</Card.Root>
			</a>
		{/each}
	</section>

	<!-- Recent carousels -->
	<section class="flex flex-col gap-4" aria-labelledby="recent-carousels-heading" aria-busy={loading}>
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div class="min-w-0 space-y-1">
				<h2 id="recent-carousels-heading" class="text-base font-semibold tracking-tight">
					Recent carousels
				</h2>
				<p class="text-sm text-muted-foreground">
					Your latest Studio drafts — open one to keep editing.
				</p>
			</div>
			<Button href="/dashboard/carousels" variant="outline" size="sm">
				View all
				<ArrowRight data-icon="inline-end" />
			</Button>
		</div>

		{#if loading}
			<div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
				{#each [0, 1, 2, 3] as i (i)}
					<Skeleton class="aspect-4/5 rounded-xl" />
				{/each}
			</div>
		{:else if recentCarousels.length > 0}
			<div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each recentCarousels as row (row.id)}
					{@const pv = draftPreviewUrl(row, recentCarouselThumbById)}
					<Card.Root class="group relative gap-0 py-0 [--card-spacing:0]">
						<a
							class="absolute inset-0 z-0"
							href="/dashboard/studio?draft={row.id}"
							aria-label="Open carousel {carouselTitle(row)}"
						></a>
						<div class="relative aspect-4/5 overflow-hidden bg-muted">
							{#if pv.url}
								<img
									src={pv.url}
									alt=""
									class="size-full {pv.fullSlideRaster
										? 'object-contain bg-black/35'
										: 'object-cover'}"
									referrerpolicy="no-referrer"
									loading="lazy"
									draggable="false"
								/>
							{:else}
								<div
									class="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground"
								>
									<span class="line-clamp-3">{carouselTitle(row)}</span>
								</div>
							{/if}
							<div
								class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/35 to-transparent p-3 pt-10"
							>
								<p class="truncate text-xs font-semibold text-white">{carouselTitle(row)}</p>
								<p class="text-[11px] text-white/70">{timeAgo(row.updated_at)}</p>
							</div>
						</div>
						<Button
							type="button"
							variant="destructive"
							size="icon-sm"
							class="absolute top-2.5 right-2.5 z-10 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
							title="Delete carousel"
							aria-label="Delete carousel"
							onclick={() => void deleteRecentCarousel(row.id)}
						>
							<Trash2 />
						</Button>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<Empty.Root class="border border-dashed">
				<Empty.Header>
					<Empty.Title>No carousels yet</Empty.Title>
					<Empty.Description>
						Pick a template to start one — it will show up here.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href="/dashboard/templates" size="sm">Browse templates</Button>
				</Empty.Content>
			</Empty.Root>
		{/if}
	</section>

	<!-- Saved templates -->
	<section class="flex flex-col gap-4" aria-labelledby="saved-templates-heading" aria-busy={loading}>
		<div class="space-y-1">
			<h2 id="saved-templates-heading" class="text-base font-semibold tracking-tight">
				Saved templates
			</h2>
			<p class="text-sm text-muted-foreground">
				Layouts you saved from Studio. Open one to keep editing, or manage the full list on
				<a class="font-medium text-foreground underline-offset-4 hover:underline" href="/dashboard/carousels"
					>Carousels</a
				>.
			</p>
		</div>

		{#if loading}
			<div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
				{#each [0, 1, 2, 3] as i (`saved-${i}`)}
					<Skeleton class="aspect-4/5 rounded-xl" />
				{/each}
			</div>
		{:else if studioSavedTemplates.length > 0}
			<div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each studioSavedTemplates as row (row.id)}
					{@const pv = draftPreviewUrl(row, studioSavedTemplateThumbById)}
					<Card.Root class="group relative gap-0 py-0 [--card-spacing:0]">
						<a
							class="absolute inset-0 z-0"
							href="/dashboard/studio?saved={row.id}"
							aria-label="Open saved template {studioSavedTemplateName(row)}"
						></a>
						<div class="relative aspect-4/5 overflow-hidden bg-muted">
							{#if pv.url}
								<img
									src={pv.url}
									alt=""
									class="size-full {pv.fullSlideRaster
										? 'object-contain bg-black/35'
										: 'object-cover'}"
									referrerpolicy="no-referrer"
									loading="lazy"
									draggable="false"
								/>
							{:else}
								<div
									class="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground"
								>
									<span class="line-clamp-3">{studioSavedTemplateName(row)}</span>
								</div>
							{/if}
						</div>
						<Button
							type="button"
							variant="destructive"
							size="icon-sm"
							class="absolute top-2.5 right-2.5 z-10 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
							title="Delete template"
							aria-label="Delete template"
							onclick={() => void deleteStudioSavedTemplate(row.id)}
						>
							<Trash2 />
						</Button>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<Empty.Root class="border border-dashed">
				<Empty.Header>
					<Empty.Title>No saved templates yet</Empty.Title>
					<Empty.Description>
						In Studio, save a layout and it will show up here.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href="/dashboard/studio" variant="outline" size="sm">Open Studio</Button>
				</Empty.Content>
			</Empty.Root>
		{/if}
	</section>
</div>
