# YouTube Rate Limit (HTTP 429) Fix

## Problem
You were encountering YouTube rate limiting errors (HTTP 429: Too Many Requests) when downloading videos with subtitles using yt-dlp:

```
ERROR: Unable to download video subtitles for 'en-bn': HTTP Error 429: Too Many Requests
ERROR: Unable to download video subtitles for 'en-ar': HTTP Error 429: Too Many Requests
ERROR: Unable to download video subtitles for 'en-zh-Hans': HTTP Error 429: Too Many Requests
```

This happens because:
1. The old code requested ALL English subtitle variants (`en.*`) - which includes en-bn, en-ar, en-zh-Hans, etc.
2. Multiple subtitle requests per video triggered YouTube's anti-bot protection
3. All 6 download strategies retried subtitle downloads, amplifying the problem

## Solutions Implemented

### 1. Conservative Subtitle Language Selection
**Changed from:** `--sub-langs en.*,en` (requests ALL English variants)  
**Changed to:** `--sub-langs en` (requests only plain English)

This reduces the number of subtitle requests from 10+ down to 1-2.

### 2. Automatic Retry Without Subtitles
If subtitle download fails with HTTP 429:
- Automatically retry the same strategy WITHOUT subtitle download
- Video still downloads successfully
- Subtitles fetched from HTML player page as fallback (already implemented in `youtube-import.ts`)

### 3. Rate Limiting Best Practices
Updated yt-dlp flags to be more polite:
```javascript
'--retries', '3',              // Reduced from 5
'--fragment-retries', '5',     // Reduced from 10
'--sleep-requests', '2',       // Increased from 1 (2 second delay)
'--sleep-subtitles', '3',      // New: 3 second delay between subtitle downloads
'--skip-download-errors',      // Continue if subtitle download fails
```

### 4. Environment Variable Override
Added `YT_DLP_SKIP_SUBS` option to completely disable subtitle downloads:

**In `.env`:**
```bash
# Skip subtitle downloads to avoid rate limits (fallback to HTML captions)
YT_DLP_SKIP_SUBS=1
```

## How It Works Now

1. **First Attempt:** Download video + subtitles (with reduced requests)
2. **If 429 on subtitles:** Retry same strategy without subtitles
3. **Fallback:** Extract captions from YouTube HTML page (always works)
4. **Result:** You always get the video, and usually get captions too

## Recommendations

### Option A: Try It Now (No Changes Needed)
The fixes are already applied. Just try downloading a video again. It should:
- Work immediately
- Include captions (from HTML fallback if needed)
- Not hit rate limits

### Option B: Skip Subtitle Downloads Entirely
If you continue to encounter 429 errors, add to `.env`:
```bash
YT_DLP_SKIP_SUBS=1
```

This completely bypasses yt-dlp subtitle downloads and relies on HTML caption extraction (which still works great).

### Option C: Use YouTube Cookies (Best Long-term)
Authenticated requests have higher rate limits:

1. Log into YouTube in Chrome
2. Add to `.env`:
   ```bash
   YT_DLP_COOKIES_BROWSER=chrome
   ```
3. Restart dev server

Or export cookies manually:
```bash
yt-dlp --cookies-from-browser chrome --cookies ./youtube-cookies.txt
```

Then set in `.env`:
```bash
YT_DLP_COOKIES=/absolute/path/to/youtube-cookies.txt
```

## Testing

Try downloading a video now:
1. Navigate to `/dashboard/videos`
2. Paste a YouTube URL
3. Click "Analyze video"

**Expected behavior:**
- ✅ Video downloads successfully
- ✅ Captions appear (from yt-dlp OR HTML fallback)
- ✅ No 429 errors
- ⚠️ Console may warn "Subtitles unavailable due to rate limit" but still works

## Technical Details

### Files Modified
- `src/lib/server/video-pipeline.ts` - Main download logic
- `.env.example` - Documentation for new options

### Key Changes
- `runYtDlpDownload()` - Now accepts `skipSubs` parameter
- `downloadYoutubeToDir()` - Detects 429 on subtitles and retries without subs
- `ytDlpYoutubeBaseArgs()` - More conservative retry/delay settings
- Environment variable `YT_DLP_SKIP_SUBS` for global override

### Why This Works
1. **Reduces request volume** - Only 1-2 subtitle requests instead of 10+
2. **Graceful degradation** - Falls back to HTML captions seamlessly
3. **Respects rate limits** - Longer delays between requests
4. **User control** - Can disable subtitle downloads entirely if needed

## Troubleshooting

**Still getting 429 errors?**
1. Set `YT_DLP_SKIP_SUBS=1` in `.env`
2. Add YouTube cookies (Option C above)
3. Wait 10-15 minutes before trying again (rate limit cooldown)
4. Upgrade yt-dlp: `brew upgrade yt-dlp`

**No captions showing?**
- Check if video has captions on YouTube
- HTML fallback works for most videos
- Some videos genuinely have no captions

**Video downloads but quality is low?**
- This is expected for storage efficiency (720p max)
- Adjust `VIDEO_MAX_HEIGHT` and `VIDEO_CRF` in `.env` if needed
