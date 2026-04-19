<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ChevronLeft, Loader, Sparkles, FileText, Zap, Heart, BookOpen, ArrowRight } from 'lucide-svelte';

	let userId = $state('');
	let title = $state('');
	let selectedTemplate = $state('blank');
	let creating = $state(false);
	let error = $state('');

	const templates = [
		{
			id: 'blank',
			label: 'Blank',
			description: 'Start from scratch with 4 empty slides',
			icon: FileText,
			color: 'white/20',
			slides: [
				{ id: '1', text: 'Your hook here', type: 'hook', bg: '#0f172a', textColor: '#ffffff', align: 'center', bold: true, fontSize: 32 },
				{ id: '2', text: 'Key insight or point', type: 'body', bg: '#111111', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 28 },
				{ id: '3', text: 'Another key point', type: 'body', bg: '#111111', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 28 },
				{ id: '4', text: 'Follow for more!', type: 'cta', bg: '#0a0a0a', textColor: '#8B5CF6', align: 'center', bold: true, fontSize: 30 },
			],
		},
		{
			id: 'viral-tips',
			label: '5 Tips',
			description: 'Hook + 5 actionable tips + CTA',
			icon: Zap,
			color: 'cyan',
			slides: [
				{ id: '1', text: '5 habits that will change your life', type: 'hook', bg: '#0c4a6e', textColor: '#ffffff', align: 'center', bold: true, fontSize: 32 },
				{ id: '2', text: '1. Wake up at 5am', type: 'body', bg: '#0f172a', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'Start your day before the noise begins.' },
				{ id: '3', text: '2. Move your body daily', type: 'body', bg: '#0f172a', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'Even 10 minutes makes a difference.' },
				{ id: '4', text: '3. Read for 30 minutes', type: 'body', bg: '#0f172a', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'Knowledge compounds over time.' },
				{ id: '5', text: '4. Limit your screen time', type: 'body', bg: '#0f172a', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'Protect your attention at all costs.' },
				{ id: '6', text: '5. Reflect every night', type: 'body', bg: '#0f172a', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'Journal 3 wins from the day.' },
				{ id: '7', text: 'Which habit will you start today?', type: 'cta', bg: '#0c4a6e', textColor: '#06B6D4', align: 'center', bold: true, fontSize: 26 },
			],
		},
		{
			id: 'storytelling',
			label: 'Story Arc',
			description: 'Problem → journey → transformation',
			icon: BookOpen,
			color: 'violet',
			slides: [
				{ id: '1', text: 'I was broke, burned out, and ready to quit.', type: 'hook', bg: '#1a0a2e', textColor: '#ffffff', align: 'center', bold: true, fontSize: 28 },
				{ id: '2', text: 'The problem', type: 'body', bg: '#0f0f0f', textColor: '#f8f8f8', align: 'center', bold: true, fontSize: 32, subtext: 'I worked 70-hour weeks and had nothing to show for it.' },
				{ id: '3', text: 'The turning point', type: 'body', bg: '#0f0f0f', textColor: '#a78bfa', align: 'center', bold: true, fontSize: 32, subtext: 'One conversation changed everything.' },
				{ id: '4', text: 'What I learned', type: 'body', bg: '#0f0f0f', textColor: '#f8f8f8', align: 'center', bold: true, fontSize: 32, subtext: 'Effort without strategy is just exhaustion.' },
				{ id: '5', text: 'The result', type: 'body', bg: '#1a0a2e', textColor: '#8B5CF6', align: 'center', bold: true, fontSize: 30, subtext: 'Now I work 4 hours a day and earn 3x more.' },
				{ id: '6', text: 'Save this if it resonates.', type: 'cta', bg: '#0a0a0a', textColor: '#a78bfa', align: 'center', bold: true, fontSize: 28 },
			],
		},
		{
			id: 'hot-take',
			label: 'Hot Take',
			description: 'Bold opinion + arguments + open question',
			icon: Heart,
			color: 'red',
			slides: [
				{ id: '1', text: 'Hustle culture is destroying your potential.', type: 'hook', bg: '#1a0a0a', textColor: '#f43f5e', align: 'center', bold: true, fontSize: 28 },
				{ id: '2', text: 'Here\'s why I said that:', type: 'body', bg: '#0f0f0f', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 30 },
				{ id: '3', text: 'Burnout kills creativity', type: 'body', bg: '#0f0f0f', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'You can\'t create your best work when you\'re running on empty.' },
				{ id: '4', text: 'Rest is not laziness', type: 'body', bg: '#0f0f0f', textColor: '#f8f8f8', align: 'left', bold: false, fontSize: 28, subtext: 'The best ideas come when you stop forcing them.' },
				{ id: '5', text: 'Agree or disagree?', type: 'cta', bg: '#1a0a0a', textColor: '#f43f5e', align: 'center', bold: true, fontSize: 32, subtext: 'Drop your take in the comments.' },
			],
		},
	];

	const colorMap: Record<string, string> = {
		'white/20': 'border-white/20 bg-white/[0.04]',
		cyan: 'border-cyan-500/30 bg-cyan-500/[0.06]',
		violet: 'border-violet-500/30 bg-violet-500/[0.06]',
		red: 'border-red-500/30 bg-red-500/[0.06]',
	};
	const iconColorMap: Record<string, string> = {
		'white/20': 'text-white/40',
		cyan: 'text-cyan-400',
		violet: 'text-violet-400',
		red: 'text-red-400',
	};

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
	});

	async function create() {
		if (!title.trim()) { error = 'Please give your carousel a title.'; return; }
		creating = true;
		error = '';
		const template = templates.find(t => t.id === selectedTemplate)!;
		const { data, error: err } = await supabase.from('carousels').insert({
			user_id: userId,
			title: title.trim(),
			status: 'draft',
			slides: JSON.stringify(template.slides),
		}).select().single();
		if (err) { error = err.message; creating = false; return; }
		goto(`/dashboard/editor/${data.id}`);
	}
</script>

<div class="p-8 max-w-2xl">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-8">
		<a href="/dashboard/carousels" class="flex items-center gap-1 text-sm font-body text-white/40 hover:text-white transition-colors">
			<ChevronLeft size={15} /> Back
		</a>
		<span class="text-white/20">/</span>
		<span class="text-sm font-body text-white/60">New carousel</span>
	</div>

	<h1 class="font-display font-bold text-2xl text-white mb-1">Create a carousel</h1>
	<p class="font-body text-sm text-white/40 mb-8">Pick a template to get started, then customise it in the editor.</p>

	<!-- Title input -->
	<div class="mb-8">
		<label class="text-xs font-mono text-white/40 uppercase tracking-wider block mb-2">Carousel title</label>
		<input
			type="text"
			bind:value={title}
			placeholder="e.g. 5 habits that changed my life"
			class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
		/>
	</div>

	<!-- Template picker -->
	<div class="mb-8">
		<label class="text-xs font-mono text-white/40 uppercase tracking-wider block mb-3">Choose a template</label>
		<div class="grid grid-cols-2 gap-3">
			{#each templates as t}
				{@const isSelected = selectedTemplate === t.id}
				<button
					onclick={() => selectedTemplate = t.id}
					class="relative p-4 rounded-2xl border text-left transition-all {isSelected
						? 'border-violet-500/60 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
						: `${colorMap[t.color]} hover:border-white/20`}">
					<div class="flex items-center gap-2 mb-2">
						<svelte:component this={t.icon} size={15} class={isSelected ? 'text-violet-400' : iconColorMap[t.color]} />
						<span class="font-display font-semibold text-sm {isSelected ? 'text-white' : 'text-white/70'}">{t.label}</span>
						{#if isSelected}
							<span class="ml-auto w-2 h-2 rounded-full bg-violet-400"></span>
						{/if}
					</div>
					<p class="font-body text-xs {isSelected ? 'text-white/50' : 'text-white/30'} leading-relaxed">{t.description}</p>
					<div class="mt-3 flex items-center gap-1">
						{#each { length: templates.find(x => x.id === t.id)!.slides.length } as _, i}
							<div class="flex-1 h-1 rounded-full {isSelected ? 'bg-violet-500/40' : 'bg-white/[0.08]'}"></div>
						{/each}
					</div>
					<p class="text-[10px] font-mono {isSelected ? 'text-violet-400/70' : 'text-white/20'} mt-1">
						{templates.find(x => x.id === t.id)!.slides.length} slides
					</p>
				</button>
			{/each}
		</div>
	</div>

	<!-- Error -->
	{#if error}
		<div class="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-body text-red-400">
			{error}
		</div>
	{/if}

	<!-- Create button -->
	<button
		onclick={create}
		disabled={creating}
		class="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold font-body text-sm text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
		{#if creating}
			<Loader size={14} class="animate-spin" /> Creating...
		{:else}
			<Sparkles size={14} /> Create carousel
			<ArrowRight size={14} />
		{/if}
	</button>
</div>
