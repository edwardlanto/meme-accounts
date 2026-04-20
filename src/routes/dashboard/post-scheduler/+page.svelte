<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { ArrowLeft, Calendar, Plus, X } from 'lucide-svelte';

	type ChannelId = 'x' | 'linkedin' | 'linkedinPage' | 'reddit' | 'instagramBusiness' | 'instagram' | 'facebookPage' | 'threads' | 'youtube' | 'gmb' | 'tiktok' | 'pinterest';
	type Channel = { id: ChannelId; label: string; accent: string; kind?: 'business' | 'page' | 'standalone'; icon: (active: boolean) => string };
	type IgContentType = 'post' | 'reel' | 'carousel' | 'story';
	type Draft = { id: string; title: string; channels: ChannelId[]; igType: IgContentType };
	type ScheduledPost = { id: string; title: string; channels: ChannelId[]; igType: IgContentType; startISO: string; durationMin: number };

	function igTypeLabel(t: IgContentType) {
		if (t === 'post') return 'Post';
		if (t === 'reel') return 'Reel';
		if (t === 'carousel') return 'Carousel';
		return 'Story';
	}
	function igTypePillClass(t: IgContentType) {
		if (t === 'reel') return 'bg-red-500/10 border-red-500/20 text-red-200/70';
		if (t === 'carousel') return 'bg-violet-500/10 border-violet-500/20 text-violet-200/70';
		if (t === 'story') return 'bg-amber-500/10 border-amber-500/20 text-amber-200/70';
		return 'bg-sky-500/10 border-sky-500/20 text-sky-200/70';
	}

	const CHANNELS: Channel[] = [
		{
			id: 'x', label: 'X', accent: 'bg-white/70',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18.2 2H21L14.7 9.2L22.1 22H16.1L11.4 14.7L5.1 22H2.3L9.1 14.2L2 2H8.2L12.4 8.5L18.2 2Z" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}"/>
</svg>`,
		},
		{
			id: 'linkedin', label: 'LinkedIn', accent: 'bg-blue-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#3b82f6' : 'rgba(59,130,246,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
  <rect x="2" y="9" width="4" height="12"/>
  <circle cx="4" cy="4" r="2"/>
</svg>`,
		},
		{
			id: 'linkedinPage', label: 'LinkedIn Page', kind: 'page', accent: 'bg-blue-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#3b82f6' : 'rgba(59,130,246,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 4h16v16H4z" opacity="0.25"/>
  <path d="M7 10h3v9H7zM8.5 6.5A1.5 1.5 0 1 0 8.5 9.5A1.5 1.5 0 0 0 8.5 6.5Z"/>
  <path d="M13 10h-3v9h3v-4.8c0-1.2.7-2.2 1.9-2.2 1.2 0 1.6.8 1.6 2.3V19h3v-5.7c0-2.7-1.3-3.8-3.3-3.8-1.3 0-2.2.7-2.2.7z"/>
</svg>`,
		},
		{
			id: 'reddit', label: 'Reddit', accent: 'bg-orange-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20.8 12.1c0-1-.8-1.8-1.8-1.8-.5 0-1 .2-1.3.6-1.3-.9-3.1-1.5-5-1.6l.9-4.1 2.9.7c0 1 .8 1.7 1.8 1.7 1 0 1.8-.8 1.8-1.8S19.3 3 18.3 3c-.7 0-1.4.4-1.7 1.1L12.7 3.2c-.3-.1-.7.1-.7.5l-1.2 5.5c-2 .1-3.9.7-5.3 1.6-.3-.3-.8-.5-1.3-.5-1 0-1.8.8-1.8 1.8 0 .7.4 1.4 1.1 1.7-.1.4-.1.8-.1 1.2 0 3.1 3.9 5.6 8.7 5.6s8.7-2.5 8.7-5.6c0-.4 0-.8-.1-1.1.6-.3 1.1-1 1.1-1.7z" fill="${active ? '#fb923c' : 'rgba(251,146,60,0.55)'}"/>
  <circle cx="9" cy="14" r="1.2" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}"/>
  <circle cx="15" cy="14" r="1.2" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}"/>
  <path d="M9 17.2c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2" stroke="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}" stroke-width="1.4" stroke-linecap="round"/>
</svg>`,
		},
		{
			id: 'instagramBusiness', label: 'Instagram (Business)', kind: 'business', accent: 'bg-pink-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ig" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop stop-color="${active ? '#ec4899' : 'rgba(236,72,153,0.55)'}"/>
      <stop offset="1" stop-color="${active ? '#a855f7' : 'rgba(168,85,247,0.55)'}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="18" height="18" rx="5" stroke="url(#ig)" stroke-width="2"/>
  <circle cx="12" cy="12" r="4" stroke="url(#ig)" stroke-width="2"/>
  <circle cx="17.5" cy="6.5" r="1" fill="url(#ig)"/>
</svg>`,
		},
		{
			id: 'instagram', label: 'Instagram', kind: 'standalone', accent: 'bg-pink-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ig2" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop stop-color="${active ? '#ec4899' : 'rgba(236,72,153,0.55)'}"/>
      <stop offset="1" stop-color="${active ? '#a855f7' : 'rgba(168,85,247,0.55)'}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="18" height="18" rx="5" stroke="url(#ig2)" stroke-width="2"/>
  <circle cx="12" cy="12" r="4" stroke="url(#ig2)" stroke-width="2"/>
  <circle cx="17.5" cy="6.5" r="1" fill="url(#ig2)"/>
</svg>`,
		},
		{
			id: 'facebookPage', label: 'Facebook Page', kind: 'page', accent: 'bg-blue-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#60a5fa' : 'rgba(96,165,250,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.3 1.3-3.6 3.4-3.6 1 0 2 .2 2 .2v2.3H15c-1.1 0-1.5.7-1.5 1.4v1.7h2.6L15.7 15h-2.2v7A10 10 0 0 0 22 12z"/>
</svg>`,
		},
		{
			id: 'threads', label: 'Threads', accent: 'bg-white/60',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2.5c3.9 0 6.8 2.5 7.3 6.2.3 2.4-.7 4.8-2.6 6.2.2 2.3-1.2 4.9-4.2 6.2-4.8 2.1-9.6-1.5-9.6-7.6C2.9 6.9 6.8 2.5 12 2.5Zm3.8 9.7c-.7-2.7-3.6-3.7-6-3.2-2.2.4-3.8 2.1-3.7 4.4.1 2.5 2.1 4 4.5 3.7 1.7-.2 3-1.3 3.4-2.9-.8.2-1.7.2-2.6 0-.6-.1-1-.6-.9-1.2.1-.6.6-1 1.2-.9 1.1.2 2.2.1 3.1-.3Z"/>
</svg>`,
		},
		{
			id: 'youtube', label: 'YouTube', accent: 'bg-red-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M21.6 7.3c-.2-1-1-1.8-2-2C17.9 5 12 5 12 5s-5.9 0-7.6.3c-1 .2-1.8 1-2 2C2 9 2 12 2 12s0 3 .4 4.7c.2 1 1 1.8 2 2C6.1 19 12 19 12 19s5.9 0 7.6-.3c1-.2 1.8-1 2-2 .4-1.7.4-4.7.4-4.7s0-3-.4-4.7Z" fill="${active ? '#ef4444' : 'rgba(239,68,68,0.55)'}"/>
  <path d="M10.3 9.5v5l4.7-2.5-4.7-2.5Z" fill="${active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'}"/>
</svg>`,
		},
		{
			id: 'tiktok', label: 'TikTok', accent: 'bg-white/60',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 3c.6 3.4 2.6 5.4 6 6v3.1c-2.2.1-4.1-.6-6-1.9v6.3c0 4-3.3 7.1-7.3 6.5-2.5-.4-4.6-2.4-5-4.9C1.8 14 4.8 10.6 9 10.6c.4 0 .8 0 1.1.1v3.6c-.3-.1-.7-.2-1.1-.2-1.6 0-2.9 1.3-2.9 2.9 0 1.7 1.5 3.1 3.3 2.9 1.3-.2 2.3-1.4 2.3-2.7V3h3.2Z"/>
</svg>`,
		},
		{
			id: 'pinterest', label: 'Pinterest', accent: 'bg-red-400',
			icon: (active) => `
<svg width="24" height="24" viewBox="0 0 24 24" fill="${active ? '#ef4444' : 'rgba(239,68,68,0.55)'}" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 5.1 3.2 9.4 7.6 11.2-.1-.9-.2-2.4 0-3.4.2-.9 1.4-6 1.4-6s-.4-.7-.4-1.8c0-1.7 1-2.9 2.2-2.9 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3l-.3 1.4c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.6 0-3.8 2.8-7.3 7.9-7.3 4.2 0 7.4 3 7.4 6.9 0 4.1-2.6 7.5-6.2 7.5-1.2 0-2.4-.6-2.8-1.4L9 20.1c-.3 1-1 2.3-1.5 3.1.9.3 2 .5 3 .5 6.6 0 12-5.4 12-12S18.6 0 12 0z"/>
</svg>`,
		},
		{
			id: 'gmb', label: 'Google My Business', accent: 'bg-emerald-300',
			icon: (active) => `<div style="width:22px;height:22px;border-radius:8px;background:${active ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.2)'};border:1px solid rgba(16,185,129,0.35);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);font-weight:800;font-size:10px;">G</div>`,
		},
	];

	function channelById(id: ChannelId) {
		return CHANNELS.find((c) => c.id === id);
	}

	// ── Channels UI ───────────────────────────────────────────────────────────
	let connected = $state<ChannelId[]>(['instagramBusiness', 'linkedin', 'pinterest', 'youtube']);
	let showAddChannel = $state(false);
	let userId = $state('');

	onMount(async () => {
		const { data } = await supabase.auth.getUser();
		userId = data.user?.id ?? '';
	});

	async function connectInstagramBusiness() {
		// Credential check endpoint tells us if env is missing
		try {
			const res = await fetch('/api/integrations/meta/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Instagram connect needs credentials: ${st.missing.join(', ')}.\n\nGo to Settings → Integrations to add them.`);
				goto('/dashboard/settings?integrations=1#instagram');
				return;
			}
		} catch {
			alert('Could not verify Meta credentials. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#instagram');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting Instagram.');
			goto('/login');
			return;
		}

		window.location.href = `/api/auth/meta/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectFacebookPages() {
		// Uses the same Meta OAuth; callback now saves Facebook Page connections too.
		try {
			const res = await fetch('/api/integrations/meta/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Facebook connect needs credentials: ${st.missing.join(', ')}.\n\nGo to Settings → Integrations to add them.`);
				goto('/dashboard/settings?integrations=1#instagram');
				return;
			}
		} catch {
			alert('Could not verify Meta credentials. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#instagram');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting Facebook.');
			goto('/login');
			return;
		}

		window.location.href = `/api/auth/meta/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectLinkedIn(mode: 'member' | 'org' | 'both') {
		try {
			const res = await fetch('/api/integrations/linkedin/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`LinkedIn connect needs credentials: ${st.missing.join(', ')}.\n\nGo to Settings → Integrations to add them.`);
				goto('/dashboard/settings?integrations=1#linkedin');
				return;
			}
		} catch {
			alert('Could not verify LinkedIn credentials. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#linkedin');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting LinkedIn.');
			goto('/login');
			return;
		}

		window.location.href =
			`/api/auth/linkedin/start?userId=${encodeURIComponent(userId)}` +
			`&mode=${encodeURIComponent(mode)}` +
			`&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	async function connectGmb() {
		try {
			const res = await fetch('/api/integrations/gmb/status');
			const st = (await res.json()) as { ok: boolean; missing: string[] };
			if (!st.ok) {
				alert(`Google My Business connect needs credentials: ${st.missing.join(', ')}.\n\nGo to Settings → Integrations to add them.`);
				goto('/dashboard/settings?integrations=1#gmb');
				return;
			}
		} catch {
			alert('Could not verify Google My Business credentials. Open Settings → Integrations.');
			goto('/dashboard/settings?integrations=1#gmb');
			return;
		}

		if (!userId) {
			alert('Please sign in before connecting Google My Business.');
			goto('/login');
			return;
		}

		window.location.href = `/api/auth/gmb/start?userId=${encodeURIComponent(userId)}&next=${encodeURIComponent('/dashboard/post-scheduler')}`;
	}

	function toggleConnected(id: ChannelId) {
		connected = connected.includes(id) ? connected.filter((x) => x !== id) : [...connected, id];
	}

	// ── Calendar data ─────────────────────────────────────────────────────────
	function pad2(n: number) { return String(n).padStart(2, '0'); }
	function localIso(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`; }
	function startOfWeek(d: Date) {
		const x = new Date(d);
		const day = x.getDay();
		const diff = (day === 0 ? -6 : 1) - day;
		x.setDate(x.getDate() + diff);
		x.setHours(0, 0, 0, 0);
		return x;
	}
	function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
	function fmtDayLabel(d: Date) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
	function fmtMonth(d: Date) { return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
	function fmtDayNum(d: Date) { return d.getDate(); }

	let view = $state<'day' | 'week' | 'month'>('week');
	let anchor = $state(new Date());
	const weekStart = $derived(startOfWeek(anchor));
	const weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
	const START_HOUR = 6;
	const END_HOUR = 22;
	const hours = $derived(Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i));

	let drafts = $state<Draft[]>([
		{ id: 'd1', title: 'IG carousel: brand studio export', channels: ['instagramBusiness', 'pinterest'], igType: 'carousel' },
		{ id: 'd2', title: 'IG reel: teaser clip', channels: ['instagramBusiness'], igType: 'reel' },
		{ id: 'd3', title: 'IG story: poll + link', channels: ['instagramBusiness'], igType: 'story' },
	]);
	let posts = $state<ScheduledPost[]>([
		{ id: 'p1', title: 'Tweet Carousel: fries debate', channels: ['instagramBusiness', 'pinterest'], igType: 'carousel', startISO: localIso(new Date(new Date().setHours(10, 0, 0, 0))), durationMin: 60 },
	]);

	function postsForDay(day: Date) {
		const yyyy = day.getFullYear();
		const mm = day.getMonth();
		const dd = day.getDate();
		return posts
			.filter((p) => {
				const d = new Date(p.startISO);
				return d.getFullYear() === yyyy && d.getMonth() === mm && d.getDate() === dd;
			})
			.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
	}

	function dragStartDraft(e: DragEvent, id: string) {
		e.dataTransfer?.setData('application/x-ssp', JSON.stringify({ kind: 'draft', id }));
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
	}
	function dragStartPost(e: DragEvent, id: string) {
		e.dataTransfer?.setData('application/x-ssp', JSON.stringify({ kind: 'post', id }));
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function allowDrop(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}
	function dropToSlot(e: DragEvent, day: Date, hour: number) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData('application/x-ssp');
		if (!raw) return;
		let payload: any;
		try { payload = JSON.parse(raw); } catch { return; }

		const d = new Date(day);
		d.setHours(hour, 0, 0, 0);
		if (payload.kind === 'post') {
			posts = posts.map((p) => (p.id === payload.id ? { ...p, startISO: localIso(d) } : p));
			return;
		}
		if (payload.kind === 'draft') {
			const draft = drafts.find((x) => x.id === payload.id);
			if (!draft) return;
			posts = [...posts, { id: `p_${crypto.randomUUID()}`, title: draft.title, channels: draft.channels, igType: draft.igType, startISO: localIso(d), durationMin: 60 }];
		}
	}

	function prev() { anchor = addDays(anchor, view === 'week' ? -7 : -1); }
	function next() { anchor = addDays(anchor, view === 'week' ? 7 : 1); }
	function today() { anchor = new Date(); }
</script>

<div class="h-[calc(100vh-0px)] w-full flex overflow-hidden">
	<aside class="w-72 shrink-0 border-r border-white/5 bg-[#0b0b0b] flex flex-col">
		<div class="p-4 border-b border-white/5">
			<div class="flex items-center gap-2">
				<button onclick={() => history.length > 1 ? history.back() : goto('/dashboard')}
					class="w-9 h-9 rounded-xl bg-white/4 hover:bg-white/7 border border-white/8 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
					aria-label="Go back">
					<ArrowLeft size={16} />
				</button>
				<div class="min-w-0">
					<p class="text-xs font-mono text-white/30 uppercase tracking-widest">Calendar</p>
					<p class="text-sm font-display font-semibold text-white/80 truncate">Scheduler</p>
				</div>
			</div>
		</div>

		<div class="p-4 border-b border-white/5">
			<div class="flex items-center justify-between mb-3">
				<p class="text-[10px] font-mono text-white/35 uppercase tracking-widest">Channels</p>
				<button onclick={() => (showAddChannel = true)}
					class="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-mono text-violet-300 hover:bg-violet-500/15 transition-colors flex items-center gap-1.5">
					<Plus size={12} /> Add
				</button>
			</div>

			<div class="flex flex-col gap-1.5">
				{#each connected as id (id)}
					{@const ch = channelById(id)}
					<button onclick={() => toggleConnected(id)}
						class="group flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 transition-colors text-left">
						<div class="w-9 h-9 rounded-xl bg-white/3 border border-white/6 flex items-center justify-center">
							<div class="opacity-90">{@html ch?.icon(true) ?? ''}</div>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-body text-white/75 truncate">{ch?.label ?? id}</p>
							<p class="text-[10px] font-mono text-white/25 truncate">{ch?.kind ?? 'channel'}</p>
						</div>
						<div class="w-2 h-2 rounded-full {ch?.accent ?? 'bg-white/30'}"></div>
					</button>
				{/each}
			</div>
		</div>

		<div class="p-4 flex-1 overflow-auto">
			<div class="flex items-center justify-between mb-3">
				<p class="text-[10px] font-mono text-white/35 uppercase tracking-widest">Drafts</p>
				<p class="text-[10px] font-mono text-white/20">drag to calendar</p>
			</div>
			<div class="flex flex-col gap-2">
				{#each drafts as d (d.id)}
					<div
						role="listitem"
						draggable="true"
						ondragstart={(e) => dragStartDraft(e, d.id)}
						class="cursor-grab active:cursor-grabbing select-none rounded-2xl bg-white/2 border border-white/6 p-3 hover:bg-white/3 transition-colors">
						<div class="flex items-start justify-between gap-2 mb-2">
							<p class="text-xs font-body text-white/75">{d.title}</p>
							<span class="shrink-0 text-[9px] font-mono px-2 py-1 rounded-lg border {igTypePillClass(d.igType)}">
								{igTypeLabel(d.igType)}
							</span>
						</div>
						<div class="flex items-center justify-between gap-2 mb-2">
							<p class="text-[10px] font-mono text-white/25 uppercase tracking-widest">Instagram type</p>
							<select
								value={d.igType}
								onchange={(e) => {
									const v = (e.target as HTMLSelectElement).value as IgContentType;
									drafts = drafts.map((x) => (x.id === d.id ? { ...x, igType: v } : x));
								}}
								class="bg-white/3 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-mono text-white/60 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark cursor-pointer"
							>
								<option value="post">Post</option>
								<option value="reel">Reel</option>
								<option value="carousel">Carousel</option>
								<option value="story">Story (manual)</option>
							</select>
						</div>
						<div class="flex items-center gap-1.5 flex-wrap">
							{#each d.channels as cid (cid)}
								{@const c = channelById(cid)}
								<span class="text-[9px] font-mono text-white/45 bg-white/3 border border-white/6 px-2 py-1 rounded-lg flex items-center gap-1.5">
									<span class="w-1.5 h-1.5 rounded-full {c?.accent ?? 'bg-white/30'}"></span>
									{c?.label ?? cid}
								</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</aside>

	<main class="flex-1 bg-[#070707] overflow-hidden">
		<div class="px-6 py-4 border-b border-white/5 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-9 h-9 rounded-xl bg-white/3 border border-white/6 flex items-center justify-center">
					<Calendar size={16} class="text-white/55" />
				</div>
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">Schedule</p>
					<p class="text-sm font-display font-semibold text-white/80">{fmtMonth(anchor)}</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<button onclick={today} class="px-3 py-2 rounded-xl bg-white/2 border border-white/6 text-xs font-mono text-white/55 hover:bg-white/4 transition-colors">Today</button>
				<button onclick={prev} class="w-10 h-10 rounded-xl bg-white/2 border border-white/6 text-white/45 hover:text-white/80 hover:bg-white/4 transition-colors" aria-label="Previous">‹</button>
				<button onclick={next} class="w-10 h-10 rounded-xl bg-white/2 border border-white/6 text-white/45 hover:text-white/80 hover:bg-white/4 transition-colors" aria-label="Next">›</button>
				<div class="ml-2 flex items-center rounded-xl bg-white/2 border border-white/6 overflow-hidden">
					<button onclick={() => (view = 'day')} class="px-3 py-2 text-xs font-mono {view === 'day' ? 'bg-violet-500/20 text-violet-200' : 'text-white/45 hover:text-white/80'}">Day</button>
					<button onclick={() => (view = 'week')} class="px-3 py-2 text-xs font-mono {view === 'week' ? 'bg-violet-500/20 text-violet-200' : 'text-white/45 hover:text-white/80'}">Week</button>
					<button onclick={() => (view = 'month')} class="px-3 py-2 text-xs font-mono {view === 'month' ? 'bg-violet-500/20 text-violet-200' : 'text-white/45 hover:text-white/80'}">Month</button>
				</div>
			</div>
		</div>

		<div class="h-[calc(100%-73px)] overflow-auto">
			<div class="min-w-[980px]">
				<div class="grid" style="grid-template-columns: 72px repeat(7, 1fr);">
					<div class="h-14 border-b border-white/5"></div>
					{#each weekDays as d (d.toISOString())}
						<div class="h-14 border-b border-white/5 px-3 flex items-center justify-between">
							<div>
								<p class="text-[10px] font-mono text-white/30 uppercase tracking-widest">{fmtDayLabel(d)}</p>
								<p class="text-sm font-display font-semibold text-white/75">{fmtDayNum(d)}</p>
							</div>
							<div class="w-2 h-2 rounded-full bg-white/8"></div>
						</div>
					{/each}
				</div>

				<div class="grid" style="grid-template-columns: 72px repeat(7, 1fr);">
					{#each hours as hr (hr)}
						<div class="h-20 border-b border-white/5 pr-3 flex items-start justify-end pt-2">
							<span class="text-[10px] font-mono text-white/20">{hr === 12 ? '12 PM' : hr < 12 ? `${hr} AM` : `${hr - 12} PM`}</span>
						</div>
						{#each weekDays as d (d.toISOString() + ':' + hr)}
							<div
								role="presentation"
								class="relative h-20 border-b border-white/5 border-l hover:bg-white/2 transition-colors"
								ondragover={allowDrop}
								ondrop={(e) => dropToSlot(e, d, hr)}
							>
								{#each postsForDay(d).filter(p => new Date(p.startISO).getHours() === hr) as p (p.id)}
									<div
										role="button"
										tabindex="0"
										draggable="true"
										ondragstart={(e) => dragStartPost(e, p.id)}
										class="absolute left-2 right-2 top-2 rounded-2xl bg-violet-500/14 border border-violet-500/25 p-2.5 cursor-grab active:cursor-grabbing select-none shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
									>
										<div class="flex items-start justify-between gap-2 mb-2">
											<p class="text-[11px] font-body text-white/80 leading-tight truncate">{p.title}</p>
											<span class="shrink-0 text-[9px] font-mono px-2 py-0.5 rounded-lg border {igTypePillClass(p.igType)}">
												{igTypeLabel(p.igType)}
											</span>
										</div>
										<div class="flex items-center gap-1.5 flex-wrap">
											{#each p.channels as cid (cid)}
												{@const c = channelById(cid)}
												<span class="text-[9px] font-mono text-white/45 bg-white/3 border border-white/6 px-2 py-0.5 rounded-lg flex items-center gap-1.5">
													<span class="w-1.5 h-1.5 rounded-full {c?.accent ?? 'bg-white/30'}"></span>
													{c?.label ?? cid}
												</span>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</div>
	</main>

	{#if showAddChannel}
		<div
			role="button"
			tabindex="0"
			class="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm"
			onclick={() => (showAddChannel = false)}
			onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && (showAddChannel = false)}
			aria-label="Close add channel modal"
		>
			<div class="absolute inset-0 flex items-start justify-center pt-24 px-4">
				<div
					role="dialog"
					aria-modal="true"
					class="w-full max-w-3xl rounded-2xl bg-[#0f0f0f] border border-white/10 shadow-2xl overflow-hidden"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					tabindex="-1"
				>
					<div class="px-5 py-4 border-b border-white/6 flex items-center justify-between">
						<p class="text-sm font-display font-semibold text-white/85">Add Channel</p>
						<button onclick={() => (showAddChannel = false)}
							class="w-9 h-9 rounded-xl bg-white/3 border border-white/8 hover:bg-white/6 text-white/50 hover:text-white/80 transition-all flex items-center justify-center"
							aria-label="Close">
							<X size={16} />
						</button>
					</div>

					<div class="p-5">
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
							{#each CHANNELS as ch (ch.id)}
								<button
									onclick={() =>
										ch.id === 'instagramBusiness'
											? connectInstagramBusiness()
											: ch.id === 'facebookPage'
												? connectFacebookPages()
											: ch.id === 'linkedin'
												? connectLinkedIn('member')
												: ch.id === 'linkedinPage'
													? connectLinkedIn('org')
													: ch.id === 'gmb'
														? connectGmb()
													: toggleConnected(ch.id)
									}
									class="group rounded-2xl bg-white/2 border border-white/6 hover:bg-white/4 transition-colors p-3 flex flex-col items-center gap-2">
									<div class="w-11 h-11 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center">
										<div>{@html ch.icon(connected.includes(ch.id))}</div>
									</div>
									<p class="text-[10px] font-mono text-white/55 text-center leading-tight">{ch.label}</p>
									<p class="text-[9px] font-mono text-white/20">{connected.includes(ch.id) ? 'Connected' : 'Connect'}</p>
								</button>
							{/each}
						</div>
						<p class="mt-4 text-[11px] font-body text-white/25">UI-only for now. Real connections will use OAuth per platform.</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

