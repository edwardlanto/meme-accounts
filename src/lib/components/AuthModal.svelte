<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { AlertCircle, CheckCircle, X } from 'lucide-svelte';
	import {
		closeAuthModal,
		getAuthModalState,
		setAuthModalMode,
		subscribeAuthModal,
		type AuthModalState,
		type AuthMode,
	} from '$lib/auth-modal';

	let modal = $state<AuthModalState>(getAuthModalState());
	let email = $state('');
	let password = $state('');
	let fullName = $state('');
	let marketingEmails = $state(false);
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);
	let resetSent = $state(false);

	onMount(() => subscribeAuthModal((s) => {
		modal = s;
		if (s.open) {
			error = s.bannerError || '';
			success = false;
			resetSent = false;
		}
	}));

	$effect(() => {
		if (!modal.open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeAuthModal();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function switchMode(mode: AuthMode) {
		error = '';
		success = false;
		resetSent = false;
		setAuthModalMode(mode);
	}

	async function login() {
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		if (err) {
			error = err.message;
			loading = false;
			return;
		}
		closeAuthModal();
		await goto(modal.next || '/dashboard');
	}

	async function signup() {
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: fullName,
					marketing_emails: marketingEmails,
				},
			},
		});
		if (err) {
			error = err.message;
			loading = false;
			return;
		}
		const { data: sessionData } = await supabase.auth.getSession();
		if (sessionData.session) {
			await supabase
				.from('users')
				.update({ marketing_emails: marketingEmails, updated_at: new Date().toISOString() })
				.eq('id', sessionData.session.user.id);
			closeAuthModal();
			await goto(modal.next || '/dashboard');
			return;
		}
		success = true;
		loading = false;
	}

	async function loginWithGoogle() {
		const next = encodeURIComponent(modal.next || '/dashboard');
		const marketing = marketingEmails ? '1' : '0';
		await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo:
					modal.mode === 'signup'
						? `${location.origin}/auth/callback?next=${next}&marketing_emails=${marketing}`
						: `${location.origin}/auth/callback?next=${next}`,
				...(modal.mode === 'signup' ? { data: { marketing_emails: marketingEmails } } : {}),
			},
		});
	}

	async function forgotPassword() {
		const e = email.trim();
		if (!e) {
			error = 'Enter your email above, then tap Forgot password.';
			return;
		}
		loading = true;
		error = '';
		const { error: err } = await supabase.auth.resetPasswordForEmail(e, {
			redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(modal.next || '/dashboard')}`,
		});
		loading = false;
		if (err) {
			error = err.message;
			return;
		}
		resetSent = true;
	}
</script>

{#if modal.open}
	<div class="auth-backdrop" role="presentation" onclick={closeAuthModal}>
		<div
			class="auth-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="auth-modal-title"
			onclick={(e) => e.stopPropagation()}
		>
			<button type="button" class="auth-close" onclick={closeAuthModal} aria-label="Close">
				<X size={18} />
			</button>

			{#if success}
				<div class="success-state">
					<div class="success-icon" aria-hidden="true"><CheckCircle size={28} /></div>
					<h2 id="auth-modal-title" class="form-title">Check your inbox</h2>
					<p class="success-body">
						We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
						account.
					</p>
					<button type="button" class="oauth-btn" onclick={() => switchMode('login')}>
						Back to sign in
					</button>
				</div>
			{:else}
				<h2 id="auth-modal-title" class="form-title">
					{modal.mode === 'signup' ? 'Sign up' : 'Sign in'}
				</h2>
				<p class="form-sub">
					{modal.mode === 'signup'
						? 'Create an account to start clipping and posting.'
						: 'Welcome back — continue to your dashboard.'}
				</p>

				<button type="button" class="oauth-btn" onclick={loginWithGoogle}>
					<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
						<path
							fill="#4285F4"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="#34A853"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="#FBBC05"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					<span>Continue with Google</span>
				</button>

				<div class="divider" role="separator">
					<span class="divider-line"></span>
					<span class="divider-text">or</span>
					<span class="divider-line"></span>
				</div>

				{#if error}
					<div class="error-toast" role="alert">
						<AlertCircle size={14} />
						<span>{error}</span>
					</div>
				{/if}
				{#if resetSent}
					<div class="ok-toast" role="status">Password reset link sent — check your inbox.</div>
				{/if}

				<form
					class="form"
					onsubmit={(e) => {
						e.preventDefault();
						if (modal.mode === 'signup') signup();
						else login();
					}}
				>
					{#if modal.mode === 'signup'}
						<input
							type="text"
							bind:value={fullName}
							required
							placeholder="Full name"
							class="input"
							autocomplete="name"
							aria-label="Full name"
						/>
					{/if}
					<input
						type="email"
						bind:value={email}
						required
						placeholder="Email"
						class="input"
						autocomplete="email"
						aria-label="Email"
					/>
					<input
						type="password"
						bind:value={password}
						required
						minlength={modal.mode === 'signup' ? 8 : undefined}
						placeholder={modal.mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
						class="input"
						autocomplete={modal.mode === 'signup' ? 'new-password' : 'current-password'}
						aria-label="Password"
					/>

					<button type="submit" class="submit-btn" disabled={loading}>
						{#if loading}
							<span class="spinner"></span>
							{modal.mode === 'signup' ? 'Creating…' : 'Signing in…'}
						{:else}
							{modal.mode === 'signup' ? 'Create account' : 'Sign in'}
						{/if}
					</button>
				</form>

				{#if modal.mode === 'login'}
					<p class="footer-line">
						<button type="button" class="text-btn" onclick={forgotPassword} disabled={loading}>
							Forgot password
						</button>
					</p>
					<p class="footer-line">
						Don't have an account?
						<button type="button" class="text-btn strong" onclick={() => switchMode('signup')}>
							Sign up
						</button>
					</p>
				{:else}
					<p class="terms-note">
						By signing up you agree to our
						<a href="/terms" class="text-btn">Terms</a>
						and
						<a href="/privacy" class="text-btn">Privacy Policy</a>.
					</p>
					<p class="footer-line">
						Already have an account?
						<button type="button" class="text-btn strong" onclick={() => switchMode('login')}>
							Sign in
						</button>
					</p>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.auth-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(15, 12, 18, 0.45);
		backdrop-filter: blur(10px);
		animation: fadeIn 0.18s ease;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.auth-modal {
		position: relative;
		width: min(420px, 100%);
		max-height: min(92vh, 720px);
		overflow: auto;
		padding: 28px 24px 22px;
		border-radius: 18px;
		background: #fffaf7;
		border: 1px solid rgba(28, 16, 24, 0.1);
		color: #1c1018;
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.7) inset,
			0 24px 64px rgba(28, 16, 24, 0.18);
		animation: popIn 0.2s ease;
	}
	@keyframes popIn {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.auth-close {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: rgba(28, 16, 24, 0.45);
		cursor: pointer;
	}
	.auth-close:hover {
		background: rgba(28, 16, 24, 0.06);
		color: #1c1018;
	}
	.form-title {
		margin: 0 0 6px;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #1c1018;
	}
	.form-sub {
		margin: 0 0 18px;
		font-size: 14px;
		line-height: 1.45;
		color: rgba(28, 16, 24, 0.58);
	}
	.oauth-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		height: 48px;
		padding: 0 16px;
		background: #fff;
		border: 1px solid rgba(28, 16, 24, 0.14);
		border-radius: 10px;
		color: #1c1018;
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(28, 16, 24, 0.04);
	}
	.oauth-btn:hover {
		background: #fff;
		border-color: rgba(28, 16, 24, 0.22);
	}
	.divider {
		position: relative;
		height: 20px;
		margin: 18px 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.divider-line {
		position: absolute;
		inset: 50% 0 auto;
		height: 1px;
		background: rgba(28, 16, 24, 0.1);
	}
	.divider-text {
		position: relative;
		z-index: 1;
		padding: 0 12px;
		background: #fffaf7;
		font-size: 13px;
		color: rgba(28, 16, 24, 0.45);
	}
	.error-toast {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		margin-bottom: 12px;
		border-radius: 10px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.22);
		font-size: 13px;
		color: #b91c1c;
	}
	.ok-toast {
		padding: 10px 12px;
		margin-bottom: 12px;
		border-radius: 10px;
		background: rgba(252, 105, 255, 0.1);
		border: 1px solid rgba(252, 105, 255, 0.28);
		font-size: 13px;
		color: #9d174d;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.input {
		width: 100%;
		height: 48px;
		padding: 0 14px;
		box-sizing: border-box;
		background: #fff;
		border: 1px solid rgba(28, 16, 24, 0.14);
		border-radius: 10px;
		color: #1c1018;
		font: inherit;
		font-size: 14px;
		outline: none;
	}
	.input:focus {
		border-color: #fc69ff;
		box-shadow: 0 0 0 3px rgba(252, 105, 255, 0.18);
	}
	.input::placeholder {
		color: rgba(28, 16, 24, 0.4);
	}
	.submit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 50px;
		margin-top: 6px;
		border: none;
		border-radius: 10px;
		background: #fc69ff;
		color: #1a0a1c;
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
	}
	.submit-btn:hover:not(:disabled) {
		filter: brightness(1.03);
	}
	.submit-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.spinner {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid rgba(26, 10, 28, 0.28);
		border-top-color: #1a0a1c;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.footer-line {
		margin: 14px 0 0;
		text-align: center;
		font-size: 14px;
		color: rgba(28, 16, 24, 0.62);
	}
	.terms-note {
		margin: 12px 0 0;
		text-align: center;
		font-size: 12px;
		line-height: 1.5;
		color: rgba(28, 16, 24, 0.48);
	}
	.text-btn {
		background: none;
		border: none;
		padding: 0;
		color: #1c1018;
		font: inherit;
		font-size: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.text-btn.strong {
		font-weight: 700;
		color: #d946ef;
		text-decoration: none;
	}
	a.text-btn {
		color: #1c1018;
	}
	.marketing-opt {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 11px 12px;
		margin-bottom: 12px;
		border-radius: 10px;
		border: 1px solid rgba(28, 16, 24, 0.1);
		background: rgba(252, 105, 255, 0.06);
		cursor: pointer;
	}
	.marketing-check {
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		accent-color: #fc69ff;
	}
	.marketing-copy {
		font-size: 13px;
		font-weight: 550;
		line-height: 1.25;
		color: #1c1018;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.success-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
		padding: 8px 0 4px;
	}
	.success-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #d946ef;
		background: rgba(252, 105, 255, 0.12);
		border: 1px solid rgba(252, 105, 255, 0.28);
	}
	.success-body {
		margin: 0;
		font-size: 14px;
		line-height: 1.55;
		color: rgba(28, 16, 24, 0.72);
	}
	.success-body :global(strong) {
		color: #1c1018;
	}
</style>
