<script lang="ts">
	import { goto } from '$app/navigation';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import type { ComponentProps } from 'svelte';

	type NavGroupItem = { href: string; label: string; icon: any };
	type NavGroup = { label: string; items: NavGroupItem[] };

	let {
		ref = $bindable(null),
		navGroups,
		currentPath = '',
		signedIn = true,
		onSignOut,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		navGroups: NavGroup[];
		currentPath?: string;
		signedIn?: boolean;
		onSignOut?: () => void;
	} = $props();

	function isActive(href: string) {
		if (!currentPath) return false;
		const cleanHref = (href.split('?')[0] || href).replace(/\/+$/, '') || '/';
		const path = currentPath.replace(/\/+$/, '') || '/';
		if (path === cleanHref) return true;
		// Overview is exact-match only (never prefix-match /dashboard/*).
		if (cleanHref === '/dashboard') return false;
		// Studio must never light up Templates / Carousels / etc.
		if (path.startsWith('/dashboard/studio')) return false;
		return path.startsWith(cleanHref + '/');
	}

	function onNavClick(e: MouseEvent, href: string) {
		const cleanHref = (href.split('?')[0] || href).replace(/\/+$/, '') || '/';
		if (cleanHref !== '/dashboard/templates') return;
		if (typeof window === 'undefined') return;
		const path = (window.location.pathname || '').replace(/\/+$/, '') || '/';
		if (path === '/dashboard/templates') return;
		e.preventDefault();
		void goto('/dashboard/templates');
	}
</script>

<Sidebar.Root {...restProps} bind:ref>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/dashboard" {...props}>
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<GalleryVerticalEndIcon class="size-4" />
							</div>
							<div class="grid flex-1 text-start text-sm leading-tight">
								<span class="truncate font-semibold">Meme Accounts</span>
								<span class="truncate text-xs">Studio</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		{#each navGroups as group (group.label)}
			<Sidebar.Group>
				<Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each group.items as item (item.href)}
							{@const Icon = item.icon}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={isActive(item.href)}
									tooltipContent={item.label}
								>
									{#snippet child({ props })}
										<a
											href={item.href}
											{...props}
											data-nav={item.label}
											aria-current={isActive(item.href) ? 'page' : undefined}
											onclick={(e) => onNavClick(e, item.href)}
										>
											<Icon />
											<span>{item.label}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton tooltipContent="Pricing">
					{#snippet child({ props })}
						<a href="/pricing" {...props}>
							<CreditCardIcon />
							<span>Pricing</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton tooltipContent={signedIn ? 'Sign out' : 'Sign in'} onclick={() => onSignOut?.()}>
					<LogOutIcon />
					<span>{signedIn ? 'Sign out' : 'Sign in'}</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
