# Video Caption Feature

## Overview
Added a comprehensive caption system to the video clips page that allows users to add customizable captions/subtitles to their video clips.

## Features

### 10 Caption Templates
1. **Minimal** - Clean white text on dark semi-transparent background
2. **Bold Yellow** - Uppercase yellow text with black stroke (YouTube style)
3. **MrBeast Style** - Impact font, large uppercase with heavy stroke
4. **Elegant** - Serif font with refined dark background
5. **Neon Glow** - Green glowing text effect
6. **Boxed White** - Black text on solid white background
7. **TikTok Style** - Modern sans-serif with text stroke
8. **Clean Sans** - Apple-style clean design
9. **Dramatic** - Large red text with white stroke
10. **Subtitle Classic** - Traditional subtitle style

### Customization Options

#### Basic Controls
- **Enable/Disable Toggle** - Turn captions on/off
- **Template Selection** - Visual grid of all caption styles
- **Position** - Top, Center, or Bottom placement
- **Font Size** - Adjustable from 16px to 72px

#### Advanced Settings
- **Text Color** - Custom color picker
- **Background Color** - Custom background color picker
- **Real-time Preview** - See changes immediately on the video

### Technical Implementation

#### New Files Created
- `src/lib/components/video-clips/VideoCaptionOverlay.svelte` - Caption overlay component
- `src/lib/components/video-clips/VideoCaptionControls.svelte` - Caption settings UI
- `src/lib/video-clips/caption-templates.ts` - Template definitions
- `src/lib/video-clips/caption-sync.ts` - Caption timing logic

#### How It Works
1. **Transcript Parsing**: Automatically detects if transcript is timed (has `[m:ss]` timestamps) or plain text
2. **Timed Transcripts**: Uses exact timestamps from transcript
3. **Untimed Transcripts**: Automatically splits text into sentences and distributes across clip duration
4. **Real-time Sync**: Updates caption text based on video playback time
5. **Adaptive Display**: Captions only show when video has transcript data

#### Integration Points
- Added to `/dashboard/videos` page
- Overlays on native HTML5 video player
- Positioned absolutely within video wrapper
- Syncs with `ontimeupdate` video event

## Usage

1. Navigate to `/dashboard/videos`
2. Import or analyze a video (YouTube URL or upload)
3. Select a clip from the results
4. If the clip has transcript data, caption controls will appear
5. Toggle "Enable" to show captions
6. Choose a caption style from the template grid
7. Adjust position and font size as needed
8. Use advanced settings for custom colors

## UI/UX Considerations
- Captions only appear when enabled and video is playing
- Smooth fade-in animation for caption changes
- Template preview shows actual styling in the selection grid
- Sticky positioning for player keeps captions visible while scrolling
- Advanced settings hidden by default to reduce clutter

## Future Enhancements
- Export video with burned-in captions
- Word-by-word highlighting (karaoke style)
- Custom animation effects (fade, slide, bounce)
- Multi-line caption support with automatic text wrapping
- Caption timing editor (adjust start/end times manually)
- Import/export .srt or .vtt subtitle files
