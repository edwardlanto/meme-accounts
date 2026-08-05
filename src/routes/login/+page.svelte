<!-- Redirect-only: auth UI lives in AuthModal on `/`. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { authModalHref } from '$lib/auth-modal';
	onMount(() => {
		window.location.replace(authModalHref('login'));
	});
</script>

<p style="padding:2rem;font-family:system-ui">Redirecting to sign in…</p>
