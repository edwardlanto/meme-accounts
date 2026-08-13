<script lang="ts">
	import LegalDoc from '$lib/components/LegalDoc.svelte';
</script>

<svelte:head>
	<title>Refund Policy — Meme Accounts</title>
	<meta name="description" content="Meme Accounts refund and cancellation policy for Pro and Agency subscriptions." />
</svelte:head>

<LegalDoc title="Meme Accounts — Refund Policy" effectiveDate="August 12, 2026">
	<h2>1. Subscriptions &amp; auto-renewal</h2>
	<p>
		Paid plans are billed monthly or yearly through Stripe. Your subscription
		<strong>renews automatically</strong> until you cancel. Stripe sends payment receipts and
		renewal-related emails to the billing email on your Stripe customer. The next renewal date
		is shown in <strong>Settings → Billing</strong>.
	</p>

	<h2>2. Cancellation (as easy as signup)</h2>
	<p>
		Cancel anytime from <strong>Settings → Billing → Cancel subscription</strong>. That opens
		the Stripe Customer Portal directly on the cancel flow — the same number of steps as
		upgrading (one click from Settings). You can also use &ldquo;Manage subscription&rdquo; in
		the portal.
	</p>
	<p>
		When you cancel, you keep access until the end of the current billing period. After that,
		your account reverts to the Free plan and trial limits apply again. Your projects remain
		in your account unless you delete them or close the account.
	</p>

	<h2>3. Refunds</h2>
	<ul>
		<li>
			<strong>7-day satisfaction window</strong> — If a paid plan isn&apos;t working for you,
			email <a href="mailto:support@memeaccounts.com">support@memeaccounts.com</a> within
			7 days of your first charge for that plan. We&apos;ll review and typically issue a full refund.
		</li>
		<li>Partial refunds for mid-cycle downgrades are not guaranteed but may be offered at our discretion.</li>
		<li>Chargebacks without contacting support may result in account suspension.</li>
	</ul>

	<h2>4. Free trial exports</h2>
	<p>
		Free accounts receive one trial export on gated tools (e.g. Tweet Maker). Trial usage is
		non-refundable and does not convert to paid credits.
	</p>

	<h2>5. Contact</h2>
	<p>
		Billing questions: <a href="mailto:support@memeaccounts.com">support@memeaccounts.com</a>
	</p>
</LegalDoc>
