# Enhanced Caption System

## What's New

I've rebuilt the caption system to match the design you showed in the screenshot, with these key features:

### 1. Drag & Drop Positioning
- **"Drag Caption" toggle** - Enable to freely position captions by dragging them anywhere on the video
- When disabled, uses preset positions (Top/Center/Bottom)
- Smooth dragging experience with visual feedback

### 2. Enhanced UI Controls

**Template Selection**
- Visual grid showing 10 caption styles
- Click any template to apply it instantly
- Each preview shows the actual style

**Settings Panel** (matches your screenshot)
- **Font Selector** - Choose from 6 fonts (Inter, Bangers, Impact, Arial Black, Georgia, Helvetica)
- **Font Size Slider** - Adjust from 16px to 72px
- **Stroke Toggle** - Two-button choice:
  - Filled circle (solid text)
  - Outline circle (stroke text)
- **Background Color** - Color picker + hex input
- **Subtitle Position** - Dropdown with Top/Center/Bottom options

### 3. Real-time Preview
- Captions update live as you adjust settings
- See changes immediately on the video
- Syncs automatically with video playback

## How It Works

### Caption Display Logic
1. **Video plays** → Transcript is parsed into timed segments
2. **Current time updates** → Caption text changes based on what's being said
3. **You customize** → Template, font, size, colors apply in real-time
4. **Drag mode enabled** → You can reposition captions freely

### Technical Implementation

#### Files Modified/Created
- `VideoCaptionOverlay.svelte` - The caption display with drag support
- `VideoCaptionControls.svelte` - The settings UI matching your screenshot
- `caption-templates.ts` - 10 pre-designed caption templates
- `caption-sync.ts` - Timing and synchronization logic

#### State Management
All caption settings are stored in the videos page state:
- `captionEnabled` - Toggle on/off
- `captionDraggable` - Drag mode on/off
- `captionTemplateId` - Which style is selected
- `captionFontSize` - Current font size
- `captionPosition` - Top/Center/Bottom
- `captionCustomX/Y` - Drag position coordinates
- `captionSelectedFont` - Font family
- `captionStrokeEnabled` - Fill vs outline
- `captionCustomColor` - Text color override
- `captionCustomBgColor` - Background color override

## Usage Guide

### 1. Import/Analyze a Video
Navigate to `/dashboard/videos` and import a YouTube video or upload one.

### 2. Select a Clip
Choose a clip from the analyzed results (it must have transcript data).

### 3. Enable Captions
Toggle "Enable Caption" in the Subtitle panel below the video.

### 4. Choose a Template
Click any template from the grid to apply it.

### 5. Customize Settings
- Select a font from the dropdown
- Adjust font size with the slider
- Toggle between filled/outline stroke
- Change background color
- Choose position (Top/Center/Bottom)

### 6. Enable Drag Mode (Optional)
- Toggle "Drag Caption"
- Click and drag the caption to position it anywhere
- Caption stays at custom position until you disable drag mode

## Features Matching Your Screenshot

✅ "Subtitle" header (changed from "Captions")  
✅ "Enable Caption" toggle  
✅ "Drag Caption" toggle  
✅ Template grid with styled previews  
✅ "Setting" panel with organized controls  
✅ Font selector dropdown  
✅ Font size slider  
✅ Stroke toggle (filled vs outline circles)  
✅ Background color with hex input  
✅ Subtitle Position dropdown  

## Why Captions Need to Be Downloaded

Captions are downloaded during initial video import (not when you toggle them on) because:

1. **AI Analysis** - The transcript is fed to Gemini AI to:
   - Understand spoken content
   - Find viral moments
   - Generate accurate clip titles
   - Score virality based on what's actually said

2. **Caption Display** - The transcript is stored with each clip for later visualization

**Two separate processes:**
- **During import**: Download transcript → AI analyzes content
- **After clipping**: You enable caption overlay → Visual styling applied

## Troubleshooting

### Captions Don't Show
1. Check if video has transcript data (some videos have no captions)
2. Make sure "Enable Caption" is toggled on
3. Verify the video is playing (captions sync with playback)
4. Try selecting a different template

### Can't Drag Captions
1. Make sure "Drag Caption" toggle is ON
2. Click directly on the caption text (not around it)
3. The video must be stored (not just YouTube embed)

### Rate Limit Errors (HTTP 429)
If you see rate limit errors during import:
1. Add to `.env`: `YT_DLP_SKIP_SUBS=1`
2. This will use HTML caption fallback (still works great!)
3. Or add YouTube cookies: `YT_DLP_COOKIES_BROWSER=chrome`

## Next Steps

Possible enhancements:
- Export video with burned-in captions
- Word-by-word highlighting (karaoke style)
- Custom animation effects
- Import/export .srt or .vtt files
- Timing adjustments
- Multiple caption tracks
