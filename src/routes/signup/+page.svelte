<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { Layers, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let fullName = $state('');
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	async function signup() {
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.signUp({
			email, password,
			options: { data: { full_name: fullName } }
		});
		if (err) { error = err.message; loading = false; return; }
		success = true;
		loading = false;
	}
</script>

<div class="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<a href="/" class="flex items-center gap-2 justify-center mb-10">
			<div class="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
				<Layers size={16} color="white" />
			</div>
			<span class="font-display font-bold text-lg text-white">Carousel<span class="gradient-text">Studio</span></span>
		</a>

		<div class="glass rounded-2xl p-8 border border-white/[0.06]">
			{#if success}
				<div class="text-center py-4">
					<div class="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
						<CheckCircle size={22} class="text-cyan-400" />
					</div>
					<h2 class="font-display font-bold text-xl text-white mb-2">Check your email</h2>
					<p class="font-body text-sm text-white/40">We sent a confirmation link to <strong class="text-white/60">{email}</strong>. Click it to activate your account.</p>
				</div>
			{:else}
				<h1 class="font-display font-bold text-2xl text-white mb-1">Create account</h1>
				<p class="font-body text-sm text-white/40 mb-8">Start growing for free today</p>

				{#if error}
					<div class="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-6">
						<AlertCircle size={14} class="text-red-400 shrink-0" />
						<p class="text-xs font-body text-red-400">{error}</p>
					</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); signup(); }} class="flex flex-col gap-4">
					<div class="flex flex-col gap-1.5">
						<label class="text-xs font-mono text-white/40 uppercase tracking-wider" for="name">Full name</label>
						<div class="relative">
							<User size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
							<input id="name" type="text" bind:value={fullName} required placeholder="Jane Smith"
								class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
						</div>
					</div>

					<div class="flex flex-col gap-1.5">
						<label class="text-xs font-mono text-white/40 uppercase tracking-wider" for="email">Email</label>
						<div class="relative">
							<Mail size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
							<input id="email" type="email" bind:value={email} required placeholder="you@example.com"
								class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
						</div>
					</div>

					<div class="flex flex-col gap-1.5">
						<label class="text-xs font-mono text-white/40 uppercase tracking-wider" for="password">Password</label>
						<div class="relative">
							<Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
							<input id="password" type="password" bind:value={password} required placeholder="Min 8 characters"
								class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
						</div>
					</div>

					<button type="submit" disabled={loading}
						class="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold font-body text-sm text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
						{loading ? 'Creating account...' : 'Create account'}
						{#if !loading}<ArrowRight size={14} />{/if}
					</button>
				</form>
			{/if}
		</div>

		<p class="text-center text-sm font-body text-white/30 mt-6">
			Already have an account?
			<a href="/login" class="text-violet-400 hover:text-violet-300 transition-colors">Sign in</a>
		</p>
	</div>
</div>
