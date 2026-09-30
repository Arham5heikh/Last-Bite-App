"""Generate voice-over clips with Kokoro TTS.

Usage: python tts.py lines.json [voice]
lines.json: [{"text": "...", "out": "/path/to/clip.wav"}, ...]
Prints [{"out": ..., "seconds": ...}, ...] as JSON on stdout.
"""

import json
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

lines_path = sys.argv[1]
voice = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
kokoro = Kokoro(
    os.environ.get("KOKORO_MODEL", "kokoro-v1.0.int8.onnx"),
    os.environ.get("KOKORO_VOICES", "voices-v1.0.bin"),
)

results = []
for line in json.load(open(lines_path)):
    samples, sample_rate = kokoro.create(line["text"], voice=voice, speed=1.0, lang="en-us")
    sf.write(line["out"], samples, sample_rate)
    results.append({"out": line["out"], "seconds": len(samples) / sample_rate})

print(json.dumps(results))
