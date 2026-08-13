<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import BulkClipImportForm from '$lib/components/bulk/BulkClipImportForm.svelte';
	import {
		stashClipImportResult,
		type BulkClipImportResult,
	} from '$lib/studio/bulk-video-clips';
	import {
		ArrowRight,
		Clapperboard,
		Clock,
		CloudUpload,
		LayoutGrid,
		List,
		MoreHorizontal,
		Scissors,
		Zap,
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { cn } from '$lib/utils.js';

	type ProjectCard = {
		id: string;
		title: string;
		thumbnailUrl?: string | null;
		sourceTitle?: string;
		sourceKind?: 'youtube' | 'upload';
		clipCount: number;
		showCount: number;
		durationSec?: number;
		topic?: string;
		updatedAt?: string;
		hasBulkShows: boolean;
		url: string;
	};

	let userId = $state('');
	let loading = $state(true);
	let projects = $state<ProjectCard[]>([]);
	let brokenThumbs = $state<Record<string, true>>({});
	let recentView = $state<'grid' | 'list'>('grid');
	let sortMode = $state<'recent' | 'clips'>('recent');

	onMount(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			goto('/login');
			return;
		}
		userId = user.id;
		await refreshProjects();
	});

	async function refreshProjects() {
		loading = true;
		try {
			const res = await fetch('/api/videos/clip-projects');
			if (res.ok) {
				const data = (await res.json()) as { projects?: ProjectCard[] };
				projects = data.projects ?? [];
			}
		} catch {
			/* ignore */
		} finally {
			loading = false;
		}
	}

	function onComplete(result: BulkClipImportResult) {
		stashClipImportResult(result);
		goto('/dashboard/bulk');
	}

	function timeAgo(iso?: string) {
		const t = Date.parse(String(iso ?? ''));
		if (!Number.isFinite(t)) return '';
		const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
		if (sec < 60) return 'just now';
		if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
		if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
		if (sec < 86400 * 14) return `${Math.floor(sec / 86400)}d ago`;
		return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function formatDuration(totalSec: number): string {
		const s = Math.max(0, Math.round(totalSec));
		if (s < 60) return `0:${String(s).padStart(2, '0')}`;
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const r = s % 60;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}:${String(r).padStart(2, '0')}`;
	}

	function topicLabel(p: ProjectCard): string {
		const t = String(p.topic ?? '').trim();
		if (!t) return 'General';
		return t.length > 18 ? `${t.slice(0, 16)}…` : t;
	}

	function topicVariant(label: string): 'default' | 'secondary' | 'outline' {
		const key = label.toLowerCase();
		if (key.includes('news')) return 'default';
		if (key.includes('health') || key.includes('fit')) return 'secondary';
		return 'outline';
	}

	const sortedProjects = $derived.by(() => {
		const list = [...projects];
		if (sortMode === 'clips') {
			list.sort((a, b) => (b.clipCount || 0) - (a.clipCount || 0));
		} else {
			list.sort(
				(a, b) => Date.parse(String(b.updatedAt ?? '')) - Date.parse(String(a.updatedAt ?? '')),
			);
		}
		return list;
	});

	const recentProjects = $derived(sortedProjects.slice(0, 6));
	const pastProjects = $derived(sortedProjects);

	const stats = $derived.by(() => {
		const totalVideos = projects.length;
		const totalClips = projects.reduce((n, p) => n + (p.clipCount || 0), 0);
		const totalDuration = projects.reduce((n, p) => n + (Number(p.durationSec) || 0), 0);
		const exported = projects.filter((p) => p.hasBulkShows).length;
		return { totalVideos, totalClips, totalDuration, exported };
	});

	function markBroken(id: string) {
		brokenThumbs = { ...brokenThumbs, [id]: true };
	}
</script>

<svelte:head>
	<title>Videos — Social Poster</title>
</svelte:head>

<div class="dash-page flex flex-col gap-8">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="space-y-1.5">
			<h1 class="dash-page-title">Videos</h1>
			<p class="text-sm text-muted-foreground max-w-[52ch]">
				Manage and explore your clipped videos.
			</p>
		</div>
		<Button href="/dashboard/bulk" class="shadow-sm">
			<Zap data-icon="inline-start" />
			Open Bulk Editor
		</Button>
	</header>

	<!-- Import + stats -->
	<section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] xl:items-start">
		<div class="min-w-0 space-y-3">
			{#if userId}
				<BulkClipImportForm
					userId={userId}
					layout="split"
					showRecent={false}
					oncomplete={onComplete}
				/>
			{:else}
				<Skeleton class="h-28 w-full rounded-xl" />
			{/if}
			<p class="text-xs text-muted-foreground">
				After <strong class="font-medium text-foreground">Find clips</strong>, you'll open Bulk with
				one slide per clip. Sort library by
				<button
					type="button"
					class={cn(
						'underline-offset-3 font-medium hover:underline',
						sortMode === 'recent' ? 'text-foreground' : 'text-muted-foreground',
					)}
					onclick={() => (sortMode = 'recent')}
				>
					recent
				</button>
				or
				<button
					type="button"
					class={cn(
						'underline-offset-3 font-medium hover:underline',
						sortMode === 'clips' ? 'text-foreground' : 'text-muted-foreground',
					)}
					onclick={() => (sortMode = 'clips')}
				>
					clip count
				</button>.
			</p>
		</div>

		<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-1">
			{#each [
				{
					label: 'Total Videos',
					value: String(stats.totalVideos),
					icon: Clapperboard,
					tone: 'bg-emerald-500/12 text-emerald-700',
				},
				{
					label: 'Total Clips',
					value: String(stats.totalClips),
					icon: Scissors,
					tone: 'bg-violet-500/12 text-violet-700',
				},
				{
					label: 'Total Duration',
					value: stats.totalDuration ? formatDuration(stats.totalDuration) : '—',
					icon: Clock,
					tone: 'bg-sky-500/12 text-sky-700',
				},
				{
					label: 'In Bulk',
					value: String(stats.exported),
					icon: CloudUpload,
					tone: 'bg-orange-500/12 text-orange-700',
				},
			] as stat (stat.label)}
				{@const Icon = stat.icon}
				<Card.Root size="sm" class="py-3">
					<Card.Content class="flex items-center gap-3">
						<div class={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', stat.tone)}>
							<Icon class="size-4" />
						</div>
						<div class="min-w-0">
							<p class="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
							<p class="truncate text-lg font-semibold tracking-tight">{loading ? '—' : stat.value}</p>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</section>

	<!-- Recent clips -->
	<section class="flex flex-col gap-4" aria-labelledby="recent-clips-heading">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div class="space-y-1">
				<h2 id="recent-clips-heading" class="text-base font-semibold tracking-tight">Recent Clips</h2>
				<p class="text-sm text-muted-foreground">Your latest clipped videos.</p>
			</div>
			<div class="flex items-center gap-1.5">
				<Button href="/dashboard/bulk" variant="ghost" size="sm">
					View all
					<ArrowRight data-icon="inline-end" />
				</Button>
				<Button
					type="button"
					variant={recentView === 'grid' ? 'secondary' : 'ghost'}
					size="icon-sm"
					aria-label="Grid view"
					onclick={() => (recentView = 'grid')}
				>
					<LayoutGrid />
				</Button>
				<Button
					type="button"
					variant={recentView === 'list' ? 'secondary' : 'ghost'}
					size="icon-sm"
					aria-label="List view"
					onclick={() => (recentView = 'list')}
				>
					<List />
				</Button>
			</div>
		</div>

		{#if loading}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
				{#each [0, 1, 2, 3, 4, 5] as i (i)}
					<Skeleton class="aspect-4/5 rounded-xl" />
				{/each}
			</div>
		{:else if recentProjects.length === 0}
			<Empty.Root class="border border-dashed">
				<Empty.Header>
					<Empty.Media variant="icon"><Clapperboard /></Empty.Media>
					<Empty.Title>No clips yet</Empty.Title>
					<Empty.Description>
						Paste a YouTube URL above and hit Find clips to get started.
					</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else if recentView === 'grid'}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
				{#each recentProjects as project (project.id)}
					{@const thumb = String(project.thumbnailUrl ?? '').trim()}
					<Card.Root class="group relative gap-0 overflow-hidden py-0 [--card-spacing:0]">
						<a href={project.url} class="block outline-none">
							<div class="relative aspect-video overflow-hidden bg-muted">
								{#if thumb && !brokenThumbs[project.id]}
									<img
										src={thumb}
										alt=""
										class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
										loading="lazy"
										referrerpolicy="no-referrer"
										onerror={() => markBroken(project.id)}
									/>
								{:else}
									<div class="flex size-full items-center justify-center text-muted-foreground">
										<Clapperboard class="size-6 opacity-40" />
									</div>
								{/if}
								<span
									class="absolute top-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
								>
									{formatDuration(Number(project.durationSec) || 0)}
								</span>
								<span
									class="absolute top-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
								>
									{project.clipCount}
								</span>
							</div>
							<div class="space-y-2 p-3">
								<p class="line-clamp-2 text-sm font-semibold leading-snug">{project.title}</p>
								<div class="flex items-center gap-2 text-[11px] text-muted-foreground">
									<span class="inline-flex items-center gap-1">
										<Scissors class="size-3" />
										{project.clipCount}
									</span>
									<span>·</span>
									<span>{timeAgo(project.updatedAt)}</span>
								</div>
								<div class="flex items-center justify-between pt-0.5">
									<span class="text-[11px] font-medium text-muted-foreground capitalize">
										{project.sourceKind === 'upload' ? 'Upload' : 'YouTube'}
									</span>
								</div>
							</div>
						</a>
						<div class="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											type="button"
											variant="secondary"
											size="icon-xs"
											class="bg-background/90 shadow-sm"
											aria-label="Project actions"
											onclick={(e: MouseEvent) => e.preventDefault()}
										>
											<MoreHorizontal />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end" class="w-44">
									<DropdownMenu.Item onclick={() => goto(project.url)}>Open in Bulk</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => goto('/dashboard/bulk')}>Bulk editor</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					</Card.Root>
				{/each}
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Video</Table.Head>
							<Table.Head>Clips</Table.Head>
							<Table.Head>Added</Table.Head>
							<Table.Head class="w-10"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each recentProjects as project (project.id)}
							<Table.Row class="cursor-pointer" onclick={() => goto(project.url)}>
								<Table.Cell class="font-medium">{project.title}</Table.Cell>
								<Table.Cell>{project.clipCount}</Table.Cell>
								<Table.Cell class="text-muted-foreground">{timeAgo(project.updatedAt)}</Table.Cell>
								<Table.Cell>
									<Button href={project.url} variant="ghost" size="icon-xs" aria-label="Open">
										<ArrowRight />
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}
	</section>

	<!-- Past videos table -->
	<section class="flex flex-col gap-4" aria-labelledby="past-videos-heading">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div class="space-y-1">
				<h2 id="past-videos-heading" class="text-base font-semibold tracking-tight">Past Videos</h2>
				<p class="text-sm text-muted-foreground">Previously clipped content</p>
			</div>
			<Button href="/dashboard/bulk" variant="ghost" size="sm">
				View all
				<ArrowRight data-icon="inline-end" />
			</Button>
		</div>

		{#if loading}
			<Skeleton class="h-48 w-full rounded-xl" />
		{:else if pastProjects.length === 0}
			<Empty.Root class="border border-dashed py-10">
				<Empty.Header>
					<Empty.Title>Nothing here yet</Empty.Title>
					<Empty.Description>Clipped projects will show up in this table.</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else}
			<div class="overflow-hidden rounded-xl border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Video</Table.Head>
							<Table.Head>Clips</Table.Head>
							<Table.Head class="hidden md:table-cell">Duration</Table.Head>
							<Table.Head class="hidden lg:table-cell">Topic</Table.Head>
							<Table.Head class="hidden sm:table-cell">Source</Table.Head>
							<Table.Head>Added</Table.Head>
							<Table.Head class="w-10"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each pastProjects as project (project.id)}
							{@const thumb = String(project.thumbnailUrl ?? '').trim()}
							{@const topic = topicLabel(project)}
							<Table.Row>
								<Table.Cell>
									<a href={project.url} class="flex min-w-0 items-center gap-3">
										<span
											class="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10"
										>
											{#if thumb && !brokenThumbs[`t-${project.id}`]}
												<img
													src={thumb}
													alt=""
													class="size-full object-cover"
													loading="lazy"
													referrerpolicy="no-referrer"
													onerror={() => markBroken(`t-${project.id}`)}
												/>
											{/if}
										</span>
										<span class="truncate font-medium">{project.title}</span>
									</a>
								</Table.Cell>
								<Table.Cell>
									<span class="inline-flex items-center gap-1.5 text-muted-foreground">
										<Scissors class="size-3.5" />
										{project.clipCount} clip{project.clipCount === 1 ? '' : 's'}
									</span>
								</Table.Cell>
								<Table.Cell class="hidden text-muted-foreground md:table-cell">
									{project.durationSec ? formatDuration(project.durationSec) : '—'}
								</Table.Cell>
								<Table.Cell class="hidden lg:table-cell">
									<Badge variant={topicVariant(topic)}>{topic}</Badge>
								</Table.Cell>
								<Table.Cell class="hidden capitalize text-muted-foreground sm:table-cell">
									{project.sourceKind === 'upload' ? 'Upload' : 'YouTube'}
								</Table.Cell>
								<Table.Cell class="text-muted-foreground">{timeAgo(project.updatedAt)}</Table.Cell>
								<Table.Cell>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													type="button"
													variant="ghost"
													size="icon-xs"
													aria-label="Row actions"
												>
													<MoreHorizontal />
												</Button>
											{/snippet}
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-44">
											<DropdownMenu.Item onclick={() => goto(project.url)}>Open in Bulk</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}
	</section>
</div>
