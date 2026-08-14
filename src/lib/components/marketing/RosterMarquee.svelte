<script lang="ts">
	type RosterItem = { name: string; handle: string; followers: string };

	let { items }: { items: RosterItem[] } = $props();
</script>

<div class="mk-roster-wrap">
	<div class="mk-roster-track">
		{#each [0, 1] as copy (copy)}
			{#each items as item, i (`${copy}-${i}`)}
				<div class="mk-roster-card">
					<p class="mk-roster-name">{item.name}</p>
					<p class="mk-roster-handle">{item.handle}</p>
					<p class="mk-roster-handle mt-2 font-semibold text-[var(--mk-text)]">{item.followers}</p>
				</div>
			{/each}
		{/each}
	</div>
</div>
