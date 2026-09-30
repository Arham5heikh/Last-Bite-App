# Walkthrough videos

Renders the narrated "How it works" videos into `public/videos/`:

- `last-bite-customers.mp4`: finding, claiming and picking up a deal
- `last-bite-restaurants.mp4`: kitchen PIN login, dropping surplus, redeeming a customer PIN

Each video opens and closes with the animated logo sting (`sting.html`). The voice-over is
generated with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) text-to-speech. No
captions are added. The narration and on-screen actions live in `scenes.mjs`.

## One-time setup

```bash
bun add -d playwright            # or: npm i -D playwright && npx playwright install chromium
python3 -m venv .venv-tts && .venv-tts/bin/pip install kokoro-onnx soundfile
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

You also need `ffmpeg` with libx264 on your PATH (or point `FFMPEG` at it).

## Render

```bash
npm run dev    # in another terminal; the app must be on http://localhost:3000

export TTS_PYTHON=.venv-tts/bin/python KOKORO_MODEL=kokoro-v1.0.int8.onnx KOKORO_VOICES=voices-v1.0.bin
npm run video -- customer
npm run video -- restaurant
```

Options (environment variables):

| Variable | Default | Purpose |
|---|---|---|
| `VOICE` | `af_heart` | Kokoro voice, e.g. `am_michael` for a male voice |
| `FFMPEG` | `ffmpeg` | Path to ffmpeg |
| `VIDEO_WORK_DIR` | `.video-work/` | Scratch space for frames and audio |

Render on a network that can reach `images.unsplash.com` and `*.tile.openstreetmap.org`,
or the food photos and map tiles will be missing from the footage.
