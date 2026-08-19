<script lang="ts">
	import {
		isMarqueeVideo,
		marqueeAssetPath,
		type HomeMarqueeSlide,
	} from '$lib/marketing/home-marquee-slides';

	let { slides }: { slides: HomeMarqueeSlide[] } = $props();
</script>

<div class="phone-stage" aria-hidden="true">
	<div class="phone-stage-glow"></div>
	<div class="phone-marquee">
		{#each [0, 1] as copy (copy)}
			<div class="phone-track">
				{#each slides as slide (copy + '-' + slide.file)}
					<div class="phone" style="--tint:{slide.tint}">
						<span class="phone-aura"></span>
						<div class="phone-frame">
							<div class="phone-notch"></div>
							<div class="phone-screen">
								{#if isMarqueeVideo(slide.file)}
									<video
										src={marqueeAssetPath(slide.file)}
										poster={slide.poster ? marqueeAssetPath(slide.poster) : undefined}
										muted
										loop
										playsinline
										autoplay
										preload="metadata"
										aria-hidden="true"
									></video>
								{:else}
									<img src={marqueeAssetPath(slide.file)} alt="" draggable="false" />
								{/if}
							</div>
						<div class="phone-bar"></div>
						</div>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>
