<script lang="ts">
	import { ExternalLink, Image, CheckCircle2, AlertTriangle } from 'lucide-svelte';
</script>

<div class="dash-page max-w-4xl">
	<div class="mb-8">
		<div class="flex items-center gap-2 mb-2">
			<div class="w-9 h-9 rounded-xl bg-white/3 border border-white/6 flex items-center justify-center">
				<Image size={16} class="text-pink-400" />
			</div>
			<h1 class="font-display font-bold text-2xl text-white">Instagram publishing docs</h1>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6">
		<section class="rounded-2xl bg-[#0d0d0d] border border-white/10 overflow-hidden">
			<div class="px-5 py-4 border-b border-white/6">
				<p class="text-sm font-display font-semibold text-white/85">Connect Instagram (customer checklist)</p>
			</div>
			<div class="p-5 space-y-4">
				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="text-[11px] font-mono text-white/40 uppercase tracking-widest mb-2">1) Make sure your account is eligible</p>
					<ul class="text-sm font-body text-white/55 space-y-2">
						<li>- Your Instagram must be a <b>Business</b> or <b>Creator</b> account.</li>
						<li>- It must be connected to a <b>Facebook Page</b> (Meta requirement).</li>
						<li>- You must have admin access to that Page/account.</li>
					</ul>
				</div>

				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="text-[11px] font-mono text-white/40 uppercase tracking-widest mb-2">2) Connect inside the app</p>
					<ul class="text-sm font-body text-white/55 space-y-2">
						<li>- Go to <b>Settings</b> and click <b>Connect Instagram</b>.</li>
						<li>- Sign in with Facebook/Meta when prompted.</li>
						<li>- Approve the requested permissions.</li>
					</ul>
				</div>

				<div class="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-start gap-3">
					<CheckCircle2 size={16} class="text-emerald-300 mt-0.5" />
					<div class="min-w-0">
						<p class="text-sm font-body text-emerald-200/90">What you can schedule</p>
						<ul class="text-sm font-body text-emerald-200/70 mt-2 space-y-1.5">
							<li>- Posts, Reels, Carousels, Stories.</li>
							<li>- Posts/Reels/Carousels can be auto-published when enabled.</li>
							<li>- Stories are scheduled as reminders (manual publish).</li>
						</ul>
					</div>
				</div>
			</div>
		</section>

		<!-- Troubleshooting -->
		<section class="rounded-2xl bg-[#0d0d0d] border border-white/10 overflow-hidden">
			<div class="px-5 py-4 border-b border-white/6">
				<p class="text-sm font-display font-semibold text-white/85">Troubleshooting</p>
			</div>
			<div class="p-5 space-y-3 text-sm font-body text-white/55">
				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-2">“Instagram isn’t available”</p>
					<p>
						If you see a message that Instagram isn’t configured, contact support. This is an admin setup issue (not something you can fix as a customer).
					</p>
				</div>
				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-2">“No Instagram business account found”</p>
					<p>
						Make sure your Instagram is Business/Creator and connected to a Facebook Page in Meta settings.
					</p>
				</div>
				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="font-mono text-[11px] text-white/40 uppercase tracking-widest mb-2">“Login works but publishing fails”</p>
					<p>
						Instagram publishing is stricter than scheduling. If you can connect but can’t publish, it’s usually permissions/account eligibility. Contact support.
					</p>
				</div>
			</div>
		</section>

		<!-- Admin-only details -->
		<section class="rounded-2xl bg-[#0d0d0d] border border-white/10 overflow-hidden">
			<div class="px-5 py-4 border-b border-white/6 flex items-center justify-between">
				<p class="text-sm font-display font-semibold text-white/85">Admin / advanced (for the app owner)</p>
				<a
					href="https://docs.zernio.com/platforms/instagram"
					target="_blank"
					rel="noreferrer"
					class="text-[11px] font-mono text-white/35 hover:text-white/70 transition-colors inline-flex items-center gap-1.5"
				>
					Zernio docs <ExternalLink size={12} />
				</a>
			</div>
			<div class="p-5 space-y-4">
				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="text-[11px] font-mono text-white/40 uppercase tracking-widest mb-2">Server env (Zernio)</p>
					<pre class="text-[11px] leading-relaxed font-mono text-white/50 bg-black/30 border border-white/10 rounded-xl p-3 overflow-auto">ZERNIO_API_KEY=sk_...
PUBLIC_APP_URL=https://your-domain.com

SUPABASE_URL=
SUPABASE_SERVICE_KEY=</pre>
					<p class="text-[11px] font-body text-white/40 mt-2">OAuth returns to <code class="text-white/55">/api/auth/zernio/callback</code> (PUBLIC_APP_URL must match how users reach your app).</p>
				</div>
				<div class="rounded-2xl bg-white/2 border border-white/8 p-4">
					<p class="text-[11px] font-mono text-white/40 uppercase tracking-widest mb-2">Permissions</p>
					<p class="text-sm font-body text-white/55">
						Instagram publishing runs through Zernio; platform OAuth and token refresh are handled there. You still need an Instagram Business or Creator account.
					</p>
				</div>
				<div class="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
					<AlertTriangle size={16} class="text-amber-300 mt-0.5" />
					<div class="min-w-0">
						<p class="text-sm font-body text-amber-200/90">Limitations</p>
						<ul class="text-sm font-body text-amber-200/70 mt-2 space-y-1.5">
							<li>- Stories are typically not auto-publishable; treat as reminders.</li>
							<li>- IG publishing requires IG Business/Creator linked to a Facebook Page.</li>
						</ul>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>

