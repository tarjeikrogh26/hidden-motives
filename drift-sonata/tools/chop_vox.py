#!/usr/bin/env python3
"""Cuts vocals into wordless pieces for DRIFT SONATA's Vox channel.

  python3 tools/chop_vox.py <out folder> <name>=<file> [<name>=<file> ...]

Nothing that could be a word survives: what is kept is
  tone    held vowels and hums (pitch steady), 120-700 ms, to be stretched into clouds and tuned to the chords
  frag    the start of a syllable, 50-200 ms: a bit of a word, cut before it becomes one
  breath  breaths and air between the phrases, 100-450 ms
  chord   a sung chord or harmony arpeggio (its key in the file name, like ..._choir_Gmaj.wav): soft windows
          tuned by the root of that key
Each piece gets its singer, its pitch (from a YIN pitch track) and its brightness, and is written as a 16-bit mono WAV
with vox.json describing them. Pieces are spread over the whole recording and never taken next to each other, so the
page cannot put a word back together. The recordings are the singers' own, so none of this goes into the repository;
build.py --vox embeds it.
"""
import json, os, subprocess, sys, wave

import numpy as np

SR = 44100
HOP, WIN = 256, 2048
TAKE = {'tone': 48, 'frag': 44, 'breath': 14}
KEYS = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def chord_windows(x, name, root, minor, lo=.6, hi=1.6):
    # windows over the sustained part of a sung chord (0.6-1.6 s) or a sung harmony arpeggio (shorter), overlapping, faded long
    rms = np.array([np.sqrt(np.mean(x[i:i + 2048] ** 2)) for i in range(0, max(1, len(x) - 2048), 1024)])
    on = np.nonzero(rms > rms.max() * .25)[0]
    a, b = (on[0] * 1024, on[-1] * 1024 + 2048) if on.size else (0, len(x))
    out, rng, t = [], np.random.default_rng(len(x)), a + int(.05 * SR)
    while t < b - int(lo * SR):
        L = int(SR * rng.uniform(lo, hi)); L = min(L, b - t)
        h = fade(x[t:t + L], 40 if lo < .5 else 120, 120 if lo < .5 else 300); h = h / (np.abs(h).max() + 1e-9) * .89
        out.append(dict(kind='chord', singer=name, midi=60 + root, minor=minor, len=round(len(h) / SR, 3), bright=round(centroid(h)), audio=h))
        t += int(L * .55)
    return out


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def pitch_track(x):
    """YIN per frame: f0 in Hz (0 where unvoiced) and how periodic each frame is (0..1)."""
    frames = 1 + (len(x) - WIN) // HOP
    tau_min, tau_max = SR // 900, SR // 70
    f0 = np.zeros(frames); clar = np.zeros(frames); rms = np.zeros(frames)
    for s in range(0, frames, 2048):
        idx = np.arange(s, min(frames, s + 2048))
        fr = np.stack([x[i * HOP:i * HOP + WIN] for i in idx]).astype(np.float64)
        rms[idx] = np.sqrt((fr ** 2).mean(axis=1))
        F = np.fft.rfft(fr, 2 * WIN)
        ac = np.fft.irfft(F * np.conj(F))[:, :tau_max + 1]
        cs = np.cumsum(fr ** 2, axis=1)
        e0 = cs[:, WIN - tau_max - 1]
        # difference function, approximated over the first WIN - tau_max samples
        d = np.empty((len(idx), tau_max + 1))
        win = WIN - tau_max
        cs2 = np.concatenate([np.zeros((len(idx), 1)), cs], axis=1)
        for t in range(tau_max + 1):
            et = cs2[:, t + win] - cs2[:, t]
            d[:, t] = e0 + et - 2 * ac[:, t]
        d[:, 0] = 0
        cmnd = d[:, 1:] * np.arange(1, tau_max + 1) / np.maximum(np.cumsum(d[:, 1:], axis=1), 1e-12)
        cmnd = np.concatenate([np.ones((len(idx), 1)), cmnd], axis=1)
        for j, i in enumerate(idx):
            c = cmnd[j]
            below = np.nonzero(c[tau_min:] < .15)[0]
            if below.size:
                t = tau_min + below[0]
                while t + 1 <= tau_max and c[t + 1] < c[t]: t += 1
            else:
                t = tau_min + int(np.argmin(c[tau_min:]))
            clar[i] = max(0, 1 - c[t])
            if c[t] < .25 and 1 < t < tau_max:
                a, b, cc = c[t - 1], c[t], c[t + 1]
                den = a - 2 * b + cc
                tt = t + (.5 * (a - cc) / den if abs(den) > 1e-9 else 0)
                f0[i] = SR / tt
    return f0, clar, rms


def centroid(h):
    spec = np.abs(np.fft.rfft(h * np.hanning(len(h)), 8192)) ** 2
    f = np.fft.rfftfreq(8192, 1 / SR)
    return float((spec * f).sum() / (spec.sum() + 1e-12))


def onsets(x, rms):
    # syllable starts: where the level jumps after a dip
    lv = 20 * np.log10(rms + 1e-6)
    out = []
    for i in range(4, len(lv) - 2):
        if lv[i] - lv[i - 4] > 7 and lv[i] > -38 and lv[i] >= lv[i + 1] - 1 and (not out or i - out[-1] > 10):
            out.append(i)
    return out


def fade(h, fi_ms, fo_ms):
    h = h.copy()
    fi, fo = min(len(h) // 3, int(SR * fi_ms / 1000)), min(len(h) // 3, int(SR * fo_ms / 1000))
    if fi: h[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    if fo: h[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    return h


def cut(x, name, rng):
    f0, clar, rms = pitch_track(x)
    n = len(f0)
    voiced = (f0 > 0) & (clar > .7) & (rms > .01)
    midi = np.where(f0 > 0, 69 + 12 * np.log2(np.maximum(f0, 1) / 440), 0)
    cand = {'tone': [], 'frag': [], 'breath': []}
    # tones: runs of voiced frames whose pitch stays within a semitone
    i = 0
    while i < n:
        if not voiced[i]: i += 1; continue
        j = i
        while j + 1 < n and voiced[j + 1] and abs(midi[j + 1] - np.median(midi[i:j + 1])) < 1: j += 1
        dur = (j - i + 1) * HOP / SR
        if dur >= .12:
            # keep the steady middle, at most 700 ms
            a = i + int((j - i) * .12); b = min(j - int((j - i) * .1), a + int(.7 * SR / HOP))
            if (b - a) * HOP / SR >= .12:
                cand['tone'].append((a * HOP, (b - a) * HOP + WIN // 2, float(np.median(midi[a:b + 1])), float(clar[a:b + 1].mean()), float(rms[a:b + 1].mean())))
        i = j + 1
    # fragments: the first 50-200 ms after a syllable starts
    for o in onsets(x, rms):
        L = int(SR * rng.uniform(.05, .2))
        seg = slice(o, o + L // HOP + 1)
        m = midi[seg][voiced[seg]]
        cand['frag'].append((o * HOP, L, float(np.median(m)) if m.size else 0., float(clar[seg].mean()), float(rms[seg].mean())))
    # breaths: unvoiced, quiet but not silent, noisy
    i = 0
    while i < n:
        if voiced[i] or not (.004 < rms[i] < .05): i += 1; continue
        j = i
        while j + 1 < n and not voiced[j + 1] and .004 < rms[j + 1] < .05: j += 1
        dur = (j - i + 1) * HOP / SR
        if .1 <= dur:
            L = min(int(.45 * SR), (j - i + 1) * HOP)
            cand['breath'].append((i * HOP, L, 0., 0., float(rms[i:j + 1].mean())))
        i = j + 1
    picked = []
    # pieces at least 1.2 s apart in a long recording, closer in a short phrase (still never touching)
    gap = int(SR * max(.3, min(1.2, len(x) / SR / 40)))
    for kind, lst in cand.items():
        # the strongest and clearest first, spread over the recording, never two next to each other
        lst.sort(key=lambda c: -(c[3] * 2 + min(c[4], .1) * 10 if kind != 'breath' else c[4]))
        taken = []
        for c in lst:
            if len(taken) >= TAKE[kind]: break
            if any(abs(c[0] - t[0]) < gap for t in taken): continue
            taken.append(c)
        for c in taken: picked.append((kind, c))
    out = []
    for kind, (start, L, m, cl, lv) in sorted(picked, key=lambda p: p[1][0]):
        h = x[start:start + L]
        if len(h) < SR * .04: continue
        h = fade(h, 4 if kind == 'frag' else 25, 25 if kind == 'frag' else 60)
        peak = np.abs(h).max() + 1e-9
        h = h / peak * (.7 if kind == 'breath' else .89)
        out.append(dict(kind=kind, singer=name, midi=round(m, 2), len=round(len(h) / SR, 3), bright=round(centroid(h)), audio=h))
    return out


def main():
    out_dir, pairs = sys.argv[1], sys.argv[2:]
    os.makedirs(out_dir, exist_ok=True)
    rng = np.random.default_rng(11)
    meta = []
    for pair in pairs:
        name, path = pair.split('=', 1)
        import re
        key = re.search(r'_([A-G][b#]?)(maj|min)', os.path.basename(path))
        if key:  # a sung chord or harmony arpeggio, in the key its name gives
            arp = 'arp' in os.path.basename(path).lower()
            pieces = chord_windows(read(path), name, KEYS[key.group(1)], key.group(2) == 'min', *((.25, .8) if arp else (.6, 1.6)))
        else:
            pieces = cut(read(path), name, rng)
        for k, p in enumerate(pieces):
            fn = f"{name.lower().replace(' ', '-')}-{p['kind']}-{k + 1:03d}.wav"
            w = wave.open(os.path.join(out_dir, fn), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(p['audio'], -1, 1) * 32767).astype('<i2').tobytes()); w.close()
            meta.append({k2: v for k2, v in p.items() if k2 != 'audio'} | {'file': fn})
        counts = {}
        for p in pieces: counts[p['kind']] = counts.get(p['kind'], 0) + 1
        print(name, counts, 'pitch range', min((p['midi'] for p in pieces if p['midi']), default=0), max((p['midi'] for p in pieces), default=0))
    json.dump(meta, open(os.path.join(out_dir, 'vox.json'), 'w'), indent=1)
    print(len(meta), 'pieces')


if __name__ == '__main__':
    main()
