#!/usr/bin/env bash
# Download whisper.cpp model for transcription
# Usage: ./scripts/download-whisper-model.sh [model-name]
# Default: base.en

set -e

MODEL="${1:-base.en}"
MODELS_DIR="${WHISPER_MODELS_DIR:-$HOME/.cache/whisper-cpp}"
mkdir -p "$MODELS_DIR"

MODEL_FILE="ggml-${MODEL}.bin"
MODEL_PATH="$MODELS_DIR/$MODEL_FILE"

if [ -f "$MODEL_PATH" ]; then
  echo "✓ Model already exists: $MODEL_PATH"
  exit 0
fi

echo "Downloading whisper model: $MODEL"
echo "Destination: $MODEL_PATH"

# Download from official whisper.cpp repository
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL_FILE"

if command -v curl &> /dev/null; then
  curl -L -o "$MODEL_PATH" "$URL"
elif command -v wget &> /dev/null; then
  wget -O "$MODEL_PATH" "$URL"
else
  echo "Error: curl or wget required"
  exit 1
fi

echo "✓ Model downloaded successfully: $MODEL_PATH"
echo ""
echo "Available models:"
echo "  - tiny.en (75 MB, fastest)"
echo "  - base.en (142 MB, recommended)"
echo "  - small.en (466 MB, more accurate)"
echo "  - medium.en (1.5 GB, high accuracy)"
echo ""
echo "To use a different model, set in .env:"
echo "WHISPER_MODEL=base.en"
echo "WHISPER_MODELS_DIR=$MODELS_DIR"
