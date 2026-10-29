#!/usr/bin/env python3
"""Prepares whispers and close foley for DRIFT SONATA's ASMR channel.

  python3 tools/chop_asmr.py <out folder> <file> [<file> ...]

The ASMR channel never plays a recording as it is: it takes grains from it (20 to 400 ms), turned round, moved up or
down, stuttered, and throws them round your head, so no word survives. What it needs is the material, so every file
is trimmed of its silence (a long one to its busiest 1.5 s of foley or 2 s of voice), brought to the same peak and laid one after
another (with a little silence between) into a single mono WAV, asmr.wav. asmr.json gives each piece's place in it,
whether it is a voice (a one-word file, or whisper, vocal or dialogue in its name) or foley (mouth sounds, tea, pencil, buttons,
water ...), and the moments inside it worth starting a grain on: the hiss of a consonant or a breath (bright and noisy),
and the voiced middle of a hum (darker). The recordings are
the user's own, so neither they nor asmr.wav go into the repository; build.py --asmr embeds it.
"""
import json, os, re, subprocess, sys, wave

import numpy as np

SR = 44100
GAP = int(SR * .05)
KEEP = {'foley': float(os.environ.get('KEEP_FOLEY', 1.5)), 'voice': float(os.environ.get('KEEP_VOICE', 2.0))}  # seconds kept of a long recording: its busiest stretch (most clicks, crackles, syllables)
VOICE = re.compile(r'whisper|vocal|dialogue', re.I)  # and every short one-word file


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main():
    out_dir, files = sys.argv[1], sys.argv[2:]
    os.makedirs(out_dir, exist_ok=True)
    parts, meta, pos = [], [], 0
    for path in files:
        name = re.sub(r'^[0-9a-f]{8}-', '', os.path.splitext(os.path.basename(path))[0])
        x = read(path)
        env = np.abs(x); peak = env.max() + 1e-9
        on = np.nonzero(env > peak * .01)[0]
        if not on.size: continue
        x = x[max(0, on[0] - 200):on[-1] + 2000]
        kind = 'voice' if VOICE.search(name) or re.fullmatch(r'[A-Za-z]{1,8}', name) else 'foley'
        if len(x) > KEEP[kind] * SR:
            # the stretch with the most going on: the sum of the rises in a short spectrum, frame by frame
            hop, n = 512, 1024
            fr = np.stack([x[i:i + n] * np.hanning(n) for i in range(0, len(x) - n, hop)])
            lm = np.log1p(np.abs(np.fft.rfft(fr, axis=1)) * 20)
            flux = np.concatenate([[0], np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)])
            w = int(KEEP[kind] * SR / hop); cs = np.concatenate([[0], np.cumsum(flux)])
            k = int(np.argmax(cs[w:] - cs[:-w])) if len(cs) > w else 0
            x = x[k * hop:k * hop + int(KEEP[kind] * SR)]
            fi = int(SR * .02); x[:fi] *= np.linspace(0, 1, fi); x[-fi:] *= np.linspace(1, 0, fi)
        x = x / (np.abs(x).max() + 1e-9) * .89
        # every 10 ms: how loud, how bright and how noisy, to find the hiss and the hum
        hop, win = 441, 1024
        hiss, hum = [], []
        for i in range(0, len(x) - win, hop):
            f = x[i:i + win] * np.hanning(win)
            rms = float(np.sqrt(np.mean(f ** 2)))
            if rms < .02: continue
            spec = np.abs(np.fft.rfft(f)) ** 2 + 1e-12
            fr = np.fft.rfftfreq(win, 1 / SR)
            cen = float((spec * fr).sum() / spec.sum())
            flat = float(np.exp(np.mean(np.log(spec[5:400]))) / np.mean(spec[5:400]))
            t = round((pos + i) / SR, 3)
            if cen > 3500 and flat > .05: hiss.append(t)
            elif cen < 2000: hum.append(t)
        meta.append(dict(name=name, kind=kind, start=round(pos / SR, 4), len=round(len(x) / SR, 4), hiss=hiss[::2], hum=hum[::2]))
        parts += [x, np.zeros(GAP, np.float32)]
        pos += len(x) + GAP
        print(f'{name:16s} {len(x) / SR:5.2f} s  hiss {len(hiss):3d}  hum {len(hum):3d}')
    audio = np.concatenate(parts) if parts else np.zeros(1, np.float32)
    w = wave.open(os.path.join(out_dir, 'asmr.wav'), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
    json.dump(dict(pieces=meta), open(os.path.join(out_dir, 'asmr.json'), 'w'), indent=1)
    print(len(meta), 'pieces,', round(len(audio) / SR, 1), 's')


if __name__ == '__main__':
    main()
