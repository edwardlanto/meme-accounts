<script lang="ts">
	// Reuse the existing studio implementation, but under a dedicated route.
	// The studio page can key off $page.url.pathname to tweak UI if desired.
	import Studio from '../studio/+page.svelte';
</script>

<Studio />

