<script lang="ts">
	import { Search, Settings, User, ChevronDown, Sun, Moon, LogOut, Layers } from 'lucide-svelte';

	type NavGroupItem = { href: string; label: string; icon: any };
	type NavGroup = { label: string; items: NavGroupItem[] };
	type NavGroupId = 'create' | 'studios' | 'brand' | 'grow';

	type Props = {
		navGroups: NavGroup[];
		currentPath?: string;
		theme?: 'light' | 'dark';
		onThemeToggle?: () => void;
		onSignOut?: () => void;
	};

	let {
		navGroups,
		currentPath = '',
		theme = 'light',
		onThemeToggle,
		onSignOut,
	}: Props = $props();

	let activeGroup = $state<NavGroupId>('create');
	let isCollapsed = $state(false);
	let searchValue = $state('');
	let expandedItems = $state(new Set<string>());

	const softSpringEasing = 'cubic-bezier(0.25, 1.1, 0.4, 1)';

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
		if (isCollapsed) expandedItems = new Set();
	}

	function toggleExpanded(key: string) {
		const next = new Set(expandedItems);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedItems = next;
	}

	const groupByLabel: Record<string, NavGroupId> = {
		Create: 'create',
		Studios: 'studios',
		Brand: 'brand',
		Grow: 'grow',
	};

	const groups = $derived.by(() => {
		// Keep original order, normalize ids from labels
		return (navGroups ?? [])
			.map((g) => ({ ...g, id: groupByLabel[g.label] ?? (g.label.toLowerCase() as NavGroupId) }))
			.filter((g) => ['create', 'studios', 'brand', 'grow'].includes(g.id));
	});

	const activeNavGroup = $derived.by(() => groups.find((g) => g.id === activeGroup) ?? groups[0]);

	const activeGroupTitle = $derived(activeNavGroup?.label ?? 'Create');

	const railItems = $derived.by(() => {
		// pick representative icon per group (use first item icon, fallback Layers)
		return groups.map((g) => ({
			id: g.id,
			label: g.label,
			icon: g.items?.[0]?.icon ?? Layers,
		}));
	});
</script>

<div class="flex h-screen">
	<!-- Left icon rail -->
	<aside class="bg-black flex flex-col gap-2 items-center p-4 w-16  border-neutral-800 h-screen">
		<div class="mb-2 size-10 flex items-center justify-center">
			<div class="size-7 rounded-md border border-neutral-800 bg-neutral-950 flex items-center justify-center">
				<span class="font-mono text-[10px] font-extrabold tracking-widest text-neutral-200">CS</span>
			</div>
		</div>

		<div class="flex flex-col gap-2 w-full items-center">
			{#each railItems as item (item.id)}
				{@const Icon = item.icon}
				<button
					type="button"
					class={`flex items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500 ${
						activeGroup === item.id
							? 'bg-neutral-800 text-neutral-50'
							: 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300'
					}`}
					style={`transition-timing-function:${softSpringEasing}`}
					onclick={() => (activeGroup = item.id)}
					aria-label={item.label}
					title={item.label}
				>
					<Icon size={16} />
				</button>
			{/each}
		</div>

		<div class="flex-1"></div>

		<button
			type="button"
			class={`flex items-center justify-center rounded-lg size-10 min-w-10 transition-colors duration-500 ${
				false
					? 'bg-neutral-800 text-neutral-50'
					: 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300'
			}`}
			style={`transition-timing-function:${softSpringEasing}`}
			onclick={() => (window.location.href = '/dashboard/settings')}
			aria-label="Settings"
			title="Settings"
		>
			<Settings size={16} />
		</button>

		<div class="size-10 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
			<User size={16} class="text-neutral-100" />
		</div>
	</aside>

	<!-- Right detail panel -->
	<aside
		class={`bg-black flex flex-col gap-4 items-start transition-all duration-500 h-screen ${
			isCollapsed ? 'w-16 min-w-16 px-0 justify-center' : 'w-80 p-4'
		}`}
		style={`transition-timing-function:${softSpringEasing}`}
	>
		{#if !isCollapsed}
			<div class="w-full">
				<div class="flex items-center p-1 w-full">
					<div class="h-10 w-8 flex items-center justify-center pl-2">
						<div class="size-6 rounded-md border border-neutral-800 bg-neutral-950 flex items-center justify-center">
							<span class="text-[10px] font-mono font-extrabold text-neutral-100">◎</span>
						</div>
					</div>
					<div class="px-2 py-1">
						<div class="font-semibold text-[16px] text-neutral-50">Interfaces</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Title row / collapse toggle -->
		{#if isCollapsed}
			<div class="w-full flex justify-center transition-all duration-500" style={`transition-timing-function:${softSpringEasing}`}>
				<button
					type="button"
					onclick={toggleCollapse}
					class="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
					style={`transition-timing-function:${softSpringEasing}`}
					aria-label="Expand sidebar"
				>
					<span class="inline-block rotate-180"><ChevronDown size={16} /></span>
				</button>
			</div>
		{:else}
			<div class="w-full overflow-hidden transition-all duration-500" style={`transition-timing-function:${softSpringEasing}`}>
				<div class="flex items-center justify-between">
					<div class="flex items-center h-10 px-2">
						<div class="font-semibold text-[18px] text-neutral-50 leading-[27px]">{activeGroupTitle}</div>
					</div>
					<div class="pr-1">
						<button
							type="button"
							onclick={toggleCollapse}
							class="flex items-center justify-center rounded-lg size-10 min-w-10 transition-all duration-500 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-300"
							style={`transition-timing-function:${softSpringEasing}`}
							aria-label="Collapse sidebar"
						>
							<ChevronDown size={16} class="-rotate-90" />
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Search -->
		<div
			class={`relative shrink-0 transition-all duration-500 ${isCollapsed ? 'w-full flex justify-center' : 'w-full'}`}
			style={`transition-timing-function:${softSpringEasing}`}
		>
			<div
				class={`bg-neutral-950 h-10 relative rounded-lg flex items-center transition-all duration-500 ${
					isCollapsed ? 'w-10 min-w-10 justify-center' : 'w-full'
				}`}
				style={`transition-timing-function:${softSpringEasing}`}
			>
				<div class={`flex items-center justify-center shrink-0 transition-all duration-500 ${isCollapsed ? 'p-1' : 'px-1'}`} style={`transition-timing-function:${softSpringEasing}`}>
					<div class="size-8 flex items-center justify-center">
						<Search size={16} class="text-neutral-50" />
					</div>
				</div>

				<div
					class={`flex-1 relative transition-opacity duration-500 overflow-hidden ${
						isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
					}`}
					style={`transition-timing-function:${softSpringEasing}`}
				>
					<div class="flex flex-col justify-center size-full">
						<div class="flex flex-col gap-2 items-start justify-center pr-2 py-1 w-full">
							<input
								type="text"
								placeholder="Search..."
								bind:value={searchValue}
								class="w-full bg-transparent border-none outline-none text-[14px] text-neutral-50 placeholder:text-neutral-400 leading-[20px]"
								tabindex={isCollapsed ? -1 : 0}
							/>
						</div>
					</div>
				</div>

				<div aria-hidden="true" class="absolute inset-0 rounded-lg border border-neutral-800 pointer-events-none"></div>
			</div>
		</div>

		<!-- Sections -->
		<div
			class={`flex flex-col w-full overflow-y-auto transition-all duration-500 ${
				isCollapsed ? 'gap-2 items-center' : 'gap-4 items-start'
			}`}
			style={`transition-timing-function:${softSpringEasing}`}
		>
			{#each groups as group (group.id)}
				{#if group.id === activeGroup}
					<div class="flex flex-col w-full">
						<div
							class={`relative shrink-0 w-full transition-all duration-500 overflow-hidden ${
								isCollapsed ? 'h-0 opacity-0' : 'h-10 opacity-100'
							}`}
							style={`transition-timing-function:${softSpringEasing}`}
						>
							<div class="flex items-center h-10 px-4">
								<div class="text-[14px] text-neutral-400">{group.label}</div>
							</div>
						</div>

						{#each group.items as item, i (group.label + ':' + i)}
							{@const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
							{@const Icon = item.icon}
							<a
								href={item.href}
								class={`rounded-lg cursor-pointer transition-all duration-500 flex items-center relative ${
									isActive ? 'bg-neutral-800' : 'hover:bg-neutral-800'
								} ${isCollapsed ? 'w-10 min-w-10 h-10 justify-center p-4' : 'w-full h-10 px-4 py-2'}`}
								style={`transition-timing-function:${softSpringEasing}`}
								title={isCollapsed ? item.label : undefined}
							>
								<div class="flex items-center justify-center shrink-0">{#if Icon}<Icon size={16} class="text-neutral-50" />{/if}</div>
								<div class={`flex-1 relative transition-opacity duration-500 overflow-hidden ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 ml-3'}`} style={`transition-timing-function:${softSpringEasing}`}>
									<div class="text-[14px] text-neutral-50 leading-[20px] truncate">{item.label}</div>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{/each}
		</div>

		<!-- Bottom user row + actions -->
		{#if !isCollapsed}
			<div class="w-full mt-auto pt-2 border-t border-neutral-800">
				<div class="flex items-center gap-2 px-2 py-2">
					<div class="relative rounded-full shrink-0 size-8 bg-neutral-950 border border-neutral-800 flex items-center justify-center">
						<User size={16} class="text-neutral-50" />
					</div>
					<div class="text-[14px] text-neutral-50">Account</div>
					<div class="ml-auto flex items-center gap-1">
						<button
							type="button"
							class="size-8 rounded-md flex items-center justify-center hover:bg-neutral-800 text-neutral-300"
							aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
							title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
							onclick={() => onThemeToggle?.()}
						>
							{#if theme === 'dark'}<Sun size={16} />{:else}<Moon size={16} />{/if}
						</button>
						<button
							type="button"
							class="size-8 rounded-md flex items-center justify-center hover:bg-neutral-800 text-neutral-300"
							aria-label="Sign out"
							title="Sign out"
							onclick={() => onSignOut?.()}
						>
							<LogOut size={16} />
						</button>
					</div>
				</div>
			</div>
		{/if}
	</aside>
</div>

