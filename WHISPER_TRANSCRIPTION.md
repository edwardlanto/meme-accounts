# Whisper Transcription Integration

## Overview

Your video pipeline now automatically generates captions for any video using `whisper.cpp` when existing subtitles are not available.

## How It Works

When you clip a YouTube video:

1. **First**: Tries to download existing YouTube subtitles (fastest)
2. **Fallback**: If no subtitles found, automatically:
   - Extracts audio from the video as 16kHz mono WAV
   - Runs Whisper speech-to-text transcription
   - Converts the output to timed transcript format
   - Makes captions available in the video player

## Installation

### 1. Install whisper.cpp

```bash
brew install whisper-cpp
```

### 2. Download a model

```bash
npm run whisper:download
```

This downloads the `base.en` model (142 MB, recommended) to `~/.cache/whisper-cpp/`.

### 3. Configuration (optional)

Add to `.env` to customize:

```bash
# Model selection (default: base.en)
WHISPER_MODEL=base.en

# Model directory (default: ~/.cache/whisper-cpp)
WHISPER_MODELS_DIR=/path/to/models

# Whisper binary path (default: whisper-cli from PATH)
WHISPER_PATH=/opt/homebrew/bin/whisper-cli
```

## Available Models

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `tiny.en` | 75 MB | Fastest | Basic | Quick previews |
| `base.en` | 142 MB | Fast | Good | **Recommended** |
| `small.en` | 466 MB | Medium | Better | Professional use |
| `medium.en` | 1.5 GB | Slow | High | High accuracy needed |

To download a different model:

```bash
npm run whisper:download small.en
```

## Technical Details

### Audio Extraction

FFmpeg extracts audio with these settings:
- Format: 16-bit PCM WAV
- Sample rate: 16 kHz
- Channels: Mono
- Optimized for Whisper input

### Transcription Command

```bash
whisper-cli \
  -m /path/to/ggml-base.en.bin \
  -f audio.wav \
  -osrt \
  -nt \
  -l en
```

### Performance

- **Tiny model**: ~2-3x real-time (30s video = 10s transcription)
- **Base model**: ~1x real-time (30s video = 30s transcription)
- **Small model**: ~0.5x real-time (30s video = 60s transcription)

Your M2/M3 Mac will use Metal GPU acceleration automatically.

## Caption System Integration

Transcriptions integrate seamlessly with your existing caption system:

1. Generated SRT files are parsed into timed segments
2. Captions synchronize automatically with video playback
3. All caption templates, fonts, and styling work identically
4. Drag-and-drop positioning works the same way

## When Whisper Runs

Whisper transcription only runs when:
- ✓ No existing YouTube subtitles found
- ✓ whisper-cli is installed
- ✓ Model file exists

Otherwise, it gracefully skips (no errors).

## Troubleshooting

### "Whisper model not found"

Run:
```bash
npm run whisper:download
```

### "whisper-cli not available"

Install:
```bash
brew install whisper-cpp
```

### Transcription takes too long

Use a faster model:
```bash
npm run whisper:download tiny.en
```

Then set in `.env`:
```bash
WHISPER_MODEL=tiny.en
```

### Transcription fails

Check the server logs for details. Common issues:
- Audio extraction failed (check FFmpeg)
- Model file corrupted (re-download)
- Timeout (video too long, use faster model)

## Files Modified

- `src/lib/server/video-pipeline.ts`: Added extraction and transcription functions
- `scripts/download-whisper-model.sh`: Model download script
- `package.json`: Added `whisper:download` script
- `.env.example`: Documented Whisper configuration

## Next Steps

Try clipping a video without subtitles and see captions generated automatically!
