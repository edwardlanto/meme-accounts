<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ImagePlus, Plus, Trash2, Edit2, Clock, CheckCircle, FileText, Loader } from 'lucide-svelte';

	let carousels: any[] = $state([]);
	let loading = $state(true);
	let creating = $state(false);
	let createError = $state('');
	let userId = $state('');

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;

		const { data } = await supabase.from('carousels').select('*').order('updated_at', { ascending: false });
		carousels = data ?? [];
		loading = false;
	});

	async function createNew() {
		creating = true;
		createError = '';
		const { data, error } = await supabase.from('carousels').insert({
			user_id: userId,
			title: 'Untitled carousel',
			status: 'draft',
			slides: JSON.stringify([
				{ id: '1', text: 'Your hook here', type: 'hook', bg: '#0f172a', textColor: '#ffffff', align: 'center', bold: true, fontSize: 32 },
				{ id: '2', text: 'Key insight or point', type: 'body', bg: '#111111', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 28 },
				{ id: '3', text: 'Another key point', type: 'body', bg: '#111111', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 28 },
				{ id: '4', text: 'Follow for more!', type: 'cta', bg: '#0a0a0a', textColor: '#8B5CF6', align: 'center', bold: true, fontSize: 30 },
			]),
		}).select().single();
		creating = false;
		if (error) { createError = error.message; return; }
		if (data) goto(`/dashboard/editor/${data.id}`);
	}

	async function deleteCarousel(id: string) {
		if (!confirm('Delete this carousel?')) return;
		await supabase.from('carousels').delete().eq('id', id);
		carousels = carousels.filter(c => c.id !== id);
	}

	const statusIcon: Record<string, any> = { draft: FileText, published: CheckCircle, scheduled: Clock };
	const statusColor: Record<string, string> = {
		draft: 'text-white/30',
		published: 'text-cyan-400',
		scheduled: 'text-violet-400',
	};
</script>

<div class="p-8 max-w-5xl">
	<div class="flex items-start justify-between mb-8">
		<div>
			<h1 class="font-display font-bold text-2xl text-white mb-1">Carousels</h1>
			<p class="font-body text-sm text-white/40">Your carousel library — drafts, published, and scheduled</p>
		</div>
		<button onclick={createNew} disabled={creating}
			class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
			{#if creating}<Loader size={13} class="animate-spin" />{:else}<Plus size={14} />{/if}
			New carousel
		</button>
	</div>

	{#if createError}
		<div class="mb-6 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-body text-red-400">
			<span>⚠ {createError}</span>
			{#if createError.includes('schema cache') || createError.includes('users')}
				<span class="text-red-300/60">— Run <code class="font-mono bg-red-500/10 px-1 rounded">supabase-migration-001.sql</code> in your Supabase SQL editor.</span>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-3 gap-4">
			{#each Array(6) as _}
				<div class="aspect-[4/5] rounded-2xl bg-white/[0.03] animate-pulse"></div>
			{/each}
		</div>
	{:else if carousels.length === 0}
		<div class="flex flex-col items-center justify-center py-28 text-center">
			<div class="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-6">
				<ImagePlus size={24} class="text-violet-400" />
			</div>
			<h3 class="font-display font-semibold text-base text-white mb-2">No carousels yet</h3>
			<p class="font-body text-sm text-white/35 max-w-sm mb-6">Create your first carousel from scratch or head to Discover to remix a viral post.</p>
			<button onclick={createNew}
				class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]">
				<Plus size={14} /> Create first carousel
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
			{#each carousels as c}
				{@const slides = (() => { try { return JSON.parse(typeof c.slides === 'string' ? c.slides : JSON.stringify(c.slides)); } catch { return []; } })()}
				{@const firstSlide = slides[0]}
				<div class="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-violet-500/25 transition-all cursor-pointer"
					style="background: {firstSlide?.bg ?? '#111111'}">
					<!-- Preview -->
					<a href="/dashboard/editor/{c.id}" class="block aspect-[4/5] flex items-center justify-center p-6">
						<p class="font-display font-bold text-center leading-tight"
							style="color: {firstSlide?.textColor ?? '#ffffff'}; font-size: clamp(12px, 2.5vw, 18px)">
							{firstSlide?.text || 'Untitled'}
						</p>
					</a>

					<!-- Slide count badge -->
					<div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] font-mono text-white/50">
						{slides.length} slides
					</div>

					<!-- Bottom bar -->
					<div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-display font-semibold text-white truncate">{c.title}</p>
							<div class="flex items-center gap-1 mt-0.5">
								<svelte:component this={statusIcon[c.status] ?? FileText} size={9} class={statusColor[c.status] ?? 'text-white/30'} />
								<p class="text-[10px] font-mono {statusColor[c.status] ?? 'text-white/30'} capitalize">{c.status}</p>
							</div>
						</div>
						<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<a href="/dashboard/editor/{c.id}"
								class="p-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 transition-colors">
								<Edit2 size={11} />
							</a>
							<button onclick={() => deleteCarousel(c.id)}
								class="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
								<Trash2 size={11} />
							</button>
						</div>
					</div>
				</div>
			{/each}

			<!-- New card -->
			<button onclick={createNew} disabled={creating}
				class="aspect-[4/5] rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/40 flex flex-col items-center justify-center gap-2 transition-all text-white/20 hover:text-violet-400 group">
				<div class="w-10 h-10 rounded-xl border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
					<Plus size={18} />
				</div>
				<span class="text-xs font-mono">New carousel</span>
			</button>
		</div>
	{/if}
</div>
