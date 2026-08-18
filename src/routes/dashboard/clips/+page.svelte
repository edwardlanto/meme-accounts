<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { stripMarkup } from '$lib/highlight';
	import {
		coerceTemplateId,
		isBrandStackFamily,
		isVideoStoryFamily,
		STUDIO_TEMPLATES,
		type TemplateId,
	} from '$lib/studio/template-ids';
	import { defaultThumbForTemplate } from '$lib/studio/slide-content-defaults';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';
	import {
		loadBulkWorkspace,
		clearBulkWorkspace,
		clearBulkHistory,
		purgeBulkHistoryByShowIds,
		rememberDeletedBulkWorkspaceIds,
		notifyBulkWorkspacesDeleted,
	} from '$lib/studio/bulk-workspace';
	import { type BulkSlide } from '$lib/studio/bulk-to-studio';
	import BulkLibraryCover from '$lib/components/bulk/BulkLibraryCover.svelte';
	import {
		ImagePlus,
		Plus,
		Trash2,
		Edit2,
		Clock,
		CheckCircle,
		FileText,
		Loader,
		Rows3,
		Video,
		MoreHorizontal,
	} from 'lucide-svelte';
	import { consumeFlashToast } from '$lib/ui/flash-toast';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	/** Must match `DRAFT_KIND` in `dashboard/studio/+page.svelte`. */
	const STUDIO_WORKSPACE_DRAFT_KIND = 'news_studio';
	/** Must match `STUDIO_SAVED_TEMPLATE_KIND` in `dashboard/studio/+page.svelte`. */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';

	type BulkShowCard = {
		id: string;
		title: string;
		slideCount: number;
		headline: string;
		thumb: string;
		template: string;
		/** Total clip/media length in seconds when known. */
		durationSec?: number;
		/** Slim first slide for live template preview on the card. */
		coverSlide?: BulkSlide | null;
		fromVideoClips?: boolean;
	};

	type BulkWorkspaceCard = {
		id: string;
		title: string;
		topic: string;
		thumbnailUrl: string | null;
		clipProjectId?: string | null;
		fromVideoClips?: boolean;
		showCount: number;
		titles: string[];
		updatedAt: string;
		url: string;
		shows: BulkShowCard[];
	};

	type ClipProjectCard = {
		id: string;
		title: string;
		thumbnailUrl: string | null;
		sourceTitle: string;
		clipCount: number;
		showCount: number;
		summary: string;
		updatedAt: string;
		hasBulkShows: boolean;
		url: string;
		shows: BulkShowCard[];
	};

	let carousels: any[] = $state([]);
	let studioDrafts = $state<{ id: string; updated_at: string; state?: Record<string, unknown> }[]>([]);
	let studioSavedTemplates = $state<{ id: string; updated_at: string; state?: Record<string, unknown> }[]>([]);
	let bulkWorkspaces = $state<BulkWorkspaceCard[]>([]);
	let clipProjects = $state<ClipProjectCard[]>([]);
	let studioDraftThumbById = $state<Record<string, string>>({});
	let studioSavedTemplateThumbById = $state<Record<string, string>>({});
	let loading = $state(false);
	let userId = $state('');
	let mounted = $state(false);
	let filterTab = $state<'all' | 'draft' | 'published' | 'scheduled'>('all');
	/** Multi-select for Studio drafts (bulk delete). */
	let selectedDraftIds = $state<string[]>([]);
	let bulkDeletingDrafts = $state(false);
	/** Multi-select for YouTube clip cards (keys from clipShowCards). */
	let selectedClipKeys = $state<string[]>([]);
	let bulkDeletingClips = $state(false);
	/** Multi-select for From Bulk cards (keys from bulkShowCards). */
	let selectedBulkKeys = $state<string[]>([]);
	let bulkDeletingBulk = $state(false);
	/** Track hero URLs that failed to load so we fall back to text cards. */
	let brokenDraftThumbIds = $state<Record<string, true>>({});
	let brokenSavedThumbIds = $state<Record<string, true>>({});
	let brokenClipThumbKeys = $state<Record<string, true>>({});
	let flashToast = $state('');
	let flashToastTimer: ReturnType<typeof setTimeout> | null = null;

	let { data } = $props();

	function applyServerLibrary(payload: {
		bulkWorkspaces?: BulkWorkspaceCard[];
		clipProjects?: ClipProjectCard[];
	}) {
		bulkWorkspaces = Array.isArray(payload.bulkWorkspaces) ? payload.bulkWorkspaces : [];
		clipProjects = Array.isArray(payload.clipProjects) ? payload.clipProjects : [];
	}

	applyServerLibrary(data);

	$effect(() => {
		applyServerLibrary(data);
	});

	function showFlashToast(message: string) {
		const msg = String(message ?? '').trim();
		if (!msg) return;
		flashToast = msg;
		if (flashToastTimer) clearTimeout(flashToastTimer);
		flashToastTimer = setTimeout(() => {
			flashToast = '';
			flashToastTimer = null;
		}, 3600);
	}

	/** Bulk stacks that are not YouTube-clip projects (those get their own section). */
	const topicBulkWorkspaces = $derived(
		bulkWorkspaces.filter((ws) => !ws.clipProjectId && !ws.fromVideoClips),
	);

	/** Prefer cloud bulk workspace when a clip project was already saved there. */
	const orphanClipProjects = $derived(
		(() => {
			const linked = new Set(
				bulkWorkspaces.map((ws) => String(ws.clipProjectId ?? '').trim()).filter(Boolean),
			);
			return clipProjects.filter((p) => !linked.has(p.id));
		})(),
	);

	function showDurationSec(show: BulkShowCard): number {
		const listed = Number(show.durationSec);
		if (Number.isFinite(listed) && listed > 0) return listed;
		const start = Number(show.coverSlide?.clipStart) || 0;
		const end = Number(show.coverSlide?.clipEnd) || 0;
		return end > start ? end - start : 0;
	}

	function formatClipDuration(sec: number): string {
		if (!Number.isFinite(sec) || sec <= 0) return '';
		const total = Math.round(sec);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	const clipShowCards = $derived(
		(() => {
			const orphans = orphanClipProjects;
			const fromLinkedBulk = bulkWorkspaces
				.filter((ws) => !!ws.clipProjectId || !!ws.fromVideoClips)
				.flatMap((ws) => {
					const shows = ws.shows?.length
						? ws.shows
						: ([
								{
									id: '',
									title: ws.title || 'Clips',
									slideCount: 0,
									headline: '',
									thumb: String(ws.thumbnailUrl ?? ''),
									template: 'news',
								},
							] as BulkShowCard[]);
					return shows.map((show, i) => ({
						projectId: ws.clipProjectId || ws.id,
						workspaceId: ws.id,
						projectTitle: ws.topic || ws.title || 'Clips',
						updatedAt: ws.updatedAt,
						/** Open the Bulk workspace for this video (not a single show). */
						href: `/dashboard/bulk/${ws.id}`,
						pill: 'YouTube',
						show: {
							...show,
							thumb: show.thumb || String(ws.thumbnailUrl ?? ''),
						},
						key: `yt-bulk-${ws.id}-${show.id || i}`,
					}));
				});

			const fromOrphans = orphans.flatMap((project) => {
				const shows = project.shows?.length
					? project.shows
					: ([
							{
								id: '',
								title: project.title || 'Clips',
								slideCount: project.clipCount || 0,
								headline: project.summary || '',
								thumb: String(project.thumbnailUrl ?? ''),
								template: 'news',
							},
						] as BulkShowCard[]);
				return shows.map((show, i) => ({
					projectId: project.id,
					workspaceId: '' as string,
					projectTitle: project.title || project.sourceTitle || 'Clips',
					updatedAt: project.updatedAt,
					href: project.url,
					pill: 'YouTube',
					show: {
						...show,
						thumb: show.thumb || String(project.thumbnailUrl ?? ''),
					},
					key: `clip-${project.id}-${show.id || i}`,
				}));
			});

			return [...fromLinkedBulk, ...fromOrphans];
		})(),
	);

	/** Group clip cards by source video so the library is scannable. */
	const clipGroups = $derived(
		(() => {
			const order: string[] = [];
			const map = new Map<
				string,
				{
					groupId: string;
					title: string;
					updatedAt: string;
					cards: (typeof clipShowCards)[number][];
				}
			>();
			for (const card of clipShowCards) {
				const groupId = String(card.projectId || card.workspaceId || card.key);
				let g = map.get(groupId);
				if (!g) {
					g = {
						groupId,
						title: card.projectTitle || 'Clips',
						updatedAt: card.updatedAt,
						cards: [],
					};
					map.set(groupId, g);
					order.push(groupId);
				}
				g.cards.push(card);
				if (new Date(card.updatedAt).getTime() > new Date(g.updatedAt).getTime()) {
					g.updatedAt = card.updatedAt;
					g.title = card.projectTitle || g.title;
				}
			}
			return order.map((id) => map.get(id)!);
		})(),
	);

	/** One compact card per source video — opens Bulk for that project. */
	const clipVideoCards = $derived(
		clipGroups.map((group) => {
			const card = group.cards[0]!;
			const slideCount = group.cards.reduce(
				(sum, c) => sum + Math.max(1, Number(c.show.slideCount) || 1),
				0,
			);
			const durationSec = group.cards.reduce((sum, c) => sum + showDurationSec(c.show), 0);
			return {
				groupId: group.groupId,
				title: group.title,
				updatedAt: group.updatedAt,
				href: card.href,
				pill: card.pill,
				thumb: card.show.thumb || '',
				headline: card.show.headline || card.show.title || group.title,
				clipCount: group.cards.length,
				slideCount,
				durationSec,
				cardKeys: group.cards.map((c) => c.key),
				key: `video-${group.groupId}`,
			};
		}),
	);

	const bulkShowCards = $derived(
		(() => {
			const seenShowIds = new Set<string>();
			const seenContent = new Set<string>();
			const out: Array<{
				workspaceId: string;
				workspaceTopic: string;
				updatedAt: string;
				href: string;
				show: BulkShowCard;
				key: string;
			}> = [];
			for (const ws of topicBulkWorkspaces) {
				const shows = ws.shows?.length
					? ws.shows
					: ([
							{
								id: '',
								title: ws.title || 'Bulk carousel',
								slideCount: 0,
								headline: '',
								thumb: String(ws.thumbnailUrl ?? ''),
								template: 'news',
							},
						] as BulkShowCard[]);
				for (let i = 0; i < shows.length; i++) {
					const show = shows[i]!;
					const showId = String(show.id ?? '').trim();
					if (showId && seenShowIds.has(showId)) continue;
					const contentKey = [
						String(ws.topic ?? '').trim().toLowerCase(),
						String(show.headline ?? show.title ?? '')
							.trim()
							.toLowerCase(),
						String(show.thumb ?? '').trim(),
					].join('|');
					if (contentKey.replace(/\|/g, '') && seenContent.has(contentKey)) continue;
					if (showId) seenShowIds.add(showId);
					if (contentKey.replace(/\|/g, '')) seenContent.add(contentKey);
					out.push({
						workspaceId: ws.id,
						workspaceTopic: ws.topic || ws.title,
						updatedAt: ws.updatedAt,
						href: showId
							? `/dashboard/bulk/${ws.id}?show=${encodeURIComponent(showId)}`
							: `/dashboard/bulk/${ws.id}`,
						show,
						key: `bulk-${ws.id}-${showId || i}`,
					});
				}
			}
			return out;
		})(),
	);

	const libraryEmpty = $derived(clipVideoCards.length === 0);

	function studioDraftTitle(d: { state?: Record<string, unknown> }): string {
		const slides = d.state?.slides;
		if (Array.isArray(slides) && slides.length) {
			const t = stripMarkup(String(slides[0] ?? ''))
				.trim()
				.replace(/\s+/g, ' ');
			if (t) return t.length > 72 ? `${t.slice(0, 69)}…` : t;
		}
		const src = d.state?.source;
		if (typeof src === 'string' && src.trim()) {
			const t = src.trim();
			return t.length > 72 ? `${t.slice(0, 69)}…` : t;
		}
		return 'Studio draft';
	}

	function isLightHex(hex: string): boolean {
		const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
		if (!m) return false;
		const v = parseInt(m[1], 16);
		const r = (v >> 16) & 0xff;
		const g = (v >> 8) & 0xff;
		const b = v & 0xff;
		const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
		return L > 0.62;
	}

	function strArr(v: unknown): string[] {
		return Array.isArray(v) ? v.map((x) => String(x ?? '')) : [];
	}

	function templateLabelFromId(id: string): string {
		const t = coerceTemplateId(id);
		return STUDIO_TEMPLATES.find((x) => x.id === t)?.label ?? t;
	}

	type StudioDraftPreview = {
		templateLabel: string;
		headline: string;
		textColor: string;
		bgSolid: string;
		heroUrl: string;
		slideCount: number;
		slideHints: string[];
		filmLight: boolean;
		fullSlideRaster: boolean;
	};

	function isUsableThumbUrl(u: string): boolean {
		const s = String(u ?? '').trim();
		if (!s) return false;
		if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) return true;
		if (s.startsWith('data:image/') && s.length < 2_500_000) return true;
		return false;
	}

	function studioDraftPreview(d: {
		id: string;
		updated_at?: string;
		state?: Record<string, unknown>;
	}): StudioDraftPreview {
		const s = d.state ?? {};
		const slideList = strArr(s.slides);
		const slideCount = Math.max(1, slideList.length);
		const templates = strArr(s.slideTemplates);
		const tpl = coerceTemplateId(templates[0] ?? 'news');
		const templateLabel = templateLabelFromId(templates[0] ?? tpl);

		const bgMap = (s.bgImagesByTemplate ?? {}) as Record<string, string[]>;
		const pickHero = (key: string) => {
			const u = String(bgMap[key]?.[0] ?? '').trim();
			return isUsableThumbUrl(u) ? u : '';
		};

		const storagePreviewHero = (() => {
			const id = String(d.id ?? '').trim();
			if (id && brokenDraftThumbIds[id]) return '';
			const signed = id ? (studioDraftThumbById[id] ?? '').trim() : '';
			if (signed.startsWith('http://') || signed.startsWith('https://')) return signed;
			const u = String((s as Record<string, unknown>).draftPreviewUrl ?? '').trim();
			return u.startsWith('http://') || u.startsWith('https://') ? u : '';
		})();

		const thumbFallback = () => {
			const demo = defaultThumbForTemplate(tpl as TemplateId);
			return isUsableThumbUrl(demo) ? demo : '';
		};

		let headline = '';
		if (tpl === 'tweet') {
			headline = stripMarkup(String(strArr(s.tweetTopTextBySlide)[0] ?? '')).trim();
		} else if (tpl === 'blackText') {
			headline = stripMarkup(String(strArr(s.blackTextHeadlineBySlide)[0] ?? '')).trim();
		} else if (tpl === 'textCarousel' || tpl === 'whiteThread' || tpl === 'whiteMedia') {
			headline = stripMarkup(String(strArr(s.textCarouselTextBySlide)[0] ?? '')).trim();
		} else if (isVideoStoryFamily(tpl) || isBrandStackFamily(tpl)) {
			headline = stripMarkup(String(strArr(s.videoStoryHeadlineBySlide)[0] ?? '')).trim();
		} else if (tpl === 'imageQuote') {
			headline = stripMarkup(String(strArr(s.imageQuoteTextBySlide)[0] ?? '')).trim();
		} else if (tpl === 'article') {
			headline = stripMarkup(String(strArr(s.articleTextBySlide)[0] ?? '')).trim();
		} else {
			headline = stripMarkup(String(slideList[0] ?? '')).trim();
		}
		if (!headline) headline = studioDraftTitle(d);

		const stripLen = Math.min(slideCount, 10);
		const slideHints = Array.from({ length: stripLen }, (_, i) => {
			const raw = stripMarkup(String(slideList[i] ?? '')).trim();
			return raw ? raw.slice(0, 2).toUpperCase() : '·';
		});

		let bgSolid = '#111111';
		let textColor = '#f5f5f5';
		let heroUrl = '';

		if (tpl === 'news') {
			heroUrl = storagePreviewHero || pickHero('news') || thumbFallback();
			const solid = String(strArr(s.newsSolidBgBySlide)[0] ?? '').trim();
			bgSolid = solid || (heroUrl ? '#0a0a0a' : '#ffffff');
			const tc = String(s.textColor ?? '').trim();
			if (tc) textColor = tc;
			else if (heroUrl) textColor = '#ffffff';
			else textColor = isLightHex(bgSolid) ? '#0a0a0a' : '#f5f5f5';
		} else if (tpl === 'tweet') {
			bgSolid = '#ffffff';
			textColor = '#0a0a0a';
			heroUrl = storagePreviewHero || pickHero('tweet') || thumbFallback();
		} else if (tpl === 'blackText') {
			bgSolid = '#000000';
			textColor = '#e5e5e5';
			heroUrl = storagePreviewHero || pickHero('blackText');
		} else if (tpl === 'textCarousel' || tpl === 'whiteThread') {
			bgSolid = tpl === 'whiteThread' ? '#ffffff' : '#0a0a0a';
			textColor = tpl === 'whiteThread' ? '#0a0a0a' : '#f5f5f5';
			heroUrl = storagePreviewHero;
		} else if (tpl === 'whiteMedia') {
			bgSolid = '#ffffff';
			textColor = '#0a0a0a';
			heroUrl = storagePreviewHero || pickHero('whiteMedia') || thumbFallback();
		} else if (isVideoStoryFamily(tpl) || isBrandStackFamily(tpl)) {
			bgSolid = '#0a0a0a';
			textColor = '#fafafa';
			heroUrl = storagePreviewHero || pickHero(tpl) || thumbFallback();
		} else if (tpl === 'imageQuote') {
			bgSolid = '#0f172a';
			textColor = '#fafafa';
			heroUrl = storagePreviewHero || pickHero('imageQuote') || thumbFallback();
		} else if (tpl === 'photoTopic' || tpl === 'photoCaption') {
			bgSolid = '#0a0a0a';
			textColor = '#fafafa';
			heroUrl = storagePreviewHero || pickHero(tpl) || thumbFallback();
		} else if (tpl === 'article') {
			bgSolid = '#fafafa';
			textColor = '#0a0a0a';
			heroUrl = storagePreviewHero || pickHero('article');
		} else {
			heroUrl = storagePreviewHero || pickHero(tpl) || thumbFallback();
		}

		const fullSlideRaster = !!storagePreviewHero;
		const filmLight =
			!fullSlideRaster &&
			(tpl === 'tweet' ||
				tpl === 'whiteThread' ||
				tpl === 'whiteMedia' ||
				(tpl === 'article' && !heroUrl) ||
				(tpl === 'news' && !heroUrl && isLightHex(bgSolid)));

		return {
			templateLabel,
			headline,
			textColor,
			bgSolid,
			heroUrl,
			slideCount,
			slideHints,
			filmLight,
			fullSlideRaster,
		};
	}

	async function deleteStudioDraft(id: string, opts?: { skipConfirm?: boolean }) {
		if (!opts?.skipConfirm && !confirm('Delete this studio draft? This cannot be undone.')) return;
		try {
			const row = studioDrafts.find((x) => x.id === id);
			const st = row?.state as Record<string, unknown> | undefined;
			const key =
				String(st?.draftPreviewKey ?? '').trim() || String(st?.draftPreviewPath ?? '').trim();
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
			alert(error.message ?? 'Could not delete draft');
			return;
		}
		studioDrafts = studioDrafts.filter((x) => x.id !== id);
		selectedDraftIds = selectedDraftIds.filter((x) => x !== id);
		const nextThumb = { ...studioDraftThumbById };
		delete nextThumb[id];
		studioDraftThumbById = nextThumb;
		if (brokenDraftThumbIds[id]) {
			const nextBroken = { ...brokenDraftThumbIds };
			delete nextBroken[id];
			brokenDraftThumbIds = nextBroken;
		}
	}

	const allDraftsSelected = $derived(
		studioDrafts.length > 0 && selectedDraftIds.length === studioDrafts.length,
	);

	function toggleDraftSelected(id: string) {
		if (selectedDraftIds.includes(id)) {
			selectedDraftIds = selectedDraftIds.filter((x) => x !== id);
		} else {
			selectedDraftIds = [...selectedDraftIds, id];
		}
	}

	function toggleSelectAllDrafts() {
		if (allDraftsSelected) selectedDraftIds = [];
		else selectedDraftIds = studioDrafts.map((d) => d.id);
	}

	async function deleteSelectedDrafts() {
		const ids = [...selectedDraftIds];
		if (!ids.length) return;
		if (
			!confirm(
				`Delete ${ids.length} studio draft${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
			)
		) {
			return;
		}
		bulkDeletingDrafts = true;
		try {
			for (const id of ids) {
				await deleteStudioDraft(id, { skipConfirm: true });
			}
			selectedDraftIds = [];
		} finally {
			bulkDeletingDrafts = false;
		}
	}

	const allClipsSelected = $derived(
		clipShowCards.length > 0 && selectedClipKeys.length === clipShowCards.length,
	);

	function toggleClipSelected(key: string) {
		if (selectedClipKeys.includes(key)) {
			selectedClipKeys = selectedClipKeys.filter((x) => x !== key);
		} else {
			selectedClipKeys = [...selectedClipKeys, key];
		}
	}

	function toggleSelectAllClips() {
		if (allClipsSelected) selectedClipKeys = [];
		else selectedClipKeys = clipShowCards.map((c) => c.key);
	}

	function toggleSelectClipGroup(groupId: string) {
		const group = clipGroups.find((g) => g.groupId === groupId);
		if (!group) return;
		const keys = group.cards.map((c) => c.key);
		const allOn = keys.every((k) => selectedClipKeys.includes(k));
		if (allOn) {
			selectedClipKeys = selectedClipKeys.filter((k) => !keys.includes(k));
		} else {
			const set = new Set(selectedClipKeys);
			for (const k of keys) set.add(k);
			selectedClipKeys = [...set];
		}
	}

	function groupAllSelected(groupId: string): boolean {
		const group = clipGroups.find((g) => g.groupId === groupId);
		if (!group?.cards.length) return false;
		return group.cards.every((c) => selectedClipKeys.includes(c.key));
	}

	function syncWorkspaceShowsLocal(
		workspaceId: string,
		nextShows: BulkShowCard[],
		clipPid: string,
	) {
		if (nextShows.length === 0) {
			bulkWorkspaces = bulkWorkspaces.filter((w) => w.id !== workspaceId);
			if (clipPid) clipProjects = clipProjects.filter((p) => p.id !== clipPid);
			return;
		}
		bulkWorkspaces = bulkWorkspaces.map((w) =>
			w.id === workspaceId
				? {
						...w,
						shows: nextShows,
						showCount: nextShows.length,
						titles: nextShows.slice(0, 4).map((s) => s.title || 'Untitled'),
						thumbnailUrl: nextShows[0]?.thumb || w.thumbnailUrl,
					}
				: w,
		);
	}

	async function deleteWorkspaceAndClipProject(workspaceId: string, clipPid: string) {
		const ws = bulkWorkspaces.find((w) => w.id === workspaceId);
		const showIds = (ws?.shows ?? []).map((s) => String(s.id ?? '').trim()).filter(Boolean);
		const res = await fetch(`/api/bulk/workspaces/${workspaceId}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Could not delete workspace');
		bulkWorkspaces = bulkWorkspaces.filter((w) => w.id !== workspaceId);
		if (userId) {
			rememberDeletedBulkWorkspaceIds(userId, [workspaceId]);
			if (showIds.length) purgeBulkHistoryByShowIds(userId, showIds);
			else clearBulkHistory(userId);
			const local = loadBulkWorkspace(userId);
			if (local?.cloudWorkspaceId && local.cloudWorkspaceId === workspaceId) {
				clearBulkWorkspace(userId);
			}
			notifyBulkWorkspacesDeleted([workspaceId]);
		}
		if (clipPid) {
			await fetch(`/api/videos/clip-projects/${clipPid}`, { method: 'DELETE' }).catch(() => {});
			clipProjects = clipProjects.filter((p) => p.id !== clipPid);
		}
	}

	/** Remove one or more shows from a bulk YouTube workspace (PATCH), or delete the stack. */
	async function removeShowsFromWorkspace(workspaceId: string, showIds: string[]) {
		const ws = bulkWorkspaces.find((w) => w.id === workspaceId);
		const clipPid = String(ws?.clipProjectId ?? '').trim();
		const ids = new Set(showIds.map((id) => String(id || '').trim()).filter(Boolean));

		if (!ids.size) {
			await deleteWorkspaceAndClipProject(workspaceId, clipPid);
			return;
		}

		const getRes = await fetch(`/api/bulk/workspaces/${workspaceId}`);
		if (!getRes.ok) throw new Error('Could not load workspace');
		const payload = (await getRes.json()) as {
			workspace?: { shows?: { id?: string }[]; selectedShowId?: string | null };
		};
		const fullShows = Array.isArray(payload.workspace?.shows) ? payload.workspace!.shows! : [];
		const remaining = fullShows.filter((s) => !ids.has(String(s.id ?? '').trim()));

		if (remaining.length === 0) {
			await deleteWorkspaceAndClipProject(workspaceId, clipPid);
			return;
		}

		const selectedShowId = String(payload.workspace?.selectedShowId ?? '').trim();
		const patchRes = await fetch(`/api/bulk/workspaces/${workspaceId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				shows: remaining,
				selectedShowId:
					selectedShowId && ids.has(selectedShowId)
						? String((remaining[0] as { id?: string })?.id ?? '') || null
						: undefined,
			}),
		});
		if (!patchRes.ok) throw new Error('Could not delete clip');

		const nextLocal = (ws?.shows ?? []).filter((s) => !ids.has(String(s.id ?? '').trim()));
		syncWorkspaceShowsLocal(workspaceId, nextLocal, clipPid);
	}

	/** Remove shows from an orphan clip project, or delete the project. */
	async function removeShowsFromClipProject(projectId: string, showIds: string[]) {
		const ids = new Set(showIds.map((id) => String(id || '').trim()).filter(Boolean));
		if (!ids.size) {
			const res = await fetch(`/api/videos/clip-projects/${projectId}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Could not delete clip project');
			clipProjects = clipProjects.filter((p) => p.id !== projectId);
			return;
		}

		const getRes = await fetch(`/api/videos/clip-projects/${projectId}`);
		if (!getRes.ok) throw new Error('Could not load clip project');
		const payload = (await getRes.json()) as {
			project?: {
				title?: string;
				thumbnailUrl?: string | null;
				source?: Record<string, unknown>;
				clips?: { id?: string }[];
				summary?: string;
				demo?: boolean;
				model?: string;
				bulkShows?: { id?: string }[] | null;
			};
		};
		const project = payload.project;
		if (!project) throw new Error('Clip project not found');

		const bulkShows = Array.isArray(project.bulkShows) ? project.bulkShows : [];
		if (bulkShows.length > 0) {
			const remainingShows = bulkShows.filter((s) => !ids.has(String(s.id ?? '').trim()));
			if (remainingShows.length === 0) {
				const res = await fetch(`/api/videos/clip-projects/${projectId}`, { method: 'DELETE' });
				if (!res.ok) throw new Error('Could not delete clip project');
				clipProjects = clipProjects.filter((p) => p.id !== projectId);
				return;
			}
			const remainingClips = Array.isArray(project.clips)
				? project.clips.filter((c) => !ids.has(String(c.id ?? '').trim()))
				: project.clips;
			const postRes = await fetch('/api/videos/clip-projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: projectId,
					title: project.title,
					thumbnailUrl: project.thumbnailUrl,
					source: project.source ?? {},
					clips: remainingClips ?? [],
					summary: project.summary ?? '',
					demo: project.demo ?? false,
					model: project.model ?? '',
					bulkShows: remainingShows,
				}),
			});
			if (!postRes.ok) throw new Error('Could not delete clip');
			clipProjects = clipProjects.map((p) =>
				p.id === projectId
					? {
							...p,
							shows: (p.shows ?? []).filter((s) => !ids.has(String(s.id ?? '').trim())),
							showCount: Math.max(0, (p.showCount ?? 1) - ids.size),
							clipCount: Array.isArray(remainingClips) ? remainingClips.length : p.clipCount,
						}
					: p,
			);
			return;
		}

		const res = await fetch(`/api/videos/clip-projects/${projectId}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Could not delete clip project');
		clipProjects = clipProjects.filter((p) => p.id !== projectId);
	}

	async function removeClipCard(card: (typeof clipShowCards)[number]) {
		const showId = String(card.show?.id ?? '').trim();
		if (card.workspaceId) {
			await removeShowsFromWorkspace(card.workspaceId, showId ? [showId] : []);
			return;
		}
		const pid = String(card.projectId ?? '').trim();
		if (!pid) return;
		await removeShowsFromClipProject(pid, showId ? [showId] : []);
	}

	async function deleteSelectedClips() {
		const keys = [...selectedClipKeys];
		if (!keys.length) return;
		const cards = clipShowCards.filter((c) => keys.includes(c.key));
		if (
			!confirm(
				`Delete ${cards.length} YouTube clip${cards.length === 1 ? '' : 's'}? This cannot be undone.`,
			)
		) {
			return;
		}
		bulkDeletingClips = true;
		try {
			const byWorkspace = new Map<string, string[]>();
			const byProject = new Map<string, string[]>();
			const wholeWorkspace: string[] = [];
			const wholeProject: string[] = [];

			for (const card of cards) {
				const showId = String(card.show?.id ?? '').trim();
				if (card.workspaceId) {
					if (!showId) {
						wholeWorkspace.push(card.workspaceId);
						continue;
					}
					const list = byWorkspace.get(card.workspaceId) ?? [];
					list.push(showId);
					byWorkspace.set(card.workspaceId, list);
				} else {
					const pid = String(card.projectId ?? '').trim();
					if (!pid) continue;
					if (!showId) {
						wholeProject.push(pid);
						continue;
					}
					const list = byProject.get(pid) ?? [];
					list.push(showId);
					byProject.set(pid, list);
				}
			}

			for (const id of [...new Set(wholeWorkspace)]) {
				const ws = bulkWorkspaces.find((w) => w.id === id);
				await deleteWorkspaceAndClipProject(id, String(ws?.clipProjectId ?? '').trim());
			}
			for (const [workspaceId, showIds] of byWorkspace) {
				if (wholeWorkspace.includes(workspaceId)) continue;
				await removeShowsFromWorkspace(workspaceId, showIds);
			}
			for (const id of [...new Set(wholeProject)]) {
				await removeShowsFromClipProject(id, []);
			}
			for (const [projectId, showIds] of byProject) {
				if (wholeProject.includes(projectId)) continue;
				await removeShowsFromClipProject(projectId, showIds);
			}
			selectedClipKeys = [];
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Could not delete');
		} finally {
			bulkDeletingClips = false;
		}
	}

	async function deleteOneClipCard(card: (typeof clipShowCards)[number]) {
		if (!confirm('Delete this YouTube clip? This cannot be undone.')) return;
		try {
			await removeClipCard(card);
			selectedClipKeys = selectedClipKeys.filter((k) => k !== card.key);
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Could not delete');
		}
	}

	async function deleteClipVideoGroup(groupId: string) {
		const group = clipGroups.find((g) => g.groupId === groupId);
		if (!group?.cards.length) return;
		if (
			!confirm(
				`Delete ${group.cards.length} clip${group.cards.length === 1 ? '' : 's'} from this video? This cannot be undone.`,
			)
		) {
			return;
		}
		bulkDeletingClips = true;
		try {
			const keys = new Set(group.cards.map((c) => c.key));
			selectedClipKeys = selectedClipKeys.filter((k) => !keys.has(k));
			// Prefer deleting the whole workspace/project when every card is included.
			const first = group.cards[0]!;
			if (first.workspaceId) {
				const ws = bulkWorkspaces.find((w) => w.id === first.workspaceId);
				await deleteWorkspaceAndClipProject(
					first.workspaceId,
					String(ws?.clipProjectId ?? first.projectId ?? '').trim(),
				);
			} else if (first.projectId) {
				await removeShowsFromClipProject(String(first.projectId), []);
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Could not delete');
		} finally {
			bulkDeletingClips = false;
		}
	}

	onMount(() => {
		mounted = true;
		const flash = consumeFlashToast();
		if (flash) showFlashToast(flash);

		void (async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				goto('/login');
				return;
			}
			userId = user.id;

			// Do not auto-create Bulk library rows from orphan clips — that resurrected deleted carousels.
			try {
				const [bulkRefresh, clipRefresh] = await Promise.all([
					fetch('/api/bulk/workspaces')
						.then(async (res) =>
							res.ok ? ((await res.json()) as { workspaces?: BulkWorkspaceCard[] }) : null,
						)
						.catch(() => null),
					fetch('/api/videos/clip-projects')
						.then(async (res) =>
							res.ok ? ((await res.json()) as { projects?: ClipProjectCard[] }) : null,
						)
						.catch(() => null),
				]);
				if (bulkRefresh?.workspaces) bulkWorkspaces = bulkRefresh.workspaces;
				if (clipRefresh?.projects) clipProjects = clipRefresh.projects;
			} catch {
				/* ignore */
			}
		})();
	});

	const allBulkSelected = $derived(
		bulkShowCards.length > 0 && selectedBulkKeys.length === bulkShowCards.length,
	);

	function toggleBulkSelected(key: string) {
		if (selectedBulkKeys.includes(key)) {
			selectedBulkKeys = selectedBulkKeys.filter((x) => x !== key);
		} else {
			selectedBulkKeys = [...selectedBulkKeys, key];
		}
	}

	function toggleSelectAllBulk() {
		if (allBulkSelected) selectedBulkKeys = [];
		else selectedBulkKeys = bulkShowCards.map((c) => c.key);
	}

	async function deleteOneBulkCard(card: (typeof bulkShowCards)[number]) {
		const showId = String(card.show?.id ?? '').trim();
		const label = card.show.title || card.show.headline || 'this carousel';
		if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
		try {
			await removeShowsFromWorkspace(card.workspaceId, showId ? [showId] : []);
			selectedBulkKeys = selectedBulkKeys.filter((k) => k !== card.key);
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Could not delete');
		}
	}

	async function deleteSelectedBulk() {
		const keys = [...selectedBulkKeys];
		if (!keys.length) return;
		const cards = bulkShowCards.filter((c) => keys.includes(c.key));
		if (
			!confirm(
				`Delete ${cards.length} bulk carousel${cards.length === 1 ? '' : 's'}? This cannot be undone.`,
			)
		) {
			return;
		}
		bulkDeletingBulk = true;
		try {
			const byWorkspace = new Map<string, string[]>();
			const wholeWorkspace: string[] = [];

			for (const card of cards) {
				const showId = String(card.show?.id ?? '').trim();
				if (!showId) {
					wholeWorkspace.push(card.workspaceId);
					continue;
				}
				const list = byWorkspace.get(card.workspaceId) ?? [];
				list.push(showId);
				byWorkspace.set(card.workspaceId, list);
			}

			for (const id of [...new Set(wholeWorkspace)]) {
				await removeShowsFromWorkspace(id, []);
			}
			for (const [workspaceId, showIds] of byWorkspace) {
				if (wholeWorkspace.includes(workspaceId)) continue;
				await removeShowsFromWorkspace(workspaceId, showIds);
			}
			selectedBulkKeys = [];
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Could not delete');
		} finally {
			bulkDeletingBulk = false;
		}
	}

	function studioSavedTemplateName(row: { state?: Record<string, unknown> }): string {
		const raw = String((row.state as Record<string, unknown> | undefined)?._templateName ?? '').trim();
		return raw || 'Untitled carousel';
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
					String(s?.draftPreviewKey ?? '').trim() || String(s?.draftPreviewPath ?? '').trim();
				if (!key) return;
				try {
					const { url } = await r2SignRead({ key });
					if (url) next[id] = url;
				} catch {
					// ignore
				}
			}),
		);
		studioSavedTemplateThumbById = next;
		brokenSavedThumbIds = {};
	}

	function studioSavedTemplatePreviewUrl(row: {
		id?: string;
		state?: Record<string, unknown>;
	}): { url: string; fullSlideRaster: boolean } {
		const id = String(row.id ?? '').trim();
		if (id && brokenSavedThumbIds[id]) return { url: '', fullSlideRaster: false };
		const signed = studioSavedTemplateThumbById[id];
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
		if (!confirm('Delete this saved carousel? This cannot be undone.')) return;
		try {
			const row = studioSavedTemplates.find((x) => x.id === id);
			const s = row?.state as Record<string, unknown> | undefined;
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
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
		if (error) {
			alert(error.message ?? 'Could not delete');
			return;
		}
		studioSavedTemplates = studioSavedTemplates.filter((x) => x.id !== id);
		const next = { ...studioSavedTemplateThumbById };
		delete next[id];
		studioSavedTemplateThumbById = next;
	}

	async function hydrateStudioDraftThumbs() {
		const rows = studioDrafts;
		if (!userId || !rows.length) {
			studioDraftThumbById = {};
			return;
		}
		const next: Record<string, string> = {};
		await Promise.all(
			rows.map(async (row) => {
				const id = String(row.id ?? '').trim();
				if (!id) return;
				const s = row.state as Record<string, unknown> | undefined;
				// Only sign real preview keys — inventing `${userId}/${id}.png` yields 404 URLs
				// that show as broken-image icons on every card.
				const key =
					String(s?.draftPreviewKey ?? '').trim() || String(s?.draftPreviewPath ?? '').trim();
				if (!key) return;
				try {
					const { url } = await r2SignRead({ key });
					if (url) next[id] = url;
				} catch {
					// ignore
				}
			}),
		);
		studioDraftThumbById = next;
		brokenDraftThumbIds = {};
	}

	async function deleteCarousel(id: string) {
		if (!confirm('Delete this carousel?')) return;
		await (supabase as any).from('carousels').delete().eq('id', id);
		carousels = carousels.filter((c) => c.id !== id);
	}

	const statusIcon: Record<string, typeof FileText> = {
		draft: FileText,
		published: CheckCircle,
		scheduled: Clock,
	};

	const filteredCarousels = $derived(
		filterTab === 'all' ? carousels : carousels.filter((c) => c.status === filterTab),
	);

	const counts = $derived({
		all: carousels.length,
		draft: carousels.filter((c) => c.status === 'draft').length,
		published: carousels.filter((c) => c.status === 'published').length,
		scheduled: carousels.filter((c) => c.status === 'scheduled').length,
	});

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

	function parseSlides(c: { slides?: unknown }): any[] {
		try {
			const raw = c.slides;
			return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw ?? []));
		} catch {
			return [];
		}
	}
</script>

<div class="page-wrap dash-page" class:mounted>
	{#if flashToast}
		<div class="page-toast" role="status" aria-live="polite">{flashToast}</div>
	{/if}
	<header class="page-hero">
		<div class="page-hero-text">
			<h1 class="page-title dash-page-title">Clips</h1>
		</div>
		<div class="hero-actions flex flex-wrap gap-2">
			<Button href="/dashboard/videos" variant="outline">
				<Video data-icon="inline-start" />
				Find clips
			</Button>
			<Button href="/dashboard/carousels" variant="outline">Carousels</Button>
		</div>
	</header>

	{#if loading}
		<div class="yt-clips-grid" style="margin-bottom: 28px;">
			{#each Array(6) as _, i (i)}
				<Skeleton class="aspect-video rounded-xl" />
			{/each}
		</div>
	{:else if libraryEmpty}
		<Empty.Root class="border border-dashed reveal" style="--d:0.08s">
			<Empty.Header>
				<Empty.Media variant="icon">
					<Video />
				</Empty.Media>
				<Empty.Title>No clips yet</Empty.Title>
				<Empty.Description>
					Paste a YouTube link on Videos to find clips. Open one here to edit the stack in Bulk.
					Studio and Bulk carousels live on Carousels.
				</Empty.Description>
			</Empty.Header>
			<Empty.Content class="flex flex-wrap justify-center gap-2">
				<Button href="/dashboard/videos">
					<Video data-icon="inline-start" />
					Clip YouTube
				</Button>
				<Button href="/dashboard/carousels" variant="outline">View carousels</Button>
			</Empty.Content>
		</Empty.Root>
	{/if}

	{#if clipVideoCards.length > 0}
		<section class="yt-clips-block reveal" style="--d:0.04s">
			<div class="studio-drafts-head">
				<div class="studio-drafts-head-row">
					<div>
						<h2 class="studio-drafts-title">Your clips</h2>
						<p class="studio-drafts-sub">
							{clipVideoCards.length} video{clipVideoCards.length === 1 ? '' : 's'}
							· {clipShowCards.length} clip{clipShowCards.length === 1 ? '' : 's'}
							— open one to edit in Bulk.
						</p>
					</div>
					<div class="draft-select-bar yt-clips-actions">
						<Button type="button" variant="outline" size="sm" onclick={toggleSelectAllClips}>
							<span
								class="draft-select-box"
								class:draft-select-box--on={allClipsSelected}
								aria-hidden="true"
							></span>
							{allClipsSelected ? 'Deselect all' : 'Select all'}
						</Button>
						{#if selectedClipKeys.length > 0}
							<Button
								type="button"
								variant="destructive"
								size="sm"
								disabled={bulkDeletingClips}
								onclick={() => void deleteSelectedClips()}
							>
								{#if bulkDeletingClips}
									<Loader size={13} class="spin" />
								{:else}
									<Trash2 size={13} />
								{/if}
								Delete {selectedClipKeys.length}
							</Button>
						{/if}
						<Button href="/dashboard/videos" variant="outline" size="sm">
							<Video size={13} data-icon="inline-start" />
							Find clips
						</Button>
					</div>
				</div>
			</div>

			<div class="yt-clips-grid">
				{#each clipVideoCards as video, i (video.key)}
					{@const groupOn = groupAllSelected(video.groupId)}
					{@const thumbBroken = !!brokenClipThumbKeys[video.key]}
					{@const durationLabel = formatClipDuration(video.durationSec)}
					<div
						class="yt-clip-card group"
						class:yt-clip-card--selected={groupOn}
						style="--d:{0.08 + i * 0.02}s"
					>
						<a href={video.href} class="yt-clip-thumb" title={video.title}>
							{#if video.thumb && !thumbBroken}
								<img
									src={video.thumb}
									alt=""
									referrerpolicy="no-referrer"
									loading="lazy"
									draggable="false"
									onerror={() => {
										brokenClipThumbKeys = { ...brokenClipThumbKeys, [video.key]: true };
									}}
								/>
							{:else}
								<span class="yt-clip-thumb-fallback">{video.headline.slice(0, 48)}</span>
							{/if}
							<span class="yt-clip-thumb-bar">{video.title}</span>
							<span class="yt-clip-badge">
								{video.slideCount} slide{video.slideCount === 1 ? '' : 's'}
								{#if durationLabel}
									· {durationLabel}
								{/if}
							</span>
						</a>
						<label class="yt-clip-check">
							<input
								type="checkbox"
								checked={groupOn}
								onchange={() => toggleSelectClipGroup(video.groupId)}
								onclick={(e) => e.stopPropagation()}
							/>
							<span class="sr-only">Select video clips</span>
						</label>
						<div class="yt-clip-meta">
							<div class="yt-clip-meta-text">
								<a href={video.href} class="yt-clip-name" title={video.headline}>{video.headline}</a>
								<p class="yt-clip-sub">
									{video.pill}
									· {video.clipCount} clip{video.clipCount === 1 ? '' : 's'}
									· {video.slideCount} slide{video.slideCount === 1 ? '' : 's'}
									{#if durationLabel}
										· {durationLabel}
									{/if}
									· {timeAgo(video.updatedAt)}
								</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								class="yt-clip-more"
								title="Delete clips from this video"
								aria-label="Delete clips from this video"
								onclick={() => void deleteClipVideoGroup(video.groupId)}
							>
								<MoreHorizontal size={16} />
							</Button>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

</div>

<style>
	.page-toast {
		position: fixed;
		left: 50%;
		bottom: 28px;
		transform: translateX(-50%);
		z-index: 9999;
		max-width: min(420px, calc(100vw - 32px));
		padding: 12px 18px;
		border-radius: 14px;
		background: rgba(15, 15, 16, 0.94);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: -0.01em;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
		pointer-events: none;
		animation: page-toast-in 180ms ease-out;
	}

	@keyframes page-toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	:root:not([data-theme='dark']) {
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-text-3: #9a9aa1;
		--ap-soft: #f6f7f9;
		--ap-bg: #ffffff;
		--panel-bg: #ffffff;
		--panel-bg-2: #f6f7f9;
		--panel-border: rgba(15, 15, 16, 0.08);
		--panel-border-hover: rgba(15, 15, 16, 0.14);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--t-muted: var(--ap-text-3);
		--shadow-soft: 0 1px 2px rgba(15, 15, 16, 0.04), 0 8px 22px -10px rgba(15, 15, 16, 0.1);
		--shadow-pop: 0 18px 40px -16px rgba(15, 15, 16, 0.16), 0 6px 14px -8px rgba(15, 15, 16, 0.1);
	}
	:root[data-theme='dark'] {
		--ap-text: #f5f5f5;
		--ap-text-2: rgba(245, 245, 245, 0.66);
		--ap-text-3: rgba(245, 245, 245, 0.42);
		--ap-soft: #161616;
		--ap-bg: #0a0a0a;
		--panel-bg: rgba(255, 255, 255, 0.025);
		--panel-bg-2: rgba(255, 255, 255, 0.045);
		--panel-border: rgba(255, 255, 255, 0.07);
		--panel-border-hover: rgba(255, 255, 255, 0.16);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--t-muted: var(--ap-text-3);
		--shadow-soft: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 12px 28px -16px rgba(0, 0, 0, 0.55);
		--shadow-pop: 0 18px 40px -18px rgba(0, 0, 0, 0.55);
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
		background: #34d399;
		box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18);
	}
	.page-title {
		color: var(--t-strong);
	}
	.page-sub {
		color: var(--t);
	}
	.hero-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}
	.spin {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.studio-drafts-block,
	.library-block {
		margin-bottom: 28px;
		padding: 24px 26px 22px;
		border-radius: 22px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		box-shadow: var(--shadow-soft);
	}
	.studio-drafts-title,
	.library-title {
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		margin: 0 0 4px;
	}
	.studio-drafts-sub {
		font-size: 13px;
		line-height: 1.5;
		color: var(--t);
		margin: 0;
	}
	.studio-drafts-head {
		margin-bottom: 14px;
	}
	.studio-drafts-head-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.draft-select-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.draft-select-all {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 34px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--panel-border);
		background: #fff;
		font-size: 12px;
		font-weight: 650;
		color: var(--t-strong);
		cursor: pointer;
	}
	.draft-select-all:hover {
		border-color: var(--panel-border-hover);
	}
	.draft-select-box {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1.5px solid #c4c4c4;
		background: #fff;
		box-sizing: border-box;
	}
	.draft-select-box--on {
		border-color: #111;
		background: #111;
		box-shadow: inset 0 0 0 2px #fff;
	}
	.draft-bulk-delete {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid #fecaca;
		background: #fef2f2;
		color: #b91c1c;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}
	.draft-bulk-delete:hover:not(:disabled) {
		background: #fee2e2;
	}
	.draft-bulk-delete:disabled {
		opacity: 0.65;
		cursor: wait;
	}
	.draft-check {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 5;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		border-radius: 7px;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
		cursor: pointer;
	}
	.draft-check input {
		width: 14px;
		height: 14px;
		margin: 0;
		accent-color: #111;
		cursor: pointer;
	}
	.studio-draft-card {
		position: relative;
	}
	.studio-draft-card--selected {
		outline: 2px solid #111;
		outline-offset: 2px;
	}
	.studio-drafts-grid .slide-count {
		left: 2.55rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.saved-templates-grid {
		margin-top: 14px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 14px;
	}
	.saved-template-tile {
		position: relative;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--panel-border);
		background: var(--ap-soft);
		aspect-ratio: 4 / 5;
		box-shadow: var(--shadow-soft);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.25s ease,
			box-shadow 0.32s ease;
	}
	.saved-template-tile:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		box-shadow: var(--shadow-pop);
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
		color: var(--t-muted);
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
		top: 0.55rem;
		right: 0.55rem;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: 1px solid color-mix(in oklab, var(--panel-border) 60%, transparent);
		background: rgba(0, 0, 0, 0.55);
		color: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(6px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transform: translateY(-2px);
		transition:
			opacity 0.15s,
			transform 0.15s,
			background 0.15s;
		cursor: pointer;
	}
	.saved-template-tile:hover .saved-template-del {
		opacity: 1;
		transform: translateY(0);
	}
	.saved-template-del:hover {
		background: rgba(239, 68, 68, 0.55);
	}
	.library-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.filter-tabs {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.filter-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--panel-border);
		background: transparent;
		color: var(--t);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}
	.filter-tab--on {
		background: var(--app-accent, #7bf1a8);
		color: #0f0f10;
		border-color: var(--app-accent, #7bf1a8);
	}
	.filter-count {
		font-size: 10px;
		opacity: 0.7;
	}

	.carousel-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 14px;
	}
	.carousel-card {
		position: relative;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		box-shadow: var(--shadow-soft);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 0.32s ease,
			border-color 0.25s ease;
	}
	.carousel-card:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		box-shadow: var(--shadow-pop);
	}
	.card-preview {
		display: block;
		aspect-ratio: 4 / 5;
		background: var(--card-bg, #111);
		padding: 1.1rem;
		text-decoration: none;
		position: relative;
		overflow: hidden;
	}
	.card-preview-text {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		line-height: 1.25;
		color: var(--card-color, #fff);
		display: -webkit-box;
		line-clamp: 5;
		-webkit-line-clamp: 5;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.slide-count,
	.card-status,
	.studio-draft-template-pill {
		position: absolute;
		z-index: 3;
		font-size: 10px;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: 999px;
		backdrop-filter: blur(8px);
	}
	.slide-count {
		top: 0.6rem;
		left: 0.6rem;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
	}
	.card-status {
		top: 0.6rem;
		right: 0.6rem;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		text-transform: capitalize;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.carousel-card:hover .card-status {
		opacity: 1;
	}
	.studio-draft-template-pill {
		top: 0.6rem;
		right: 0.6rem;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
	}
	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px;
		border-top: 1px solid var(--panel-border);
	}
	.card-title-text {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--t-strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}
	.card-time {
		margin: 2px 0 0;
		font-size: 11px;
		color: var(--t-muted);
	}
	.card-actions {
		display: flex;
		gap: 6px;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.carousel-card:hover .card-actions {
		opacity: 1;
	}
	.card-action {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg-2);
		color: var(--t);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		text-decoration: none;
	}
	.card-action--delete:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.studio-draft-card-preview {
		position: relative;
	}
	.bulk-lib-card-preview {
		padding: 0;
	}
	.studio-draft-bg-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.studio-draft-bg-img--full-slide {
		object-fit: contain;
	}
	.studio-draft-bg-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.55));
		pointer-events: none;
	}
	.studio-draft-preview-headline {
		position: relative;
		z-index: 2;
		text-shadow: 0 1px 14px rgba(0, 0, 0, 0.45);
	}
	.studio-draft-filmstrip {
		position: absolute;
		bottom: 0.55rem;
		left: 0.5rem;
		right: 0.5rem;
		display: flex;
		gap: 4px;
		z-index: 2;
		pointer-events: none;
	}
	.studio-draft-film-cell {
		flex: 1;
		min-width: 0;
		height: 22px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.14);
		border: 1px solid rgba(255, 255, 255, 0.22);
		font-size: 8px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
	}
	.studio-draft-filmstrip--light .studio-draft-film-cell {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.12);
		color: rgba(0, 0, 0, 0.55);
	}
	.studio-draft-film-cell--on {
		background: rgba(232, 255, 72, 0.22);
		border-color: rgba(232, 255, 72, 0.45);
		color: #eab308;
	}
	.studio-draft-film-hint {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 2px;
	}

	.skeleton-card {
		aspect-ratio: 4 / 5;
		border-radius: 18px;
		border: 1px solid var(--panel-border);
	}
	.empty-state {
		text-align: center;
		padding: 48px 20px;
	}
	.empty-icon {
		width: 48px;
		height: 48px;
		margin: 0 auto 12px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--panel-bg-2);
		color: var(--t-muted);
	}
	.empty-title {
		margin: 0 0 6px;
		font-size: 16px;
		font-weight: 800;
		color: var(--t-strong);
	}
	.empty-desc {
		margin: 0 0 16px;
		font-size: 13px;
		color: var(--t);
	}
	.empty-actions {
		display: flex;
		gap: 10px;
		justify-content: center;
		flex-wrap: wrap;
	}

	/* —— YouTube clips: media-library row (thumb + title under) —— */
	.yt-clips-block {
		margin-bottom: 32px;
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
	}
	.yt-clips-actions {
		flex-wrap: wrap;
		gap: 8px;
	}
	.yt-clip-groups {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.yt-clips-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 20px 18px;
		align-items: start;
	}
	.yt-clip-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		background: transparent;
		border: none;
		box-shadow: none;
		overflow: visible;
	}
	.yt-clip-card--selected .yt-clip-thumb {
		outline: 2px solid var(--foreground, #111);
		outline-offset: 2px;
	}
	.yt-clip-thumb {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		background: #141414;
		text-decoration: none;
		overflow: hidden;
	}
	.yt-clip-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.3s ease;
	}
	.yt-clip-card:hover .yt-clip-thumb img {
		transform: scale(1.04);
	}
	.yt-clip-thumb-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 16px;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.35;
		text-align: center;
		color: rgba(255, 255, 255, 0.7);
	}
	.yt-clip-thumb-bar {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 2;
		padding: 8px 12px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.01em;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		pointer-events: none;
	}
	.yt-clip-badge {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 3;
		padding: 4px 8px;
		border-radius: 6px;
		background: rgba(28, 28, 30, 0.82);
		color: #f5f5f5;
		font-size: 11px;
		font-weight: 600;
		line-height: 1;
		pointer-events: none;
		backdrop-filter: blur(6px);
	}
	.yt-clip-check {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 5;
		width: 22px;
		height: 22px;
		margin: 0;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.12);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}
	.yt-clip-check input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		margin: 0;
	}
	.yt-clip-check::after {
		content: '';
		width: 10px;
		height: 10px;
		border-radius: 3px;
		background: transparent;
	}
	.yt-clip-card--selected .yt-clip-check {
		background: #111;
		border-color: #111;
	}
	.yt-clip-card--selected .yt-clip-check::after {
		background: #fff;
		clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0, 43% 62%);
	}
	.yt-clip-meta {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		min-width: 0;
		padding: 0 2px;
	}
	.yt-clip-meta-text {
		flex: 1;
		min-width: 0;
	}
	.yt-clip-name {
		display: block;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.3;
		color: var(--foreground, var(--t-strong));
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.015em;
	}
	.yt-clip-name:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.yt-clip-sub {
		margin: 3px 0 0;
		font-size: 12px;
		line-height: 1.3;
		color: var(--muted-foreground, var(--t-muted));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.yt-clip-more {
		flex-shrink: 0;
		margin-top: -2px;
		color: var(--muted-foreground, var(--t-muted)) !important;
		opacity: 0.55;
	}
	.yt-clip-card:hover .yt-clip-more,
	.yt-clip-card:focus-within .yt-clip-more {
		opacity: 1;
	}
	.yt-clip-more:hover {
		color: var(--foreground, var(--t-strong)) !important;
	}
	@media (max-width: 960px) {
		.yt-clips-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px 14px;
		}
	}
	@media (max-width: 560px) {
		.yt-clips-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}
		.yt-clip-more {
			opacity: 1;
		}
	}
</style>
