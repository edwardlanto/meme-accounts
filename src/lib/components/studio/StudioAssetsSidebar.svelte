<script lang="ts">
	import { prepareImageForUpload } from '$lib/client/image-upload-prep';
	import { Film, ImagePlus, Loader, Pencil, Search, Trash2, Upload, X, Check, Wallpaper, Layers } from 'lucide-svelte';
	import SkeletonGrid from '$lib/components/SkeletonGrid.svelte';

	type StudioAsset = {
		id: string;
		name: string;
		r2_key: string;
		created_at: string;
		updated_at: string;
		thumbUrl?: string;
	};

	type UnsplashPhoto = {
		id: string;
		small: string;
		regular: string;
		alt: string;
		photographer: string;
		downloadLocation: string;
	};

	type PexelsPhoto = {
		id: number;
		small: string;
		regular: string;
		original: string;
		alt: string;
		photographer: string;
		photographerUrl: string;
	};

	type PexelsVideo = {
		id: number;
		url: string;
		thumb: string;
		alt: string;
		photographer: string;
		duration: number;
	};

	let {
		userId = '',
		collapsed = $bindable(false),
		onUseAsBackground,
		onUseAsBottomBackground,
		onAddAsSticker,
		onUseUnsplashBackground,
		onUsePexelsVideo,
	}: {
		userId?: string;
		collapsed?: boolean;
		onUseAsBackground?: (r2Ref: string) => void | Promise<void>;
		onUseAsBottomBackground?: (r2Ref: string) => void | Promise<void>;
		onAddAsSticker?: (r2Ref: string) => void | Promise<void>;
		onUseUnsplashBackground?: (photo: {
			url: string;
			downloadLocation: string;
			photographer: string;
		}) => void | Promise<void>;
		onUsePexelsVideo?: (video: {
			url: string;
			thumb: string;
			photographer: string;
			duration: number;
		}) => void | Promise<void>;
	} = $props();

	let tab = $state<'library' | 'unsplash' | 'pexels'>('library');
	let pexelsKind = $state<'photos' | 'videos'>('photos');

	let assets = $state<StudioAsset[]>([]);
	let loading = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let query = $state('');
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let renaming = $state(false);
	let deletingId = $state<string | null>(null);
	let fileInput: HTMLInputElement | null = $state(null);
	let dragOver = $state(false);

	let unsplashQuery = $state('');
	let unsplashPhotos = $state<UnsplashPhoto[]>([]);
	let unsplashLoading = $state(false);
	let unsplashError = $state('');
	let unsplashApplyingId = $state<string | null>(null);
	let unsplashSearched = $state(false);
	let unsplashPage = $state(1);
	let unsplashHasMore = $state(true);
	let unsplashTotalPages = $state(1);

	let pexelsQuery = $state('');
	let pexelsPhotos = $state<PexelsPhoto[]>([]);
	let pexelsVideos = $state<PexelsVideo[]>([]);
	let pexelsLoading = $state(false);
	let pexelsError = $state('');
	let pexelsApplyingId = $state<number | null>(null);
	let pexelsSearched = $state(false);
	let pexelsPage = $state(1);
	let pexelsHasMore = $state(true);
	let pexelsTotalPages = $state(1);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return assets;
		return assets.filter((a) => a.name.toLowerCase().includes(q));
	});

	async function loadAssets() {
		if (!userId) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/studio/assets');
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error ?? 'Failed to load assets');
			assets = (data.assets ?? []) as StudioAsset[];
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load assets';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (userId) void loadAssets();
	});

	function defaultNameFromFile(file: File): string {
		const base = file.name.replace(/\.[^.]+$/, '').trim() || 'Untitled asset';
		return base.slice(0, 80);
	}

	async function uploadFiles(files: FileList | File[]) {
		if (!userId) {
			error = 'Sign in to save assets';
			return;
		}
		const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
		if (!list.length) {
			error = 'Choose an image file (PNG, JPEG, WebP, or GIF)';
			return;
		}
		uploading = true;
		error = '';
		try {
			for (const file of list) {
				const prepared = await prepareImageForUpload(file);
				const fd = new FormData();
				fd.set('file', prepared.blob, prepared.filename);
				fd.set('name', defaultNameFromFile(file));
				const res = await fetch('/api/studio/assets', { method: 'POST', body: fd });
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data?.error ?? 'Upload failed');
				const row = data.asset as StudioAsset;
				if (row) assets = [row, ...assets];
			}
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) void uploadFiles(input.files);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) void uploadFiles(e.dataTransfer.files);
	}

	function startRename(asset: StudioAsset) {
		editingId = asset.id;
		editName = asset.name;
	}

	function cancelRename() {
		editingId = null;
		editName = '';
	}

	async function commitRename(asset: StudioAsset) {
		const next = editName.trim().slice(0, 80);
		if (!next || next === asset.name) {
			cancelRename();
			return;
		}
		renaming = true;
		error = '';
		try {
			const res = await fetch('/api/studio/assets', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: asset.id, name: next }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error ?? 'Rename failed');
			assets = assets.map((a) => (a.id === asset.id ? { ...a, name: next } : a));
			cancelRename();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Rename failed';
		} finally {
			renaming = false;
		}
	}

	async function deleteAsset(asset: StudioAsset) {
		if (!confirm(`Delete “${asset.name}”? This cannot be undone.`)) return;
		deletingId = asset.id;
		error = '';
		try {
			const res = await fetch('/api/studio/assets', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: asset.id }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error ?? 'Delete failed');
			assets = assets.filter((a) => a.id !== asset.id);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Delete failed';
		} finally {
			deletingId = null;
		}
	}

	function r2Ref(asset: StudioAsset) {
		return `r2:${asset.r2_key}`;
	}

	async function searchUnsplash(pageToFetch: number | null = null) {
		const q = unsplashQuery.trim();
		if (!q) {
			unsplashError = 'Enter a search term';
			return;
		}
		
		// If no page specified, start fresh from page 1
		const isNewSearch = pageToFetch === null;
		const targetPage = pageToFetch ?? 1;
		
		if (isNewSearch) {
			unsplashPage = 1;
			unsplashPhotos = [];
		}
		
		unsplashLoading = true;
		unsplashError = '';
		unsplashSearched = true;
		
		try {
			console.log(`[Unsplash] Fetching page ${targetPage} for query: ${q}`);
			const res = await fetch(`/api/unsplash/search?query=${encodeURIComponent(q)}&per_page=15&page=${targetPage}`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error ?? `Search failed (${res.status})`);
			
			console.log(`[Unsplash] Received ${data.photos?.length ?? 0} photos, total pages: ${data.totalPages}, current page: ${data.page}`);
			
			const newPhotos = Array.isArray(data.photos) ? data.photos : [];
			
			// For new search, replace. For load more, append
			if (isNewSearch) {
				unsplashPhotos = newPhotos;
				unsplashPage = 1;
			} else {
				unsplashPhotos = [...unsplashPhotos, ...newPhotos];
				unsplashPage = targetPage;
			}
			
			unsplashTotalPages = Number(data?.totalPages ?? 1);
			unsplashHasMore = unsplashPage < unsplashTotalPages && newPhotos.length > 0;
			
			console.log(`[Unsplash] Current state - page: ${unsplashPage}, total photos: ${unsplashPhotos.length}, hasMore: ${unsplashHasMore}`);
			
			if (!unsplashPhotos.length && isNewSearch) {
				unsplashError = 'No photos found — try another keyword';
			}
		} catch (e: unknown) {
			console.error('[Unsplash] Search error:', e);
			if (isNewSearch) unsplashPhotos = [];
			unsplashError = e instanceof Error ? e.message : 'Unsplash search failed';
		} finally {
			unsplashLoading = false;
		}
	}
	
	async function loadMoreUnsplash() {
		if (!unsplashHasMore || unsplashLoading) return;
		const nextPage = unsplashPage + 1;
		console.log(`[Unsplash] Loading more, fetching page ${nextPage}`);
		await searchUnsplash(nextPage);
	}

	async function applyUnsplash(photo: UnsplashPhoto) {
		if (!onUseUnsplashBackground) return;
		unsplashApplyingId = photo.id;
		unsplashError = '';
		try {
			await onUseUnsplashBackground({
				url: photo.regular,
				downloadLocation: photo.downloadLocation,
				photographer: photo.photographer,
			});
		} catch (e: unknown) {
			unsplashError = e instanceof Error ? e.message : 'Could not apply photo';
		} finally {
			unsplashApplyingId = null;
		}
	}

	function expandUnsplashImage(photo: UnsplashPhoto, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		// Open the regular (high-res) image in a new tab
		window.open(photo.regular, '_blank', 'noopener,noreferrer');
	}

	async function searchPexels(pageToFetch: number | null = null) {
		const q = pexelsQuery.trim();
		if (!q) {
			pexelsError = 'Enter a search term';
			return;
		}

		const isNewSearch = pageToFetch === null;
		const targetPage = pageToFetch ?? 1;
		const searchingVideos = pexelsKind === 'videos';

		if (isNewSearch) {
			pexelsPage = 1;
			pexelsPhotos = [];
			pexelsVideos = [];
		}

		pexelsLoading = true;
		pexelsError = '';
		pexelsSearched = true;

		try {
			const endpoint = searchingVideos
				? `/api/pexels/videos?query=${encodeURIComponent(q)}&per_page=10&page=${targetPage}&orientation=portrait`
				: `/api/pexels/search?query=${encodeURIComponent(q)}&per_page=15&page=${targetPage}`;
			const res = await fetch(endpoint);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error ?? `Search failed (${res.status})`);

			if (searchingVideos) {
				const newVideos = (Array.isArray(data.videos) ? data.videos : [])
					.map((v: any) => ({
						id: Number(v?.id ?? 0),
						url: String(v?.url ?? ''),
						thumb: String(v?.thumb ?? ''),
						alt: String(v?.alt ?? 'Video'),
						photographer: String(v?.photographer ?? 'Unknown'),
						duration: Number(v?.duration ?? 0) || 0,
					}))
					.filter((v: PexelsVideo) => v.id && v.url);

				if (isNewSearch) {
					pexelsVideos = newVideos;
					pexelsPage = 1;
				} else {
					pexelsVideos = [...pexelsVideos, ...newVideos];
					pexelsPage = targetPage;
				}

				const total = Number(data?.total ?? 0) || 0;
				const perPage = 10;
				pexelsTotalPages = Number(data?.totalPages ?? Math.max(1, Math.ceil(total / perPage))) || 1;
				pexelsHasMore =
					newVideos.length >= perPage &&
					(total > 0 ? pexelsPage * perPage < total : newVideos.length >= perPage);

				if (!pexelsVideos.length && isNewSearch) {
					pexelsError = 'No videos found — try another keyword';
				}
			} else {
				const newPhotos = Array.isArray(data.photos) ? data.photos : [];

				if (isNewSearch) {
					pexelsPhotos = newPhotos;
					pexelsPage = 1;
				} else {
					pexelsPhotos = [...pexelsPhotos, ...newPhotos];
					pexelsPage = targetPage;
				}

				pexelsTotalPages = Number(data?.totalPages ?? 1);
				pexelsHasMore = pexelsPage < pexelsTotalPages && newPhotos.length > 0;

				if (!pexelsPhotos.length && isNewSearch) {
					pexelsError = 'No photos found — try another keyword';
				}
			}
		} catch (e: unknown) {
			console.error('[Pexels] Search error:', e);
			if (isNewSearch) {
				pexelsPhotos = [];
				pexelsVideos = [];
			}
			pexelsError = e instanceof Error ? e.message : 'Pexels search failed';
		} finally {
			pexelsLoading = false;
		}
	}

	async function loadMorePexels() {
		if (!pexelsHasMore || pexelsLoading) return;
		await searchPexels(pexelsPage + 1);
	}

	function switchPexelsKind(kind: 'photos' | 'videos') {
		if (pexelsKind === kind) return;
		pexelsKind = kind;
		pexelsPhotos = [];
		pexelsVideos = [];
		pexelsSearched = false;
		pexelsError = '';
		pexelsPage = 1;
		pexelsHasMore = true;
		pexelsTotalPages = 1;
		if (pexelsQuery.trim()) void searchPexels();
	}

	async function applyPexels(photo: PexelsPhoto) {
		if (!onUseUnsplashBackground) return;
		pexelsApplyingId = photo.id;
		pexelsError = '';
		try {
			await onUseUnsplashBackground({
				url: photo.regular,
				downloadLocation: '',
				photographer: photo.photographer,
			});
		} catch (e: unknown) {
			pexelsError = e instanceof Error ? e.message : 'Could not apply photo';
		} finally {
			pexelsApplyingId = null;
		}
	}

	async function applyPexelsVideo(video: PexelsVideo) {
		if (!onUsePexelsVideo) return;
		pexelsApplyingId = video.id;
		pexelsError = '';
		try {
			await onUsePexelsVideo({
				url: video.url,
				thumb: video.thumb,
				photographer: video.photographer,
				duration: video.duration,
			});
		} catch (e: unknown) {
			pexelsError = e instanceof Error ? e.message : 'Could not apply video';
		} finally {
			pexelsApplyingId = null;
		}
	}

	function formatDuration(sec: number): string {
		const s = Math.max(0, Math.round(sec));
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${String(r).padStart(2, '0')}`;
	}

	function expandPexelsImage(photo: PexelsPhoto, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		window.open(photo.original || photo.regular, '_blank', 'noopener,noreferrer');
	}
</script>

{#if collapsed}
	<aside class="assets-sidebar assets-sidebar--collapsed" aria-label="Image assets">
		<button
			type="button"
			class="assets-collapse-btn"
			onclick={() => (collapsed = false)}
			title="Show assets"
			aria-label="Show assets"
			aria-expanded="false"
		>
			<ImagePlus size={15} />
		</button>
		<span class="assets-rail-label">Assets</span>
	</aside>
{:else}
<aside class="assets-sidebar" aria-label="Image assets">
	<header class="assets-header">
		<div class="assets-title-row">
			<span class="assets-title">Assets</span>
			<button
				type="button"
				class="assets-collapse-btn"
				onclick={() => (collapsed = true)}
				title="Hide assets"
				aria-label="Hide assets"
				aria-expanded="true"
			>
				<X size={14} />
			</button>
			{#if tab === 'library'}
				<button
					type="button"
					class="assets-upload-btn"
					onclick={() => fileInput?.click()}
					disabled={!userId || uploading}
					title="Upload image"
				>
					{#if uploading}
						<Loader size={14} class="animate-spin" />
					{:else}
						<Upload size={14} />
					{/if}
					<span>Upload</span>
				</button>
			{/if}
		</div>

		<div class="assets-tabs" role="tablist">
			<button
				type="button"
				role="tab"
				class="assets-tab"
				class:assets-tab--on={tab === 'library'}
				aria-selected={tab === 'library'}
				onclick={() => (tab = 'library')}
			>
				Library
			</button>
			<button
				type="button"
				role="tab"
				class="assets-tab"
				class:assets-tab--on={tab === 'unsplash'}
				aria-selected={tab === 'unsplash'}
				onclick={() => (tab = 'unsplash')}
			>
				Unsplash
			</button>
			<button
				type="button"
				role="tab"
				class="assets-tab"
				class:assets-tab--on={tab === 'pexels'}
				aria-selected={tab === 'pexels'}
				onclick={() => (tab = 'pexels')}
			>
				Pexels
			</button>
		</div>

		{#if tab === 'library'}
			<div class="assets-search">
				<Search size={13} class="assets-search-icon" />
				<input
					type="search"
					bind:value={query}
					placeholder="Search library…"
					class="assets-search-input"
				/>
				{#if query}
					<button type="button" class="assets-clear" onclick={() => (query = '')} aria-label="Clear search">
						<X size={12} />
					</button>
				{/if}
			</div>
		{:else if tab === 'unsplash'}
			<form
				class="assets-search assets-search--unsplash"
				onsubmit={(e) => {
					e.preventDefault();
					void searchUnsplash();
				}}
			>
				<Search size={13} class="assets-search-icon" />
				<input
					type="search"
					bind:value={unsplashQuery}
					placeholder="Search Unsplash…"
					class="assets-search-input"
				/>
				<button type="submit" class="assets-search-go" disabled={unsplashLoading}>
					{#if unsplashLoading}
						<Loader size={12} class="animate-spin" />
					{:else}
						Go
					{/if}
				</button>
			</form>
		{:else if tab === 'pexels'}
			<div class="pexels-kind" role="tablist" aria-label="Pexels media type">
				<button
					type="button"
					role="tab"
					class="pexels-kind-btn"
					class:pexels-kind-btn--on={pexelsKind === 'photos'}
					aria-selected={pexelsKind === 'photos'}
					onclick={() => switchPexelsKind('photos')}
				>
					Photos
				</button>
				<button
					type="button"
					role="tab"
					class="pexels-kind-btn"
					class:pexels-kind-btn--on={pexelsKind === 'videos'}
					aria-selected={pexelsKind === 'videos'}
					onclick={() => switchPexelsKind('videos')}
				>
					Videos
				</button>
			</div>
			<form
				class="assets-search assets-search--pexels"
				onsubmit={(e) => {
					e.preventDefault();
					void searchPexels();
				}}
			>
				<Search size={13} class="assets-search-icon" />
				<input
					type="search"
					bind:value={pexelsQuery}
					placeholder={pexelsKind === 'videos' ? 'Search Pexels videos…' : 'Search Pexels photos…'}
					class="assets-search-input"
				/>
				<button type="submit" class="assets-search-go" disabled={pexelsLoading}>
					{#if pexelsLoading}
						<Loader size={12} class="animate-spin" />
					{:else}
						Go
					{/if}
				</button>
			</form>
		{/if}
	</header>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
		multiple
		class="sr-only"
		onchange={onFileChange}
	/>

	{#if tab === 'library'}
		{#if error}
			<p class="assets-error assets-error-top">{error}</p>
		{/if}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="assets-drop"
			class:assets-drop--active={dragOver}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={onDrop}
		>
			{#if loading}
				<SkeletonGrid count={6} ratio="3/4" />
			{:else if !filtered.length}
				<button type="button" class="assets-empty assets-empty-btn" onclick={() => fileInput?.click()} disabled={!userId || uploading}>
					<div class="assets-empty-icon">
						<ImagePlus size={20} />
					</div>
					<p>{query ? 'No matches' : 'Drop images here'}</p>
					<span>{query ? 'Try another search' : 'or click Upload — saved to your library'}</span>
				</button>
			{:else}
				<ul class="assets-list">
					{#each filtered as asset (asset.id)}
						<li class="asset-card">
							<button
								type="button"
								class="asset-thumb asset-thumb-btn"
								title="Use as background"
								onclick={() => void onUseAsBackground?.(r2Ref(asset))}
							>
								{#if asset.thumbUrl}
									<img src={asset.thumbUrl} alt="" />
								{:else}
									<div class="asset-thumb-fallback"><ImagePlus size={16} /></div>
								{/if}
								{#if deletingId === asset.id}
									<div class="asset-busy"><Loader size={14} class="animate-spin" /></div>
								{/if}
							</button>

							<div class="asset-meta">
								{#if editingId === asset.id}
									<div class="asset-rename">
										<input
											bind:value={editName}
											class="asset-rename-input"
											maxlength={80}
											onkeydown={(e) => {
												if (e.key === 'Enter') void commitRename(asset);
												if (e.key === 'Escape') cancelRename();
											}}
										/>
										<button type="button" class="icon-btn" disabled={renaming} onclick={() => void commitRename(asset)} title="Save name">
											{#if renaming}<Loader size={12} class="animate-spin" />{:else}<Check size={12} />{/if}
										</button>
										<button type="button" class="icon-btn" onclick={cancelRename} title="Cancel">
											<X size={12} />
										</button>
									</div>
								{:else}
									<p class="asset-name" title={asset.name}>{asset.name}</p>
								{/if}

								<div class="asset-actions">
									<button
										type="button"
										class="action-chip"
										title="Use as background"
										onclick={() => void onUseAsBackground?.(r2Ref(asset))}
									>
										<Wallpaper size={11} />
										<span>BG</span>
									</button>
									{#if onUseAsBottomBackground}
										<button
											type="button"
											class="action-chip"
											title="Use as bottom media"
											onclick={() => void onUseAsBottomBackground?.(r2Ref(asset))}
										>
											<Wallpaper size={11} />
											<span>Bottom</span>
										</button>
									{/if}
									<button
										type="button"
										class="action-chip"
										title="Add as sticker"
										onclick={() => void onAddAsSticker?.(r2Ref(asset))}
									>
										<Layers size={11} />
										<span>Sticker</span>
									</button>
									<button type="button" class="icon-btn" title="Rename" onclick={() => startRename(asset)}>
										<Pencil size={12} />
									</button>
									<button
										type="button"
										class="icon-btn icon-btn--danger"
										title="Delete"
										disabled={deletingId === asset.id}
										onclick={() => void deleteAsset(asset)}
									>
										<Trash2 size={12} />
									</button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if tab === 'unsplash'}
		<div class="assets-drop">
			{#if unsplashLoading && !unsplashPhotos.length}
				<SkeletonGrid count={6} ratio="3/4" />
			{:else if !unsplashSearched}
				<div class="assets-empty">
					<div class="assets-empty-icon"><Search size={18} /></div>
					<p>Search stock photos</p>
					<span>Find a photo, then tap it to set as the slide background</span>
				</div>
			{:else if !unsplashPhotos.length}
				<div class="assets-empty">
					<p>No results</p>
					<span>Try a different keyword</span>
				</div>
			{:else}
				<ul class="unsplash-grid">
					{#each unsplashPhotos as photo (photo.id)}
						<li>
							<div
								class="unsplash-card"
								class:unsplash-card--loading={unsplashApplyingId === photo.id}
								title={`Photo by ${photo.photographer} on Unsplash`}
							>
								<div class="pexels-image-wrapper">
									<button
										type="button"
										class="unsplash-card-action"
										disabled={unsplashApplyingId === photo.id}
										onclick={() => void applyUnsplash(photo)}
									>
										<img src={photo.small} alt={photo.alt} loading="lazy" />
									</button>
									<button
										type="button"
										class="pexels-expand-btn"
										onclick={(e) => expandUnsplashImage(photo, e)}
										title="View full size"
										disabled={unsplashApplyingId === photo.id}
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
										</svg>
									</button>
								</div>
								{#if unsplashApplyingId === photo.id}
									<div class="asset-busy"><Loader size={14} class="animate-spin" /></div>
								{:else}
									<span class="unsplash-credit">
										{photo.photographer}
										· BG
									</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				
				{#if unsplashHasMore}
					<div class="unsplash-load-more">
						<button
							type="button"
							class="load-more-btn"
							disabled={unsplashLoading}
							onclick={() => void loadMoreUnsplash()}
						>
							{#if unsplashLoading}
								<Loader size={14} class="animate-spin" />
								<span>Loading page {unsplashPage + 1}…</span>
							{:else}
								<span>Load More (Page {unsplashPage + 1})</span>
								<span class="load-more-count">{unsplashPhotos.length} photos • {unsplashPage} of {unsplashTotalPages}</span>
							{/if}
						</button>
					</div>
				{/if}
				
				<p class="unsplash-note">
					Photos via
					<a href="https://unsplash.com/?utm_source=carousel_studio&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
				</p>
			{/if}
		</div>
		{#if unsplashError}
			<p class="assets-error">{unsplashError}</p>
		{/if}
	{:else if tab === 'pexels'}
		<div class="assets-drop">
			{#if pexelsLoading && !(pexelsKind === 'videos' ? pexelsVideos.length : pexelsPhotos.length)}
				<SkeletonGrid count={6} ratio="3/4" />
			{:else if !pexelsSearched}
				<div class="assets-empty">
					<div class="assets-empty-icon">
						{#if pexelsKind === 'videos'}
							<Film size={18} />
						{:else}
							<Search size={18} />
						{/if}
					</div>
					<p>{pexelsKind === 'videos' ? 'Search stock videos' : 'Search stock photos'}</p>
					<span>
						{pexelsKind === 'videos'
							? 'Find a clip, then tap it to set as the slide background'
							: 'Find a photo, then tap it to set as the slide background'}
					</span>
				</div>
			{:else if pexelsKind === 'videos' ? !pexelsVideos.length : !pexelsPhotos.length}
				<div class="assets-empty">
					<p>No results</p>
					<span>Try a different keyword</span>
				</div>
			{:else if pexelsKind === 'videos'}
				<ul class="unsplash-grid">
					{#each pexelsVideos as video (video.id)}
						<li>
							<div
								class="unsplash-card pexels-card pexels-video-card"
								class:unsplash-card--loading={pexelsApplyingId === video.id}
								title={`Video by ${video.photographer} on Pexels`}
							>
								<button
									type="button"
									class="unsplash-card-action"
									disabled={pexelsApplyingId === video.id || !onUsePexelsVideo}
									onclick={() => void applyPexelsVideo(video)}
								>
									{#if video.thumb}
										<img src={video.thumb} alt={video.alt} loading="lazy" />
									{:else}
										<div class="pexels-video-fallback"><Film size={18} /></div>
									{/if}
									<span class="pexels-video-badge" aria-hidden="true">
										<Film size={10} />
										{formatDuration(video.duration)}
									</span>
								</button>
								{#if pexelsApplyingId === video.id}
									<div class="asset-busy"><Loader size={14} class="animate-spin" /></div>
								{:else}
									<span class="unsplash-credit">
										{video.photographer}
										· Video BG
									</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>

				{#if pexelsHasMore}
					<div class="unsplash-load-more">
						<button
							type="button"
							class="load-more-btn"
							disabled={pexelsLoading}
							onclick={() => void loadMorePexels()}
						>
							{#if pexelsLoading}
								<Loader size={14} class="animate-spin" />
								<span>Loading page {pexelsPage + 1}…</span>
							{:else}
								<span>Load More (Page {pexelsPage + 1})</span>
								<span class="load-more-count">{pexelsVideos.length} videos • {pexelsPage} of {pexelsTotalPages}</span>
							{/if}
						</button>
					</div>
				{/if}

				<p class="unsplash-note">
					Videos via
					<a href="https://www.pexels.com/videos/" target="_blank" rel="noopener noreferrer">Pexels</a>
				</p>
			{:else}
				<ul class="unsplash-grid">
					{#each pexelsPhotos as photo (photo.id)}
						<li>
							<div
								class="unsplash-card pexels-card"
								class:unsplash-card--loading={pexelsApplyingId === photo.id}
								title={`Photo by ${photo.photographer} on Pexels`}
							>
								<div class="pexels-image-wrapper">
									<button
										type="button"
										class="unsplash-card-action"
										disabled={pexelsApplyingId === photo.id}
										onclick={() => void applyPexels(photo)}
									>
										<img src={photo.small} alt={photo.alt} loading="lazy" />
									</button>
									<button
										type="button"
										class="pexels-expand-btn"
										onclick={(e) => expandPexelsImage(photo, e)}
										title="View full size"
										disabled={pexelsApplyingId === photo.id}
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
										</svg>
									</button>
								</div>
								{#if pexelsApplyingId === photo.id}
									<div class="asset-busy"><Loader size={14} class="animate-spin" /></div>
								{:else}
									<span class="unsplash-credit">
										{photo.photographer}
										· BG
									</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>

				{#if pexelsHasMore}
					<div class="unsplash-load-more">
						<button
							type="button"
							class="load-more-btn"
							disabled={pexelsLoading}
							onclick={() => void loadMorePexels()}
						>
							{#if pexelsLoading}
								<Loader size={14} class="animate-spin" />
								<span>Loading page {pexelsPage + 1}…</span>
							{:else}
								<span>Load More (Page {pexelsPage + 1})</span>
								<span class="load-more-count">{pexelsPhotos.length} photos • {pexelsPage} of {pexelsTotalPages}</span>
							{/if}
						</button>
					</div>
				{/if}

				<p class="unsplash-note">
					Photos via
					<a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a>
				</p>
			{/if}
		</div>
		{#if pexelsError}
			<p class="assets-error">{pexelsError}</p>
		{/if}
	{/if}
</aside>
{/if}

<style>
	.assets-sidebar {
		width: 100%;
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border-left: 1px solid color-mix(in oklab, var(--app-border, #e8e8e8) 100%, transparent);
		background: color-mix(in oklab, var(--app-surface, #fff) 100%, transparent);
		box-shadow: -8px 0 24px rgba(0, 0, 0, 0.04);
		overflow: hidden;
	}

	.assets-sidebar--collapsed {
		align-items: center;
		gap: 10px;
		padding: 12px 6px;
	}

	.assets-rail-label {
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--app-text-3, #8a8a8a);
		writing-mode: vertical-rl;
		user-select: none;
	}

	.assets-collapse-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		border: 1px solid color-mix(in oklab, var(--app-border, #e8e8e8) 100%, transparent);
		border-radius: 8px;
		background: transparent;
		color: var(--app-text-2, #555);
		cursor: pointer;
		transition: background 140ms ease, color 140ms ease;
	}
	.assets-collapse-btn:hover {
		background: color-mix(in oklab, var(--app-text, #000) 6%, transparent);
		color: var(--app-text, #111);
	}

	.assets-header {
		padding: 14px 14px 10px;
		border-bottom: 1px solid color-mix(in oklab, var(--app-border, #ebebeb) 100%, transparent);
		flex-shrink: 0;
	}

	.assets-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
	}

	.assets-title {
		font-size: 13px;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--app-text, #1a1a1a);
	}

	.assets-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 4px;
		padding: 3px;
		margin-bottom: 10px;
		border-radius: 10px;
		background: #f0f0f0;
	}
	.assets-tab {
		height: 28px;
		border: none;
		border-radius: 8px;
		background: transparent;
		font-size: 11.5px;
		font-weight: 650;
		color: #777;
		cursor: pointer;
	}
	.assets-tab--on {
		background: #fff;
		color: #111;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.assets-upload-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 28px;
		padding: 0 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, var(--app-border, #e2e2e2) 100%, transparent);
		background: var(--app-surface, #fff);
		color: var(--app-text, #111);
		font-size: 11.5px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, transform 0.12s;
	}
	.assets-upload-btn:hover:not(:disabled) {
		border-color: #c8c8c8;
		background: #fafafa;
	}
	.assets-upload-btn:active:not(:disabled) {
		transform: scale(0.97);
	}
	.assets-upload-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.assets-search {
		position: relative;
		display: flex;
		align-items: center;
	}
	.assets-search--unsplash {
		padding-right: 0;
	}
	.assets-search--pexels {
		padding-right: 0;
	}
	.pexels-kind {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		padding: 3px;
		margin-bottom: 8px;
		border-radius: 10px;
		background: #f0f0f0;
	}
	.pexels-kind-btn {
		height: 26px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: #777;
		font-size: 11px;
		font-weight: 650;
		cursor: pointer;
		transition: background 120ms ease, color 120ms ease;
	}
	.pexels-kind-btn--on {
		background: #fff;
		color: #111;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.pexels-video-card .unsplash-card-action {
		position: relative;
	}
	.pexels-video-badge {
		position: absolute;
		left: 6px;
		bottom: 6px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 7px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.02em;
		pointer-events: none;
	}
	.pexels-video-fallback {
		width: 100%;
		aspect-ratio: 3 / 4;
		display: grid;
		place-items: center;
		background: #1a1a1a;
		color: rgba(255, 255, 255, 0.45);
	}
	.assets-search-icon {
		position: absolute;
		left: 10px;
		color: #b0b0b0;
		pointer-events: none;
	}
	.assets-search-input {
		width: 100%;
		height: 32px;
		padding: 0 28px 0 30px;
		border-radius: 10px;
		border: 1px solid #ebebeb;
		background: #f7f7f7;
		font-size: 12px;
		color: var(--app-text, #1a1a1a);
		outline: none;
	}
	.assets-search--unsplash .assets-search-input {
		padding-right: 52px;
	}
	.assets-search--pexels .assets-search-input {
		padding-right: 52px;
	}
	.assets-search-input:focus {
		border-color: #d0d0d0;
		background: #fff;
	}
	.assets-search-go {
		position: absolute;
		right: 4px;
		height: 24px;
		padding: 0 10px;
		border: none;
		border-radius: 8px;
		background: #1a1a1a;
		color: #fff;
		font-size: 11px;
		font-weight: 650;
		cursor: pointer;
	}
	.assets-search-go:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.assets-clear {
		position: absolute;
		right: 8px;
		width: 18px;
		height: 18px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: #aaa;
		display: grid;
		place-items: center;
		cursor: pointer;
	}

	.assets-drop {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 10px;
		transition: background 0.15s;
	}
	.assets-drop--active {
		background: color-mix(in oklab, #c8f050 18%, transparent);
	}

	.assets-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 180px;
		padding: 24px 12px;
		text-align: center;
		color: #9a9a9a;
		font-size: 12px;
	}
	.assets-empty-btn {
		width: 100%;
		border: 1.5px dashed #e0e0e0;
		border-radius: 14px;
		background: #fafafa;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.assets-empty-btn:hover:not(:disabled) {
		border-color: #c8c8c8;
		background: #f5f5f5;
	}
	.assets-empty-btn:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.assets-empty-icon {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: #fff;
		border: 1px solid #ebebeb;
		display: grid;
		place-items: center;
		color: #888;
		margin-bottom: 4px;
	}
	.assets-empty p {
		margin: 0;
		font-weight: 600;
		color: #555;
		font-size: 12.5px;
	}
	.assets-empty span {
		font-size: 11px;
		color: #a8a8a8;
		line-height: 1.35;
		max-width: 16rem;
	}

	.assets-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.asset-card {
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: 8px;
		padding: 8px;
		border-radius: 12px;
		border: 1px solid #ececec;
		background: #fff;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.asset-card:hover {
		border-color: #ddd;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
	}

	.asset-thumb {
		position: relative;
		width: 64px;
		height: 64px;
		border-radius: 8px;
		overflow: hidden;
		background: #f0f0f0;
		flex-shrink: 0;
	}
	button.asset-thumb-btn {
		border: none;
		padding: 0;
		cursor: pointer;
		transition: box-shadow 0.12s ease, transform 0.12s ease;
	}
	button.asset-thumb-btn:hover {
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--app-accent, #7bf1a8) 70%, transparent);
		transform: scale(1.02);
	}
	.asset-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.asset-thumb-fallback {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: #bbb;
	}
	.asset-busy {
		position: absolute;
		inset: 0;
		background: rgba(255, 255, 255, 0.72);
		display: grid;
		place-items: center;
	}

	.asset-meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		justify-content: center;
	}
	.asset-name {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: #222;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.asset-rename {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.asset-rename-input {
		flex: 1;
		min-width: 0;
		height: 26px;
		padding: 0 8px;
		border-radius: 7px;
		border: 1px solid #ddd;
		font-size: 12px;
		outline: none;
	}

	.asset-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}

	.action-chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		height: 22px;
		padding: 0 7px;
		border-radius: 999px;
		border: 1px solid #e8e8e8;
		background: #fafafa;
		font-size: 10px;
		font-weight: 650;
		color: #444;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
	}
	.action-chip:hover {
		background: #f0f0f0;
		border-color: #d8d8d8;
	}

	.icon-btn {
		width: 22px;
		height: 22px;
		border-radius: 7px;
		border: 1px solid transparent;
		background: transparent;
		color: #888;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}
	.icon-btn:hover {
		background: #f3f3f3;
		color: #333;
	}
	.icon-btn--danger:hover {
		background: #fef2f2;
		color: #dc2626;
	}
	.icon-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.unsplash-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.unsplash-card {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		padding: 0;
		border: 1px solid #ececec;
		border-radius: 10px;
		overflow: hidden;
		background: #f0f0f0;
	}
	.unsplash-card-action {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
	}
	.unsplash-card-action img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.unsplash-card:hover {
		border-color: #ccc;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
	}
	.unsplash-card--loading {
		cursor: wait;
	}
	.unsplash-card--loading .unsplash-card-action {
		cursor: wait;
	}
	.unsplash-credit {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 16px 6px 5px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
		color: #fff;
		font-size: 9px;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.unsplash-load-more {
		padding: 12px 16px 8px;
		display: flex;
		justify-content: center;
	}

	.load-more-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 20px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: #fff;
		color: #333;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
		width: 100%;
	}

	.load-more-btn:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.15);
	}

	.load-more-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.load-more-count {
		font-size: 11px;
		opacity: 0.65;
		font-weight: 500;
	}

	.unsplash-note {
		margin: 10px 2px 0;
		font-size: 10px;
		color: #999;
		text-align: center;
	}
	.unsplash-note a {
		color: #666;
		text-decoration: underline;
	}

	.pexels-image-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.pexels-expand-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: rgba(255, 255, 255, 0.95);
		color: #333;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transform: scale(0.9);
		transition: all 0.15s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 2;
	}

	.pexels-card:hover .pexels-expand-btn {
		opacity: 1;
		transform: scale(1);
	}

	.unsplash-card:hover .pexels-expand-btn {
		opacity: 1;
		transform: scale(1);
	}

	.pexels-expand-btn:hover {
		background: #fff;
		color: #000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	}

	.pexels-expand-btn svg {
		width: 14px;
		height: 14px;
	}

	.assets-error {
		margin: 0;
		padding: 8px 12px 12px;
		font-size: 11px;
		line-height: 1.35;
		color: #dc2626;
		flex-shrink: 0;
	}
	.assets-error-top {
		padding: 8px 12px 0;
	}

	:global([data-theme='dark']) .assets-sidebar {
		background: #121212;
		border-left-color: rgba(255, 255, 255, 0.08);
		box-shadow: none;
	}
	:global([data-theme='dark']) .assets-title,
	:global([data-theme='dark']) .asset-name {
		color: #f2f2f2;
	}
	:global([data-theme='dark']) .assets-tabs {
		background: #1a1a1a;
	}
	:global([data-theme='dark']) .assets-tab--on {
		background: #2a2a2a;
		color: #fff;
	}
	:global([data-theme='dark']) .assets-upload-btn,
	:global([data-theme='dark']) .asset-card,
	:global([data-theme='dark']) .action-chip,
	:global([data-theme='dark']) .unsplash-card {
		background: #1a1a1a;
		border-color: rgba(255, 255, 255, 0.1);
		color: #eee;
	}
	:global([data-theme='dark']) .assets-search-input {
		background: #1a1a1a;
		border-color: rgba(255, 255, 255, 0.1);
		color: #eee;
	}
	:global([data-theme='dark']) .assets-empty-btn {
		background: #161616;
		border-color: rgba(255, 255, 255, 0.12);
	}
	:global([data-theme='dark']) .assets-empty p {
		color: #ddd;
	}
</style>
