<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import type { ComponentProps } from 'svelte';

	export type NavGroupItem = {
		href: string;
		label: string;
		icon?: any;
		children?: { href: string; label: string }[];
	};
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

	const currentSearch = $derived($page.url.search);

	function normalizeNavHref(href: string): string {
		const path = (href.split('?')[0] || href).replace(/\/+$/, '') || '/';
		const qs = href.includes('?') ? href.slice(href.indexOf('?')) : '';
		const params = new URLSearchParams(qs);
		if (params.get('blank')) return `${path}?blank=1`;
		const template = String(params.get('template') ?? '').trim().toLowerCase();
		if (template) return `${path}?template=${template}`;
		return path;
	}

	function isStudioTemplateActive(href: string): boolean {
		const path = currentPath.replace(/\/+$/, '') || '/';
		if (!path.startsWith('/dashboard/studio')) return false;
		const current = normalizeNavHref(path + currentSearch);
		const target = normalizeNavHref(href);
		return current === target;
	}

	function isActive(href: string) {
		if (!currentPath) return false;
		const cleanHref = (href.split('?')[0] || href).replace(/\/+$/, '') || '/';
		const path = currentPath.replace(/\/+$/, '') || '/';
		if (path === cleanHref && !href.includes('?')) return true;
		if (isStudioTemplateActive(href)) return true;
		// Overview is exact-match only (never prefix-match /dashboard/*).
		if (cleanHref === '/dashboard') return false;
		// Studio sub-links only match via query — not generic /dashboard/studio.
		if (path.startsWith('/dashboard/studio') && href.includes('?')) return false;
		if (path.startsWith('/dashboard/studio')) return false;
		return path.startsWith(cleanHref + '/');
	}

	function isNavItemActive(item: NavGroupItem) {
		if (item.children?.length) {
			return isActive(item.href) || item.children.some((child) => isStudioTemplateActive(child.href));
		}
		return isActive(item.href);
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
							<img
								src="/logo/favicon/android-chrome-192x192.png"
								alt="Meme Accounts"
								width="32"
								height="32"
								class="size-8 shrink-0 rounded-lg"
							/>
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
							{#if item.children?.length}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										isActive={isNavItemActive(item)}
										tooltipContent={item.label}
									>
										{#snippet child({ props })}
											<a
												href={item.href}
												{...props}
												data-nav={item.label}
												aria-current={isNavItemActive(item) ? 'page' : undefined}
												onclick={(e) => onNavClick(e, item.href)}
											>
												{#if Icon}
													<Icon />
												{/if}
												<span>{item.label}</span>
											</a>
										{/snippet}
									</Sidebar.MenuButton>
									<Sidebar.MenuSub>
										{#each item.children as child (child.href)}
											<Sidebar.MenuSubItem>
												<Sidebar.MenuSubButton
													isActive={isStudioTemplateActive(child.href)}
													href={child.href}
												>
													<span>{child.label}</span>
												</Sidebar.MenuSubButton>
											</Sidebar.MenuSubItem>
										{/each}
									</Sidebar.MenuSub>
								</Sidebar.MenuItem>
							{:else}
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
												{#if Icon}
													<Icon />
												{/if}
												<span>{item.label}</span>
											</a>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/if}
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
