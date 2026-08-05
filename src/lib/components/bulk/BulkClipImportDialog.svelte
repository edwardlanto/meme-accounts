<script lang="ts">
	import BulkPopover from './BulkPopover.svelte';
	import BulkClipImportForm from './BulkClipImportForm.svelte';
	import type { BulkClipImportResult } from '$lib/studio/bulk-video-clips';

	type Props = {
		open: boolean;
		userId: string;
		oncomplete?: (result: BulkClipImportResult) => void;
	};

	let { open = $bindable(false), userId, oncomplete }: Props = $props();

	function handleComplete(result: BulkClipImportResult) {
		open = false;
		oncomplete?.(result);
	}
</script>

<BulkPopover
	bind:open
	title="Import long video"
	subtitle="AI finds viral moments — each clip becomes one slide in a new slideshow."
	wide
>
	<BulkClipImportForm userId={userId} oncomplete={handleComplete} />
</BulkPopover>
