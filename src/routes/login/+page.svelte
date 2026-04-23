<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { Layers, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-svelte';

	let email    = $state('');
	let password = $state('');
	let loading  = $state(false);
	let error    = $state('');

	async function login() {
		loading = true; error = '';
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

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="auth-root">
	<!-- Background decoration -->
	<div class="auth-orb auth-orb--1"></div>
	<div class="auth-orb auth-orb--2"></div>

	<!-- Left panel: branding -->
	<div class="auth-brand">
		<div class="brand-inner">
			<a href="/" class="brand-logo">
				<div class="logo-mark">CS</div>
				<span class="logo-text">Carousel<em>Studio</em></span>
			</a>

			<div class="brand-copy">
				<h2 class="brand-headline">AI-powered carousels<br/>that actually go viral.</h2>
				<p class="brand-sub">Join 8,400+ creators who schedule, analyze, and grow their social presence with Carousel Studio.</p>
			</div>

			<div class="brand-stats">
				<div class="brand-stat">
					<span class="stat-num">2.3M+</span>
					<span class="stat-label">Posts analyzed</span>
				</div>
				<div class="brand-stat">
					<span class="stat-num">94%</span>
					<span class="stat-label">Engagement lift</span>
				</div>
				<div class="brand-stat">
					<span class="stat-num">12×</span>
					<span class="stat-label">Faster creation</span>
				</div>
			</div>

			<div class="brand-testimonial">
				<p class="brand-quote">"I went from 200 to 12k followers in 6 weeks."</p>
				<div class="brand-attribution">
					<div class="brand-avatar">MC</div>
					<div>
						<p class="brand-attr-name">Mia Chen</p>
						<p class="brand-attr-handle">@mia.creates · Finance Creator</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right panel: form -->
	<div class="auth-form-panel">
		<div class="auth-form-wrap">
			<div class="form-header">
				<h1 class="form-title">Welcome back</h1>
				<p class="form-sub">Sign in to your Carousel Studio account</p>
			</div>

			{#if error}
				<div class="error-banner">
					<AlertCircle size={14} class="shrink-0" />
					<p>{error}</p>
				</div>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); login(); }} class="auth-form">
				<div class="field">
					<label for="email" class="field-label">Email address</label>
					<div class="input-wrap">
						<Mail size={14} class="input-icon" />
						<input
							id="email" type="email" bind:value={email} required
							placeholder="you@example.com"
							class="input"
						/>
					</div>
				</div>

				<div class="field">
					<label for="password" class="field-label">Password</label>
					<div class="input-wrap">
						<Lock size={14} class="input-icon" />
						<input
							id="password" type="password" bind:value={password} required
							placeholder="••••••••"
							class="input"
						/>
					</div>
					<a href="#" class="forgot-link">Forgot password?</a>
				</div>

				<button type="submit" disabled={loading} class="submit-btn">
					{loading ? 'Signing in…' : 'Sign in'}
					{#if !loading}<ArrowRight size={15} />{/if}
				</button>
			</form>

			<div class="divider">
				<div class="divider-line"></div>
				<span class="divider-text">or</span>
				<div class="divider-line"></div>
			</div>

			<button onclick={loginWithGoogle} class="google-btn">
				<svg width="18" height="18" viewBox="0 0 24 24">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				Continue with Google
			</button>

			<p class="form-footer">
				Don't have an account?
				<a href="/signup" class="form-link">Sign up free →</a>
			</p>
		</div>
	</div>
</div>

<style>
	.auth-root {
		min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr;
		background: #080808; font-family: 'DM Sans', sans-serif;
		position: relative; overflow: hidden;
	}

	.auth-orb {
		position: fixed; border-radius: 50%; pointer-events: none; filter: blur(80px);
	}
	.auth-orb--1 {
		width: 400px; height: 400px; top: -100px; left: -50px;
		background: radial-gradient(ellipse, rgba(139,92,246,0.08), transparent);
	}
	.auth-orb--2 {
		width: 500px; height: 500px; bottom: -150px; right: -100px;
		background: radial-gradient(ellipse, rgba(232,255,72,0.05), transparent);
	}

	/* Brand panel */
	.auth-brand {
		background: #0a0a0a; border-right: 1px solid rgba(255,255,255,0.05);
		display: flex; align-items: center; justify-content: center;
		padding: 60px 64px; position: relative;
	}
	.brand-inner { max-width: 400px; display: flex; flex-direction: column; gap: 48px; }

	.brand-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
	.logo-mark {
		width: 36px; height: 36px; border-radius: 9px;
		background: #E8FF48; color: #000;
		display: flex; align-items: center; justify-content: center;
		font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700;
	}
	.logo-text {
		font-family: 'Fraunces', serif; font-size: 18px; font-weight: 900;
		color: #fff; letter-spacing: -0.02em;
	}
	.logo-text em { font-style: italic; color: #E8FF48; }

	.brand-copy { display: flex; flex-direction: column; gap: 14px; }
	.brand-headline {
		font-family: 'Fraunces', serif; font-size: clamp(28px, 3vw, 42px);
		font-weight: 900; line-height: 1.05; letter-spacing: -0.03em;
		color: #fff; margin: 0;
	}
	.brand-sub { font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.4); margin: 0; }

	.brand-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
	.brand-stat {
		padding: 16px; border-radius: 12px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
		display: flex; flex-direction: column; gap: 4px;
	}
	.stat-num { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 900; color: #E8FF48; line-height: 1; }
	.stat-label { font-size: 11px; color: rgba(255,255,255,0.35); }

	.brand-testimonial {
		padding: 20px; border-radius: 14px;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
		display: flex; flex-direction: column; gap: 16px;
	}
	.brand-quote {
		font-family: 'Fraunces', serif; font-size: 18px; font-style: italic;
		font-weight: 700; color: rgba(255,255,255,0.88); line-height: 1.4; margin: 0;
	}
	.brand-attribution { display: flex; align-items: center; gap: 10px; }
	.brand-avatar {
		width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
		background: rgba(232,255,72,0.12); border: 1px solid rgba(232,255,72,0.25);
		display: flex; align-items: center; justify-content: center;
		font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; color: #E8FF48;
	}
	.brand-attr-name   { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0 0 2px; }
	.brand-attr-handle { font-size: 11px; color: rgba(255,255,255,0.3); margin: 0; font-family: 'Space Mono', monospace; }

	/* Form panel */
	.auth-form-panel {
		display: flex; align-items: center; justify-content: center;
		padding: 60px 64px;
	}
	.auth-form-wrap { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 24px; }

	.form-header { display: flex; flex-direction: column; gap: 8px; }
	.form-title {
		font-family: 'Fraunces', serif; font-size: 28px; font-weight: 900;
		letter-spacing: -0.03em; color: #fff; margin: 0;
	}
	.form-sub { font-size: 14px; color: rgba(255,255,255,0.38); margin: 0; }

	.error-banner {
		display: flex; align-items: center; gap: 8px;
		padding: 12px 14px; border-radius: 10px;
		background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
		font-size: 13px; color: #f87171;
	}
	.error-banner p { margin: 0; }

	.auth-form { display: flex; flex-direction: column; gap: 16px; }

	.field { display: flex; flex-direction: column; gap: 6px; }
	.field-label {
		font-size: 12px; font-weight: 600; text-transform: uppercase;
		letter-spacing: 0.07em; color: rgba(255,255,255,0.4);
		font-family: 'Space Mono', monospace;
	}
	.input-wrap { position: relative; }
	:global(.input-icon) {
		position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
		color: rgba(255,255,255,0.25); pointer-events: none;
	}
	.input {
		width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
		border-radius: 10px; padding: 11px 12px 11px 38px;
		font-size: 14px; font-family: 'DM Sans', sans-serif; color: #fff;
		outline: none; transition: border-color 0.15s;
	}
	.input::placeholder { color: rgba(255,255,255,0.2); }
	.input:focus { border-color: rgba(232,255,72,0.35); background: rgba(255,255,255,0.04); }

	.forgot-link {
		font-size: 12px; color: rgba(255,255,255,0.3); text-decoration: none; align-self: flex-end;
		transition: color 0.15s;
	}
	.forgot-link:hover { color: rgba(255,255,255,0.7); }

	.submit-btn {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		width: 100%; padding: 13px; border-radius: 11px; border: none;
		background: #E8FF48; color: #0a0a0a;
		font-size: 15px; font-weight: 700; font-family: 'DM Sans', sans-serif;
		cursor: pointer; transition: all 0.2s; margin-top: 4px;
	}
	.submit-btn:hover:not(:disabled) { background: #f0ff70; box-shadow: 0 8px 28px rgba(232,255,72,0.3); transform: translateY(-1px); }
	.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.divider { display: flex; align-items: center; gap: 12px; }
	.divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
	.divider-text { font-size: 12px; color: rgba(255,255,255,0.2); font-family: 'Space Mono', monospace; }

	.google-btn {
		display: flex; align-items: center; justify-content: center; gap: 10px;
		width: 100%; padding: 11px; border-radius: 11px;
		background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
		font-size: 14px; font-family: 'DM Sans', sans-serif; color: rgba(255,255,255,0.65);
		cursor: pointer; transition: all 0.15s;
	}
	.google-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); }

	.form-footer {
		text-align: center; font-size: 14px; color: rgba(255,255,255,0.3);
	}
	.form-link { color: #E8FF48; text-decoration: none; font-weight: 600; transition: opacity 0.15s; }
	.form-link:hover { opacity: 0.8; }
</style>
