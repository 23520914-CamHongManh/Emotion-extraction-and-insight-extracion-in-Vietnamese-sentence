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
single Gunicorn worker so the model weights are not duplicated in memory. The
backend unloads the inactive PhoBERT model before it loads the other one when
full mode is enabled. The full configuration requires Render Standard 2 GB or
higher. To keep runtime memory bounded, it accepts CSV files up to 2 MB and 50
rows by default; adjust `MAX_UPLOAD_BYTES` and `MAX_APRIORI_ROWS` only after
reviewing Render memory metrics.

## Render Free demo

The committed `render.yaml` is configured for Render Free. It starts in
`FREE_DEMO_MODE`, skips model downloads, and supports CatBoost predictions from
manual feature selectors only. Text-driven PhoBERT extraction and Apriori/ABSA
return HTTP 503 by design, so the 512 MB instance is not asked to load models.
It does not require any model URL or checksum variables.

To restore the full application, set `FREE_DEMO_MODE=false`, change the plan
to `standard` or higher, then add the four model URL/checksum variables listed
above to the Render service.

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
