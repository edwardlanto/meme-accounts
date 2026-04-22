<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { Layers, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function login() {
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		if (err) { error = err.message; loading = false; return; }
		goto('/dashboard');
	}

	async function loginWithGoogle() {
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
		});
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
			<h1 class="font-display font-bold text-2xl text-white mb-1">Welcome back</h1>
			<p class="font-body text-sm text-white/40 mb-8">Sign in to your account</p>

			{#if error}
				<div class="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-6">
					<AlertCircle size={14} class="text-red-400 shrink-0" />
					<p class="text-xs font-body text-red-400">{error}</p>
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); login(); }} class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-mono text-white/40 uppercase tracking-wider" for="email">Email</label>
					<div class="relative">
						<Mail size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
						<input id="email" type="email" bind:value={email} required
							placeholder="you@example.com"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-xs font-mono text-white/40 uppercase tracking-wider" for="password">Password</label>
					<div class="relative">
						<Lock size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
						<input id="password" type="password" bind:value={password} required
							placeholder="••••••••"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
					</div>
				</div>

				<button type="submit" disabled={loading}
					class="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold font-body text-sm text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
					{loading ? 'Signing in...' : 'Sign in'}
					{#if !loading}<ArrowRight size={14} />{/if}
				</button>
			</form>

			<div class="flex items-center gap-3 my-6">
				<div class="flex-1 h-[1px] bg-white/[0.06]"></div>
				<span class="text-xs font-mono text-white/20">or</span>
				<div class="flex-1 h-[1px] bg-white/[0.06]"></div>
			</div>

			<button onclick={loginWithGoogle}
				class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-body text-white/60 glass glass-hover border border-white/[0.06] transition-all">
				<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
				Continue with Google
			</button>
		</div>

		<p class="text-center text-sm font-body text-white/30 mt-6">
			Don't have an account?
			<a href="/signup" class="text-violet-400 hover:text-violet-300 transition-colors">Sign up free</a>
		</p>
	</div>
</div>
