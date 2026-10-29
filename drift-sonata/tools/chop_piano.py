#!/usr/bin/env python3
"""Cuts piano recordings into single notes for DRIFT SONATA's Piano channel.

  python3 tools/chop_piano.py <out folder> <file> [<file> ...]

Every note start is found by spectral flux; the note runs to the next start (at most 4 s). Piano recordings are mostly
two hands and a pedal, so the files are read twice: as they are, and with what the left hand plays (below 190 Hz) cut
away, so a melody note above it stands alone. A note is kept only when it is one note, not a chord: its pitch (YIN,
just after the attack) is steady and nearly all of its energy sits on that pitch's harmonics. Of the notes on each key
the longest and cleanest are kept, each written as a 16-bit mono WAV, and piano.json gives its key, its length, how
bright it is and its partials: how strong each of the first 16 is and how fast it dies away. The page plays a note's
own attack, repitched to the key it needs, and lets it ring on in a tail made from those partials, so every key can
hold a long note. The recordings come from sample packs, so neither they nor the notes go into the repository;
build.py --piano embeds them.
"""
import json, os, subprocess, sys, wave

import numpy as np

SR = 44100
PER_KEY = 2
PARTIALS = 16
SHARE = .62  # how much of a note's energy must be on its own harmonics
LOW = 190  # Hz: what the left hand plays below this is cut away, so the melody notes stand alone


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def onsets(x):
    n, hop = 2048, 256
    frames = 1 + max(0, (len(x) - n) // hop)
    win = np.hanning(n)
    mag = np.abs(np.fft.rfft(np.stack([x[i * hop:i * hop + n] * win for i in range(frames)]), axis=1))
    flux = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(mag * 20), axis=0)).sum(axis=1)])
    out, last = [], -10**9
    for i in range(1, len(flux) - 1):
        lo, hi = max(0, i - 16), min(len(flux), i + 16)
        thr = np.median(flux[lo:hi]) * 1.6 + flux.max() * .08
        if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and (i - last) * hop > SR * .09:
            s = i * hop
            env = np.abs(x[max(0, s - 1024):s + 512])
            k = int(np.argmax(env > env.max() * .15)) if env.size else 0
            out.append(max(0, s - 1024 + k - int(SR * .003)))
            last = i
    return out


def yin(fr, fmin=50, fmax=1800):
    """f0 of one frame and how periodic it is (0..1)."""
    W = len(fr) // 2
    tmax, tmin = min(W - 1, SR // fmin), SR // fmax
    d = np.array([np.sum((fr[:W] - fr[t:t + W]) ** 2) for t in range(tmax + 1)])
    d[0] = 0
    c = np.ones_like(d)
    c[1:] = d[1:] * np.arange(1, tmax + 1) / np.maximum(np.cumsum(d[1:]), 1e-12)
    below = np.nonzero(c[tmin:] < .12)[0]
    t = tmin + (below[0] if below.size else int(np.argmin(c[tmin:])))
    while t + 1 <= tmax and c[t + 1] < c[t]: t += 1
    if 1 < t < tmax:
        a, b, cc = c[t - 1], c[t], c[t + 1]
        den = a - 2 * b + cc
        tt = t + (.5 * (a - cc) / den if abs(den) > 1e-9 else 0)
    else:
        tt = t
    return SR / tt, max(0., 1 - c[t])


def harmonic_share(h, f0, low):
    # how much of the energy (80 Hz - 6 kHz) is on f0's harmonics: one note is near 1, a chord much lower
    n = 1 << 15
    seg = h[:n] * np.hanning(min(len(h), n))
    spec = np.abs(np.fft.rfft(seg, n)) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f > max(80, low)) & (f < 6000)
    k = f / f0
    on = band & (np.abs(k - np.round(k)) < .035) & (np.round(k) >= 1)
    return float(spec[on].sum() / (spec[band].sum() + 1e-12))


def centroid(h):
    spec = np.abs(np.fft.rfft(h[:16384] * np.hanning(min(len(h), 16384)), 16384)) ** 2
    f = np.fft.rfftfreq(16384, 1 / SR)
    return float((spec * f).sum() / (spec.sum() + 1e-12))


def highpass(h, hz):
    # zero-phase: the bins fade in over an octave below hz
    n = 1 << int(np.ceil(np.log2(len(h) + 4096)))
    H = np.fft.rfft(np.pad(h, (0, n - len(h))))
    f = np.fft.rfftfreq(n, 1 / SR)
    H *= np.clip(np.log2(np.maximum(f, 1) / (hz / 2)), 0, 1)
    return np.fft.irfft(H, n)[:len(h)].astype(np.float32)


def notes_of(x, name, low, fmin, lo_midi, share_min, clar_min):
    x = highpass(x, low) if low else x
    on = onsets(x)
    out = []
    for k, s in enumerate(on):
        e = min(on[k + 1] if k + 1 < len(on) else len(x), s + 4 * SR)
        if e - s < SR * .3: continue
        h = x[s:e]
        if np.abs(h).max() < .02: continue
        # pitch in three frames after the attack: they must agree
        fs = [yin(h[a:a + 4096].astype(np.float64), fmin) for a in (int(SR * .04), int(SR * .09), int(SR * .15)) if a + 4096 <= len(h)]
        if len(fs) < 2: continue
        f0s = np.array([f for f, c in fs]); cl = min(c for f, c in fs)
        if cl < clar_min or np.ptp(12 * np.log2(f0s / f0s.mean())) > .35: continue
        f0 = float(np.median(f0s)); midi = 69 + 12 * np.log2(f0 / 440)
        if not lo_midi <= midi <= 100: continue
        share = harmonic_share(h[int(SR * .03):], f0, low)
        if share < share_min: continue
        out.append(dict(src=name, start=s, audio=h, midi=float(midi), f0=f0, share=share, clar=cl))
    return out


def partials(h, f0):
    # each partial's strength just after the attack, and how fast it falls (dB a second) by the end of the note
    def amps(at):
        seg = h[at:at + 4096]
        if len(seg) < 4096: seg = np.pad(seg, (0, 4096 - len(seg)))
        spec = np.abs(np.fft.rfft(seg * np.hanning(4096), 16384))
        f = np.fft.rfftfreq(16384, 1 / SR)
        out = []
        for n in range(1, PARTIALS + 1):
            fn = n * f0 * np.sqrt(1 + .0004 * n * n)
            band = (f > fn * .975) & (f < fn * 1.025)
            out.append(spec[band].max() if band.any() and fn < SR / 2 - 500 else 0.)
        return np.array(out)
    t1 = int(SR * .08); t2 = max(t1 + int(SR * .15), min(len(h) - 4096, int(SR * .9)))
    a1, a2 = amps(t1), amps(t2)
    top = a1.max() + 1e-12
    dt = (t2 - t1) / SR
    dec = np.clip((20 * np.log10(a1 + 1e-9) - 20 * np.log10(a2 + 1e-9)) / dt, 1.5, 60)
    return [[round(float(a / top), 4), round(float(d), 2)] for a, d in zip(a1, dec)]


def tidy(h):
    # a short fade in (the attack stays), the tail faded out over its last fifth, the peak brought to the same level
    h = h.copy()
    fi, fo = 48, max(64, len(h) // 5)
    h[:fi] *= np.linspace(0, 1, fi)
    h[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    return h / (np.abs(h).max() + 1e-9) * .89


def main():
    out_dir, files = sys.argv[1], sys.argv[2:]
    os.makedirs(out_dir, exist_ok=True)
    found = []
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0].split('-', 1)[-1]
        x = read(path)
        # as recorded, and with the left hand taken away; a note found both ways is kept once
        n = notes_of(x, name, 0, 50, 33, .72, .8)
        for c in notes_of(x, name, LOW, 150, 55, SHARE, .75):
            if not any(abs(c['start'] - d['start']) < SR * .05 for d in n): n.append(c)
        print(f'{name[:44]:44s} {len(n):3d} single notes')
        found += n
    by_key = {}
    for n in found: by_key.setdefault(int(round(n['midi'])), []).append(n)
    meta = []
    for key in sorted(by_key):
        best = sorted(by_key[key], key=lambda n: -(min(len(n['audio']) / SR, 2.5) + n['share'] * 2 + n['clar']))[:PER_KEY]
        for j, n in enumerate(best):
            h = tidy(n['audio'])
            fn = f'piano-{key}-{j + 1}.wav'
            w = wave.open(os.path.join(out_dir, fn), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(h, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
            meta.append(dict(file=fn, midi=round(n['midi'], 2), len=round(len(h) / SR, 3), bright=round(centroid(h)), src=n['src'], parts=partials(h, n['f0'])))
    json.dump(meta, open(os.path.join(out_dir, 'piano.json'), 'w'), indent=1)
    keys = sorted(by_key)
    print(len(meta), 'notes on', len(keys), 'keys', keys)


if __name__ == '__main__':
    main()
