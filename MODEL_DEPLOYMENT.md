# Model deployment

The two PhoBERT models are intentionally excluded from Git because their weight
files are large. A Render build obtains them from model ZIP archives instead.

Create one ZIP per model. Each ZIP must place its Hugging Face files at the ZIP
root, including `config.json`, tokenizer files, and either `model.safetensors`
or `pytorch_model.bin`.

Set the following Render environment variables before deploying:

| Variable | Purpose |
| --- | --- |
| `TENNIS_MODEL_URL` | Download URL for the Tennis PhoBERT ZIP |
| `TENNIS_MODEL_SHA256` | SHA-256 checksum for that ZIP |
| `ABSA_MODEL_URL` | Download URL for the ABSA PhoBERT ZIP |
| `ABSA_MODEL_SHA256` | SHA-256 checksum for that ZIP |

Use this Render build command:

```bash
bash scripts/download-models.sh && pip install -r requirements.txt
```

The script verifies each archive checksum and fails the build when a required
model is missing or malformed. Do not place credentials in this repository;
use Render secret environment variables for private download URLs or tokens.

The repository includes `render.yaml`. Import it as a Render Blueprint and
provide the four variables above when prompted. It intentionally starts with a
single Gunicorn worker so the model weights are not duplicated in memory.

## Vercel frontend

Deploy the same repository to Vercel as a Vite project with these settings:

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_BASE_URL=https://<your-render-service>.onrender.com` |

`vercel.json` provides the SPA fallback. `VITE_API_BASE_URL` is intentionally
public because Vite embeds it in browser JavaScript; never put secrets in it.
After the Vercel production URL is known, restrict Flask CORS to that URL in
the Render service configuration instead of leaving the default permissive
CORS policy in place.
