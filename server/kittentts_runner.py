#!/usr/bin/env python3
"""Generate speech audio using KittenTTS and write a WAV to stdout.

Usage:
  python3 server/kittentts_runner.py --model KittenML/kitten-tts-mini-0.8 --voice Jasper --text "hello"

Notes:
- This script is designed to be invoked by the Node backend on-demand.
- It intentionally prints errors to stderr and exits non-zero on failure.
"""

import argparse
import sys
import wave


def _to_int16(audio):
    # audio is typically float32 numpy array in [-1, 1]
    try:
        import numpy as np
    except Exception as e:
        raise RuntimeError("numpy is required") from e

    a = np.asarray(audio)
    if a.dtype.kind == 'f':
        a = np.clip(a, -1.0, 1.0)
        a = (a * 32767.0).astype('int16')
    elif a.dtype != 'int16':
        a = a.astype('int16')
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voice', required=True)
    ap.add_argument('--text', required=True)
    ap.add_argument('--sample-rate', type=int, default=24000)
    args = ap.parse_args()

    try:
        from kittentts import KittenTTS
    except Exception as e:
        print("Failed to import kittentts. Did you install the wheel?", file=sys.stderr)
        raise

    try:
        m = KittenTTS(args.model)
        audio = m.generate(args.text, voice=args.voice)
        pcm = _to_int16(audio)

        # Write WAV to stdout
        out = sys.stdout.buffer
        with wave.open(out, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # int16
            wf.setframerate(args.sample_rate)
            wf.writeframes(pcm.tobytes())

    except Exception as e:
        print(f"kittentts_runner error: {e}", file=sys.stderr)
        raise


if __name__ == '__main__':
    main()
