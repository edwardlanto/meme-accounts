<script lang="ts">
	import { goto } from '$app/navigation';
	import { PanelLeft, LogOut, MoreHorizontal } from 'lucide-svelte';

	type NavGroupItem = { href: string; label: string; icon: any };
	type NavGroup = { label: string; items: NavGroupItem[] };

	type Props = {
		navGroups: NavGroup[];
		currentPath?: string;
		theme?: 'light' | 'dark';
		railOnly?: boolean;
		signedIn?: boolean;
		onThemeToggle?: () => void;
		onSignOut?: () => void;
	};

	let {
		navGroups,
		currentPath = '',
		theme = 'light',
		railOnly = false,
		signedIn = true,
		onThemeToggle: _onThemeToggle,
		onSignOut,
	}: Props = $props();
	void theme;
	void _onThemeToggle;

	let isCollapsed = $state(false);
	const softEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

	function isActive(href: string) {
		if (!currentPath) return false;
		if (currentPath === href) return true;
		if (href === '/dashboard') return false;
		// match without query string
		const cleanHref = href.split('?')[0];
		return currentPath === cleanHref || currentPath.startsWith(cleanHref + '/');
	}

	function toggleCollapse() {
		if (railOnly) return;
		isCollapsed = !isCollapsed;
	}

	$effect(() => {
		// Editor keeps a compact rail; everywhere else stay expanded with labels.
		isCollapsed = railOnly;
	});
</script>

<aside
	class="ssp-sidebar"
	class:collapsed={isCollapsed}
	style={`--ease:${softEase}`}
	aria-label="Primary navigation"
>
	<!-- Header: brand + collapse toggle -->
	<div class="ssp-header">
		{#if !isCollapsed}
			<a href="/dashboard" class="ssp-brand" title="Meme Accounts">
				<img
					src="/logo/meme-accounts-logo.webp"
					alt="Meme Accounts"
					class="ssp-brand-logo"
					width="148"
					height="22"
				/>
			</a>
		{/if}
		<!-- <button
			type="button"
			class="ssp-icon-btn"
			onclick={toggleCollapse}
			aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			disabled={railOnly}
		>
			<PanelLeft size={18} />
		</button> -->
	</div>

	<!-- Nav body -->
	<nav class="ssp-body">
		{#each navGroups as group, gi (group.label + gi)}
			{@const isFirstGroup = gi === 0}
			{#if !isFirstGroup && !isCollapsed}
				<div class="ssp-section-label">{group.label}</div>
			{:else if !isFirstGroup && isCollapsed}
				<div class="ssp-section-divider" aria-hidden="true"></div>
			{/if}

			<ul class="ssp-list">
				{#each group.items as item, ii (group.label + ':' + ii)}
					{@const Icon = item.icon}
					{@const active = isActive(item.href)}
					<li>
						<a
							href={item.href}
							class="ssp-item"
							class:active
							title={isCollapsed ? item.label : undefined}
							aria-current={active ? 'page' : undefined}
						>
							<span
								class="ssp-icon-tile"
								class:tile-active={active}
								aria-hidden="true"
							>
								<Icon size={17} class="ssp-tile-icon" />
							</span>
							<span class="ssp-label">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/each}

		{#if !isCollapsed}
			<button type="button" class="ssp-more" disabled>
				<MoreHorizontal size={16} />
				<span>More</span>
			</button>
		{/if}
	</nav>

	<!-- Footer: theme + sign out -->
	<div class="ssp-footer">
		{#if !isCollapsed}
			<a href="/pricing" class="ssp-pricing">Pricing</a>
		{/if}

		<div class="ssp-footer-actions" class:stack={isCollapsed}>
			<button
				type="button"
				class="ssp-signout"
				class:rail={isCollapsed}
				onclick={() => onSignOut?.()}
				aria-label={signedIn ? 'Sign out' : 'Sign in'}
				title={signedIn ? 'Sign out' : 'Sign in'}
			>
				{#if isCollapsed}
					<LogOut size={17} />
				{:else}
					{signedIn ? 'Sign out' : 'Sign in'}
				{/if}
			</button>
		</div>
	</div>
</aside>

<style>
	.ssp-sidebar {
		--ssp-bg: #ffffff;
		--ssp-text: #0f0f10;
		--ssp-text-2: #5b5b62;
		--ssp-text-3: #9a9aa1;
		--ssp-border: rgba(15, 15, 16, 0.08);
		--ssp-border-hover: rgba(15, 15, 16, 0.14);
		--ssp-active-bg: #f6f7f9;
		--ssp-hover-bg: rgba(15, 15, 16, 0.04);
		--ssp-accent: #7bf1a8;

		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 248px;
		height: 100vh;
		padding: 14px 10px 14px;
		background: var(--ssp-bg);
		border-right: 1px solid var(--ssp-border);
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		color: var(--ssp-text);
		transition:
			width 460ms var(--ease),
			padding 460ms var(--ease),
			background 260ms ease,
			border-color 260ms ease;
		overflow: hidden;
		flex-shrink: 0;
	}
	.ssp-sidebar.collapsed {
		width: 64px;
		padding: 14px 10px;
	}

	:global(:root[data-theme='dark']) .ssp-sidebar {
		--ssp-bg: #0a0a0a;
		--ssp-text: #f5f5f5;
		--ssp-text-2: rgba(245, 245, 245, 0.66);
		--ssp-text-3: rgba(245, 245, 245, 0.42);
		--ssp-border: rgba(255, 255, 255, 0.07);
		--ssp-border-hover: rgba(255, 255, 255, 0.14);
		--ssp-active-bg: rgba(255, 255, 255, 0.06);
		--ssp-hover-bg: rgba(255, 255, 255, 0.04);
	}

	/* ── Header ─────────────────────────────────────────────── */
	.ssp-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 4px 10px;
		min-height: 38px;
	}
	.ssp-brand {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		text-decoration: none;
		line-height: 0;
	}
	.ssp-brand-logo {
		display: block;
		height: 22px;
		width: auto;
		max-width: 100%;
		object-fit: contain;
		object-position: left center;
	}
	:global(:root[data-theme='dark']) .ssp-brand-logo {
		filter: invert(1);
	}
	.ssp-sidebar.collapsed .ssp-header {
		justify-content: center;
		padding-left: 0;
		padding-right: 0;
	}

	/* ── Body / nav ─────────────────────────────────────────── */
	.ssp-body {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 2px 0;
		scrollbar-width: thin;
	}
	.ssp-body::-webkit-scrollbar { width: 4px; }
	.ssp-body::-webkit-scrollbar-thumb {
		background: var(--ssp-border);
		border-radius: 99px;
	}

	.ssp-section-label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--ssp-text-3);
		padding: 14px 10px 6px;
		opacity: 1;
		transition: opacity 260ms ease;
	}
	.ssp-sidebar.collapsed .ssp-section-label {
		opacity: 0;
		pointer-events: none;
		height: 0;
		padding: 0;
	}
	.ssp-section-divider {
		margin: 8px 12px;
		height: 1px;
		background: var(--ssp-border);
	}

	.ssp-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ssp-sidebar.collapsed .ssp-list {
		align-items: center;
	}

	.ssp-item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 38px;
		padding: 0 8px;
		border-radius: 10px;
		width: 100%;
		text-decoration: none;
		color: var(--ssp-text);
		font-size: 13.5px;
		font-weight: 500;
		letter-spacing: -0.005em;
		white-space: nowrap;
		transition:
			background 200ms ease,
			box-shadow 200ms ease,
			transform 200ms var(--ease),
			color 200ms ease;
		position: relative;
	}
	.ssp-item:hover {
		background: var(--ssp-hover-bg);
	}
	.ssp-item.active {
		background: var(--ssp-active-bg);
		box-shadow: none;
		color: var(--ssp-text);
	}
	:global(:root[data-theme='dark']) .ssp-item.active {
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.04),
			0 8px 24px -12px rgba(0, 0, 0, 0.5);
	}

	.ssp-icon-tile {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		background: #0f0f10;
		box-shadow: none;
		transition: transform 220ms var(--ease), background 220ms ease, color 220ms ease;
	}
	.ssp-item.active .ssp-icon-tile,
	.ssp-icon-tile.tile-active {
		background: var(--ssp-accent);
		color: #0f0f10;
	}
	.ssp-item:hover .ssp-icon-tile {
		transform: scale(1.04);
	}
	.ssp-item:active .ssp-icon-tile {
		transform: scale(0.96);
	}
	.ssp-tile-icon { color: inherit; }

	.ssp-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 1;
		transition: opacity 260ms ease;
	}
	.ssp-sidebar.collapsed .ssp-label {
		opacity: 0;
		pointer-events: none;
	}
	.ssp-sidebar.collapsed .ssp-item {
		padding: 0;
		justify-content: center;
		gap: 0;
		width: 44px;
	}

	.ssp-more {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 34px;
		padding: 0 10px;
		margin-top: 6px;
		border: none;
		background: transparent;
		color: var(--ssp-text-3);
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		text-align: left;
		border-radius: 10px;
		cursor: not-allowed;
	}

	/* ── Icon button (header chevron, theme) ─────────────────── */
	.ssp-icon-btn {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--ssp-text-2);
		cursor: pointer;
		transition: background 200ms ease, color 200ms ease;
	}
	.ssp-icon-btn:hover {
		background: var(--ssp-hover-bg);
		color: var(--ssp-text);
	}
	.ssp-icon-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Footer ─────────────────────────────────────────────── */
	.ssp-footer {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 6px 4px;
		border-top: 1px solid var(--ssp-border);
		margin-top: 4px;
	}
	.ssp-pricing {
		font-size: 13px;
		font-weight: 500;
		color: var(--ssp-text-2);
		text-decoration: none;
		padding: 4px 6px;
		transition: color 200ms ease;
	}
	.ssp-pricing:hover { color: var(--ssp-text); }

	.ssp-footer-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.ssp-footer-actions.stack {
		flex-direction: column;
		gap: 4px;
	}

	.ssp-theme-btn { flex-shrink: 0; }

	.ssp-signout {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 38px;
		padding: 0 16px;
		background: transparent;
		border: 1px solid var(--ssp-border-hover);
		border-radius: 999px;
		color: var(--ssp-text);
		font-family: inherit;
		font-size: 13.5px;
		font-weight: 600;
		letter-spacing: -0.005em;
		cursor: pointer;
		transition:
			border-color 200ms ease,
			background 200ms ease,
			transform 200ms var(--ease),
			box-shadow 200ms ease;
	}
	.ssp-signout:hover {
		background: rgba(15, 15, 16, 0.04);
		border-color: var(--ssp-text);
		transform: translateY(-1px);
		box-shadow: none;
	}
	:global(:root[data-theme='dark']) .ssp-signout:hover {
		box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.6);
	}
	.ssp-signout.rail {
		flex: 0 0 auto;
		width: 38px;
		height: 38px;
		padding: 0;
	}
</style>
