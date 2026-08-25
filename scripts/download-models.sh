#!/usr/bin/env bash
# Download fine-tuned model archives during a Render build.
# Each ZIP must contain the Hugging Face model files directly at its root:
# config.json, tokenizer files, and model.safetensors (or pytorch_model.bin).

set -euo pipefail

if [[ "${FREE_DEMO_MODE:-false}" == "true" ]]; then
  echo "FREE_DEMO_MODE is enabled; skipping PhoBERT model downloads."
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

download_model() {
  local label="$1"
  local destination="$2"
  local url="$3"
  local expected_sha256="$4"

  if [[ -f "$destination/model.safetensors" || -f "$destination/pytorch_model.bin" ]]; then
    if [[ ! -f "$destination/config.json" ]]; then
      echo "$label model is missing config.json." >&2
      exit 1
    fi
    echo "$label model is already present; skipping download."
    return
  fi

  if [[ -z "$url" || -z "$expected_sha256" ]]; then
    echo "Missing $label model. Set its URL and SHA-256 environment variables before building." >&2
    exit 1
  fi

  local archive
  archive="$(mktemp)"
  trap 'rm -f "$archive"' RETURN

  echo "Downloading $label model..."
  curl --fail --location --retry 3 --silent --show-error "$url" --output "$archive"
  echo "$expected_sha256  $archive" | sha256sum --check --status

  rm -rf "$destination"
  mkdir -p "$destination"
  unzip -q "$archive" -d "$destination"

  if [[ ! -f "$destination/config.json" ]] || \
     [[ ! -f "$destination/model.safetensors" && ! -f "$destination/pytorch_model.bin" ]]; then
    echo "$label archive has an invalid layout. It must contain model files at the ZIP root." >&2
    exit 1
  fi
}

download_model \
  "Tennis PhoBERT" \
  "$ROOT_DIR/phobert_tennis_saved" \
  "${TENNIS_MODEL_URL:-}" \
  "${TENNIS_MODEL_SHA256:-}"

download_model \
  "ABSA PhoBERT" \
  "$ROOT_DIR/Apriori/phobert_absa_model" \
  "${ABSA_MODEL_URL:-}" \
  "${ABSA_MODEL_SHA256:-}"
