<script lang="ts">
	import { FONT_TEMPLATE_DEFAULT } from '$lib/fonts/brand-fonts';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import {
		WHITE_MEDIA_DEFAULTS,
		WHITE_THREAD_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import { textBgCss, textShadowStyleAttr } from '$lib/textStyleCss';

	interface Props {
		/** `thread` = long copy only; `media` = short copy + rounded attachment */
		layout?: 'thread' | 'media';
		name?: string;
		handle?: string;
		avatar?: string;
		text?: string;
		mediaImage?: string;
		w?: number;
		h?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		nameStyle?: TextStyle;
		handleStyle?: TextStyle;
		bodyStyle?: TextStyle;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		onNameChange?: (v: string) => void;
		onHandleChange?: (v: string) => void;
		onTextChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		showToolbar?: boolean;
		previewMode?: boolean;
		showMenuDots?: boolean;
	}

	let {
		layout = 'thread',
		name = WHITE_THREAD_DEFAULTS.name,
		handle = WHITE_THREAD_DEFAULTS.handle,
		avatar = WHITE_THREAD_DEFAULTS.avatarUrl,
		text = WHITE_THREAD_DEFAULTS.body,
		mediaImage = WHITE_MEDIA_DEFAULTS.imageUrl,
		w = 1080,
		h = 1920,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		nameStyle = {},
		handleStyle = {},
		bodyStyle = {},
		textOffsets = {},
		onTextOffsetChange,
		onNameChange,
		onHandleChange,
		onTextChange,
		onTextSelect,
		onHeadlineRangeSelect,
		showToolbar = false,
		previewMode = false,
		showMenuDots = true,
	}: Props = $props();

	const isMedia = $derived(layout === 'media');
	const padX = $derived(previewMode ? 22 : 72);
	const padTop = $derived(previewMode ? 22 : 72);
	const avatarSize = $derived(previewMode ? 36 : 96);
	const nameSize = $derived(nameStyle.fontSize ?? (previewMode ? 15 : 40));
	const handleSize = $derived(handleStyle.fontSize ?? (previewMode ? 13 : 34));
	const bodySize = $derived(
		bodyStyle.fontSize ?? (previewMode ? (isMedia ? 15 : 16) : isMedia ? 42 : 44),
	);
	const gapBody = $derived(previewMode ? (isMedia ? 14 : 16) : isMedia ? 36 : 40);
	const nameDisplay = $derived(String(name ?? ''));
	const handleDisplay = $derived(String(handle ?? ''));
	const bodyDisplay = $derived(String(text ?? ''));
	const avatarSrc = $derived(String(avatar ?? '').trim());
	const mediaSrc = $derived(String(mediaImage ?? '').trim());
	const mediaSelected = $derived(selectedText === 'articleImage');

	function initialsFromName(n: string): string {
		const parts = n.trim().split(/\s+/).filter(Boolean);
		if (!parts.length) return '?';
		if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
		return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
	}
</script>

<div
	style="
		width: {w * scale}px;
		height: {h * scale}px;
		overflow: hidden;
		border-radius: {scale < 1 ? '12px' : '0'};
		flex-shrink: 0;
		position: relative;
	"
>
	<div
		bind:this={exportRef}
		data-studio-canvas-root
		style="
			width: {w}px;
			height: {h}px;
			position: relative;
			background: #ffffff;
			transform: scale({scale});
			transform-origin: top left;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			overflow: hidden;
			padding: {padTop}px {padX}px {previewMode ? 24 : 80}px;
			font-family: var(--font-display), system-ui, sans-serif;
			color: #0f1419;
		"
	>
		<!-- Header: avatar + name/handle + optional menu dots -->
		<DraggableBlock
			dx={textOffsets.textCarouselName?.x ?? 0}
			dy={textOffsets.textCarouselName?.y ?? 0}
			{interactive}
			{scale}
			onChange={(x, y) => onTextOffsetChange?.('textCarouselName', { x, y })}
		>
			{#snippet children()}
				<div
					style="
						display: flex;
						align-items: center;
						gap: {previewMode ? 10 : 28}px;
						width: 100%;
						margin-bottom: {previewMode ? (isMedia ? 16 : 18) : isMedia ? 40 : 48}px;
					"
				>
					<button
						type="button"
						style="
							width: {avatarSize}px;
							height: {avatarSize}px;
							border-radius: 999px;
							overflow: hidden;
							flex-shrink: 0;
							padding: 0;
							border: none;
							background: #e7e9ea;
							cursor: {interactive ? 'pointer' : 'default'};
							outline: none;
							{selectedText === 'textCarouselAvatar'
								? 'box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.75);'
								: ''}
						"
						onclick={(e) => {
							e.stopPropagation();
							if (!interactive || !onTextSelect) return;
							onTextSelect('textCarouselAvatar', e.currentTarget as HTMLElement);
						}}
					>
						{#if avatarSrc}
							<img
								src={avatarSrc}
								alt=""
								draggable="false"
								style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; display: block;"
							/>
						{:else}
							<span
								style="
									display: flex;
									width: 100%;
									height: 100%;
									align-items: center;
									justify-content: center;
									font-weight: 700;
									font-size: {previewMode ? 12 : 32}px;
									color: #0f1419;
									pointer-events: none;
								">{initialsFromName(nameDisplay)}</span
							>
						{/if}
					</button>

					<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: {previewMode ? 2 : 6}px;">
						<CanvasMarkupTextBlock
							value={name}
							interactive={!!interactive && typeof onNameChange === 'function'}
							defaultColor="#0f1419"
							selected={selectedText === 'textCarouselName'}
							toolbarKind="textCarouselName"
							rows={1}
							minHeight="0px"
							ariaLabel="Display name"
							fontFamily={nameStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
							fontSize={nameSize}
							{showToolbar}
							onTextChange={onNameChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<p
									style="
										margin: 0;
										font-size: {nameSize}px;
										font-weight: {nameStyle.fontWeight ?? 700};
										line-height: 1.15;
										letter-spacing: -0.02em;
										color: {nameStyle.color ?? '#0f1419'};
										{textBgCss(nameStyle)}
										white-space: nowrap;
										overflow: hidden;
										text-overflow: ellipsis;
									"
								>
									{nameDisplay}
								</p>
							{/snippet}
						</CanvasMarkupTextBlock>

						<CanvasMarkupTextBlock
							value={handle}
							interactive={!!interactive && typeof onHandleChange === 'function'}
							defaultColor="#536471"
							selected={selectedText === 'textCarouselHandle'}
							toolbarKind="textCarouselHandle"
							rows={1}
							minHeight="0px"
							ariaLabel="Handle"
							fontFamily={handleStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
							fontSize={handleSize}
							{showToolbar}
							onTextChange={onHandleChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<p
									style="
										margin: 0;
										font-size: {handleSize}px;
										font-weight: {handleStyle.fontWeight ?? 400};
										line-height: 1.2;
										letter-spacing: -0.01em;
										color: {handleStyle.color ?? '#536471'};
										{textBgCss(handleStyle)}
										white-space: nowrap;
										overflow: hidden;
										text-overflow: ellipsis;
									"
								>
									{handleDisplay}
								</p>
							{/snippet}
						</CanvasMarkupTextBlock>
					</div>

					{#if showMenuDots}
						<div
							aria-hidden="true"
							style="
								flex-shrink: 0;
								align-self: flex-start;
								padding-top: {previewMode ? 2 : 8}px;
								color: #536471;
								font-size: {previewMode ? 18 : 44}px;
								line-height: 0.6;
								letter-spacing: 0.08em;
								font-weight: 700;
								user-select: none;
								pointer-events: none;
							"
						>
							···
						</div>
					{/if}
				</div>
			{/snippet}
		</DraggableBlock>

		<!-- Body -->
		<div
			style="
				flex: 1;
				min-height: 0;
				display: flex;
				flex-direction: column;
				gap: {gapBody}px;
			"
		>
			<DraggableBlock
				dx={textOffsets.textCarouselBody?.x ?? 0}
				dy={textOffsets.textCarouselBody?.y ?? 0}
				{interactive}
				{scale}
				immediateTextDrag={selectedText === 'textCarouselBody'}
				onChange={(x, y) => onTextOffsetChange?.('textCarouselBody', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={text}
						interactive={!!interactive && typeof onTextChange === 'function'}
						defaultColor="#0f1419"
						selected={selectedText === 'textCarouselBody'}
						toolbarKind="textCarouselBody"
						rows={isMedia ? 8 : 14}
						minHeight="0px"
						ariaLabel="Post text"
						fontFamily={bodyStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
						fontSize={bodySize}
						lineHeight={bodyStyle.lineHeight}
						{showToolbar}
						onTextChange={onTextChange}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<HighlightedText
								as="div"
								text={bodyDisplay}
								parseHighlights={true}
								baseFontWeight={bodyStyle.fontWeight ?? 400}
								style="
									margin: 0;
									white-space: pre-wrap;
									word-break: break-word;
									line-height: {bodyStyle.lineHeight ?? 1.35};
									letter-spacing: -0.015em;
									color: {bodyStyle.color ?? '#0f1419'};
									font-weight: {bodyStyle.fontWeight ?? 400};
									font-size: {bodySize}px;
									text-align: left;
									{textShadowStyleAttr(bodyStyle)}
									{textBgCss(bodyStyle)}
								"
							/>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>

			{#if isMedia}
				<div
					data-text-selectable={interactive ? 'articleImage' : undefined}
					style="
						margin-top: {previewMode ? 4 : 8}px;
						width: 100%;
						flex: 1;
						min-height: {previewMode ? 120 : 420}px;
						max-height: {previewMode ? 200 : 820}px;
						border-radius: {previewMode ? 12 : 28}px;
						overflow: hidden;
						background: #f0f3f4;
						align-self: stretch;
						cursor: {interactive && onTextSelect ? 'pointer' : 'default'};
						outline: {mediaSelected ? '3px solid rgba(167,139,250,0.85)' : 'none'};
						outline-offset: -3px;
					"
					role={interactive ? 'button' : undefined}
					tabindex={interactive ? 0 : undefined}
					aria-label={interactive ? 'Post media' : undefined}
					onclick={(e) => {
						if (!interactive || !onTextSelect) return;
						e.stopPropagation();
						onTextSelect('articleImage', e.currentTarget as HTMLElement);
					}}
					onkeydown={(e) => {
						if (!interactive || !onTextSelect) return;
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onTextSelect('articleImage', e.currentTarget as HTMLElement);
						}
					}}
				>
					{#if mediaSrc}
						<img
							src={mediaSrc}
							alt=""
							draggable="false"
							style="
								width: 100%;
								height: 100%;
								object-fit: cover;
								object-position: center;
								display: block;
								pointer-events: none;
							"
						/>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
