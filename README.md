# Social Poster

AI-powered social media content creation tool with video clipping and automatic captioning.

## Features

- **AI Content Generation**: Generate social media posts, news summaries, video stories
- **Video Clipping**: Download and clip YouTube videos with AI-powered analysis
- **Automatic Captions**: Speech-to-text transcription with customizable styling
- **Multi-Template Support**: News, Tweets, Video Stories, and more
- **Social Media Integration**: Post directly to platforms via Zernio
- **Asset Management**: Upload and manage images via Unsplash, Pexels

## Quick Start

### Prerequisites

1. **Node.js**: v18 or higher
2. **FFmpeg**: For video processing
3. **yt-dlp**: For YouTube downloads
4. **whisper.cpp**: For automatic captions (optional)

Install video tools:

```bash
brew install ffmpeg yt-dlp whisper-cpp
```

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Download Whisper model for captions
npm run whisper:download

# Run development server
npm run dev
```

### Environment Setup

Required variables in `.env`:

```bash
# Database
DATABASE_URL=your-supabase-url
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key

# AI & Video
VERTEX_PROJECT_ID=your-google-cloud-project
GOOGLE_APPLICATION_CREDENTIALS=./path/to/credentials.json

# Storage
CLOUDFLARE_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=your-bucket

# Social Media (optional)
ZERNIO_API_KEY=your-zernio-key
```

See `.env.example` for all available options.

## Video & Captions

### YouTube Video Clipping

```typescript
// Videos are automatically analyzed by Google Gemini
// Clips are extracted based on content analysis
// Subtitles are downloaded when available
```

### Automatic Transcription

When YouTube subtitles aren't available, Whisper automatically generates captions:

1. Extracts audio from video
2. Runs speech-to-text with `whisper.cpp`
3. Creates timed captions
4. Syncs with video playback

Configuration:

```bash
# Choose model: tiny.en, base.en, small.en, medium.en
WHISPER_MODEL=base.en

# Model location (default: ~/.cache/whisper-cpp)
WHISPER_MODELS_DIR=/path/to/models
```

See [WHISPER_TRANSCRIPTION.md](./WHISPER_TRANSCRIPTION.md) for details.

### Caption Customization

- Multiple caption templates
- Font selection
- Size, color, background customization
- Stroke/outline effects
- Drag-and-drop positioning
- Real-time preview

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run whisper:download # Download Whisper model
npm run worker:scheduler # Run BullMQ scheduler worker
```

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── studio/           # Studio asset management
│   │   ├── templates/        # Social media templates
│   │   └── video-clips/      # Video & caption UI
│   ├── server/
│   │   └── video-pipeline.ts # Video processing logic
│   ├── video-clips/
│   │   ├── caption-sync.ts   # Caption timing
│   │   └── caption-templates.ts
│   └── templates.ts          # Template definitions
├── routes/
│   ├── api/                  # API endpoints
│   └── dashboard/            # Dashboard pages
└── worker/                   # Background job workers

supabase/
└── migrations/              # Database schema

scripts/
└── download-whisper-model.sh # Model downloader
```

## Tech Stack

- **Frontend**: SvelteKit, Tailwind CSS, bits-ui
- **Backend**: SvelteKit server routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2
- **AI**: Google Vertex AI (Gemini)
- **Video**: FFmpeg, yt-dlp, whisper.cpp
- **Jobs**: BullMQ with Redis

## Documentation

- [Caption Feature](./CAPTION_FEATURE.md) - Initial caption implementation
- [Caption System Enhanced](./CAPTION_SYSTEM_ENHANCED.md) - Advanced caption features
- [Whisper Transcription](./WHISPER_TRANSCRIPTION.md) - Auto caption generation
- [YouTube Rate Limit Fix](./YOUTUBE_RATE_LIMIT_FIX.md) - Subtitle download fixes

## Development

```bash
# Type checking
npm run check

# Watch mode
npm run check:watch

# Database migrations
supabase db push
```

## Deployment

This project uses `@sveltejs/adapter-auto` which automatically adapts to your deployment platform:

- Vercel
- Netlify
- Cloudflare Pages
- Node.js servers

See [SvelteKit adapters](https://svelte.dev/docs/kit/adapters) for more options.

---

Built with SvelteKit 🚀
