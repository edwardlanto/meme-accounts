<script lang="ts">
	import { page } from '$app/stores';
	import { beforeNavigate, goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import {
		LayoutDashboard,
		ImagePlus,
		Rows3,
		Video,
		LayoutTemplate,
		Clapperboard,
	} from 'lucide-svelte';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from '$lib/utils.js';
	import BrandOnboarding from '$lib/components/BrandOnboarding.svelte';
	import { STARTER_TEMPLATES } from '$lib/templates';

	const TEMPLATE_NAV_LABELS: Record<string, string> = {
		empty: 'Blank',
		news: 'News',
		text: 'Text carousel',
		'video-source': 'Highlight',
		'video-text': 'Text on video',
		'video-creator': 'Creator hook',
	};

	const templateNavChildren = STARTER_TEMPLATES.map((t) => ({
		href: t.href,
		label: TEMPLATE_NAV_LABELS[t.id] ?? t.name,
	}));

	let { children, data } = $props();

	const clipFinderEnabled = $derived(Boolean(data.clipFinderEnabled));

	const navGroups = [
		{
			label: 'Create',
			items: [
				{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
				/** Gallery of starters — must stay `/dashboard/templates` (not Studio). */
				{
					href: '/dashboard/templates',
					label: 'Templates',
					icon: LayoutTemplate,
					children: templateNavChildren,
				},
				{ href: '/dashboard/carousels', label: 'Carousels', icon: ImagePlus },
				{ href: '/dashboard/clips', label: 'Clips', icon: Clapperboard },
				{ href: '/dashboard/bulk', label: 'Bulk', icon: Rows3 },
				{ href: '/dashboard/videos', label: 'Videos', icon: Video },
			].filter(
				(item) =>
					clipFinderEnabled
					|| (item.href !== '/dashboard/clips' && item.href !== '/dashboard/videos'),
			),
		},
	];

	const crumbLabels: Record<string, string> = {
		dashboard: 'Dashboard',
		templates: 'Templates',
		studio: 'Studio',
		carousels: 'Carousels',
		clips: 'Clips',
		bulk: 'Bulk',
		videos: 'Videos',
		settings: 'Settings',
		editor: 'Editor',
		new: 'New',
		slideshows: 'Slideshows',
		analytics: 'Analytics',
		discover: 'Discover',
		integrations: 'Integrations',
		branding: 'Branding',
		composer: 'Composer',
		grid: 'Grid',
		video: 'Video',
	};

	async function signOut() {
		if (!data.user) {
			goto('/login?next=/dashboard/settings');
			return;
		}
		await supabase.auth.signOut();
		goto('/login?next=/dashboard/settings');
	}

	const signedIn = $derived(!!data.user);
	const currentPath = $derived($page.url.pathname);
	const sidebarRailOnly = $derived(currentPath.startsWith('/dashboard/editor/'));
	const toolPage = $derived(
		currentPath.startsWith('/dashboard/studio') ||
			currentPath.startsWith('/dashboard/editor/')
	);

	const crumbs = $derived.by(() => {
		const parts = currentPath.replace(/\/+$/, '').split('/').filter(Boolean);
		return parts.map((seg, i) => ({
			href: '/' + parts.slice(0, i + 1).join('/'),
			label: crumbLabels[seg] ?? decodeURIComponent(seg),
		}));
	});

	let sidebarOpen = $state(true);

	$effect(() => {
		if (sidebarRailOnly) sidebarOpen = false;
	});

	/** Studio popovers can leave body { pointer-events: none } and block sidebar links. */
	beforeNavigate(() => {
		if (typeof document === 'undefined') return;
		document.body.style.pointerEvents = '';
		document.body.style.overflow = '';
		document.body.style.removeProperty('--scrollbar-width');
		document.body.style.paddingRight = '';
		document.body.style.marginRight = '';
	});

	type ThemeMode = 'light' | 'dark';
	function applyTheme(_next: ThemeMode) {
		document.documentElement.dataset.theme = 'light';
		try {
			localStorage.setItem('theme', 'light');
		} catch {
			/* ignore */
		}
	}
	if (typeof window !== 'undefined') {
		applyTheme('light');
	}
</script>

<Sidebar.Provider bind:open={sidebarOpen} class="h-svh overflow-hidden">
	<AppSidebar
		navGroups={navGroups}
		currentPath={currentPath}
		signedIn={signedIn}
		onSignOut={signOut}
		collapsible={sidebarRailOnly ? 'icon' : 'offcanvas'}
	/>
	<Sidebar.Inset class="min-h-0 min-w-0 overflow-hidden">
		<header
			class={cn(
				'relative z-40 flex h-14 shrink-0 items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] md:h-16 md:px-4',
				toolPage && 'md:hidden'
			)}
		>
			<Sidebar.Trigger class="-ms-1 min-h-11 min-w-11 md:min-h-8 md:min-w-8" />
			<Separator orientation="vertical" class="me-2 h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each crumbs as crumb, i (crumb.href)}
						{#if i > 0}
							<Breadcrumb.Separator class="hidden md:block" />
						{/if}
						<Breadcrumb.Item class={i < crumbs.length - 1 ? 'hidden md:block' : ''}>
							{#if i === crumbs.length - 1}
								<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>
		<div class={cn('min-h-0 min-w-0 flex-1', toolPage ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto')}>
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
{#if signedIn && data.user?.id}
	<BrandOnboarding userId={data.user.id} />
{/if}
