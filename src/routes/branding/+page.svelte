<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Legacy route: keep /branding working, but the real UI lives in /dashboard/branding.
	onMount(() => void goto('/dashboard/branding', { replaceState: true }));
</script>
<div class="min-h-screen bg-[#0b0b0b]"></div>

