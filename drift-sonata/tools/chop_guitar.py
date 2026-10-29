#!/usr/bin/env python3
"""Cuts guitar recordings into short phrases for DRIFT SONATA's Guitar channel.

  python3 tools/chop_guitar.py <out folder> <file> [<file> ...]
  KEEP=4 python3 tools/chop_guitar.py ...   (keep less of each recording)

The World channel's recordings (cümbüş, oud, ruan ...) are cut the same way.

A guitar rings: its notes lie over each other, so it is cut into phrases rather than notes. Every phrase starts on an
attack (spectral flux) in the liveliest stretch of the recording (8 s are kept of each, two stretches of 4 s from a
long one, written as WAV), and runs one, two or four beats of the recording's own tempo (from its name, or from how far
apart its attacks are), ending just before the next attack. For each phrase guitar.json gives its stretch and where in
it the phrase starts, its pitch classes (a chroma: how much of each of the twelve it holds), how many attacks it has,
how bright it is, and whether it is a strum (all strings at once) or picked. The page moves a phrase by a few
semitones to whatever chord is playing, choosing the phrase whose notes fit that chord best. The recordings come from
sample packs, so neither they nor the phrases go into the repository; build.py --guitar embeds them.
"""
import json, os, re, subprocess, sys, wave

import numpy as np

SR = 44100
PER_FILE = 22
KEEP = float(os.environ.get('KEEP', 8))  # seconds of each recording kept: its liveliest stretch (two shorter ones from a long recording)


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def onsets(x):
    n, hop = 2048, 256
    frames = 1 + max(0, (len(x) - n) // hop)
    win = np.hanning(n)
    mag = np.abs(np.fft.rfft(np.stack([x[i * hop:i * hop + n] * win for i in range(frames)]), axis=1))
    flux = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(mag * 20), axis=0)).sum(axis=1)])
    out, strength, last = [], [], -10**9
    for i in range(1, len(flux) - 1):
        lo, hi = max(0, i - 16), min(len(flux), i + 16)
        thr = np.median(flux[lo:hi]) * 1.5 + flux.max() * .07
        if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and (i - last) * hop > SR * .07:
            s = i * hop
            env = np.abs(x[max(0, s - 1024):s + 512])
            k = int(np.argmax(env > env.max() * .15)) if env.size else 0
            out.append(max(0, s - 1024 + k - int(SR * .004))); strength.append(flux[i] / (flux.max() + 1e-9))
            last = i
    return out, strength


def chroma(h):
    n = 1 << 15
    seg = h[:n] if len(h) >= n else np.pad(h, (0, n - len(h)))
    spec = np.abs(np.fft.rfft(seg * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / SR)
    ok = (f > 75) & (f < 2200)
    pc = np.round(12 * np.log2(f[ok] / 440) + 69).astype(int) % 12
    c = np.bincount(pc, weights=spec[ok] / (f[ok] ** .5), minlength=12)
    return c / (c.max() + 1e-12)


def flatness(h):
    a = h[:4096] if len(h) >= 4096 else np.pad(h, (0, 4096 - len(h)))
    spec = np.abs(np.fft.rfft(a * np.hanning(4096))) ** 2 + 1e-12
    return float(np.exp(np.mean(np.log(spec[20:900]))) / np.mean(spec[20:900]))


def centroid(h):
    a = h[:16384] if len(h) >= 16384 else np.pad(h, (0, 16384 - len(h)))
    spec = np.abs(np.fft.rfft(a * np.hanning(16384))) ** 2
    f = np.fft.rfftfreq(16384, 1 / SR)
    return float((spec * f).sum() / (spec.sum() + 1e-12))


def phrases_of(path, name):
    x = read(path)
    on, st = onsets(x)
    if len(on) < 2: return []
    m = re.search(r'(\d{2,3})\s*_?-?\s*bpm', os.path.basename(path), re.I) or re.search(r'_(\d{2,3})_', os.path.basename(path))
    bpm = float(m.group(1)) if m and 50 <= float(m.group(1)) <= 200 else None
    if not bpm:
        ioi = np.diff(on) / SR; ioi = ioi[(ioi > .15) & (ioi < 1.5)]
        bpm = 60 / np.median(ioi) if ioi.size else 90.
        while bpm < 70: bpm *= 2
        while bpm > 150: bpm /= 2
    beat = 60 / bpm
    strum_file = bool(re.search(r'strum|chords', name, re.I))
    # the stretches kept: where the attacks are strongest
    dur = len(x) / SR
    n_win, w_len = (1, min(dur, KEEP)) if dur < 30 else (2, KEEP / 2)
    wins = []
    for _ in range(n_win):
        best, bs = 0, -1
        for o in on:
            a, b = o, min(len(x), o + int(w_len * SR))
            if b - a < .6 * w_len * SR or any(not (b <= wa or a >= wb) for wa, wb in wins): continue
            sc = sum(t for oo, t in zip(on, st) if a <= oo < b)
            if sc > bs: best, bs = a, sc
        if bs < 0: break
        wins.append((best, min(len(x), best + int(w_len * SR))))
    inside = lambda s, e: next((k for k, (a, b) in enumerate(wins) if a <= s and e <= b), -1)
    rng = np.random.default_rng(len(x))
    cands = []
    for k, s in enumerate(on):
        for beats in (1, 2, 4):
            want = s + int(beats * beat * SR)
            if want > len(x): continue
            # end just before the attack nearest the wanted length, and let the last note ring a little
            nxt = [o for o in on if o > s + int(.6 * beats * beat * SR)]
            e = min(nxt, key=lambda o: abs(o - want)) if nxt else want
            e = min(len(x), e + int(SR * .18))
            L = e - s
            if L < SR * .3 or L > SR * 4.2: continue
            h = x[s:e]
            if np.abs(h).max() < .03: continue
            n_on = sum(1 for o in on if s <= o < e - SR * .1)
            r = inside(s, e)
            if r < 0: continue
            cands.append(dict(start=s, region=r, at=s - wins[r][0], audio=h, beats=beats, n_on=n_on, strength=st[k], src=name, bpm=round(bpm, 1)))
    # the cleanest attacks first, every length, spread over the recording, never two starting at the same place twice
    rng.shuffle(cands)
    cands.sort(key=lambda c: -(c['strength'] + .1 * (c['beats'] == 2)))
    taken = []
    for c in cands:
        if len(taken) >= PER_FILE: break
        if sum(1 for t in taken if abs(t['start'] - c['start']) < SR * .2 and t['beats'] == c['beats']) >= 1: continue
        if sum(1 for t in taken if abs(t['start'] - c['start']) < SR * .2) >= 2: continue
        taken.append(c)
    for c in taken:
        h = c['audio']
        c['chroma'] = [round(float(v), 3) for v in chroma(h)]
        c['strum'] = strum_file or (c['n_on'] <= 2 and flatness(h) > .02 and np.count_nonzero(np.array(c['chroma']) > .5) >= 4)
        c['bright'] = round(centroid(h))
    return taken, [x[a:b] for a, b in wins]


def tidy(h):
    # the kept stretch with its ends faded, brought to the same peak; the page fades each phrase itself
    h = h.copy()
    fi, fo = 64, min(len(h) // 3, int(SR * .05))
    h[:fi] *= np.linspace(0, 1, fi)
    h[-fo:] *= np.linspace(1, 0, fo)
    return h / (np.abs(h).max() + 1e-9) * .89


def main():
    out_dir, files = sys.argv[1], sys.argv[2:]
    os.makedirs(out_dir, exist_ok=True)
    regions, meta = [], []
    for path in files:
        name = re.sub(r'^[0-9a-f]{8}-', '', os.path.splitext(os.path.basename(path))[0]).strip('_ -')
        ph, wins = phrases_of(path, name)
        label = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:40]
        base = len(regions)
        for j, h in enumerate(wins):
            fn = f'{label}-{j + 1}.wav'
            w = wave.open(os.path.join(out_dir, fn), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(tidy(h), -1, 1) * 32767).astype('<i2').tobytes()); w.close()
            regions.append(dict(file=fn, src=name, len=round(len(h) / SR, 3)))
        for c in ph:
            meta.append(dict(r=base + c['region'], at=round(c['at'] / SR, 4), bpm=c['bpm'], beats=c['beats'], len=round(len(c['audio']) / SR, 3), n=c['n_on'], strum=bool(c['strum']), bright=c['bright'], chroma=c['chroma']))
        top = ' '.join('C C# D D# E F F# G G# A A# B'.split()[i] for i in np.argsort(-np.mean([c['chroma'] for c in ph], axis=0))[:3]) if ph else ''
        print(f'{name[:52]:52s} {len(ph):3d} phrases  bpm {ph[0]["bpm"] if ph else "-":>6}  strums {sum(c["strum"] for c in ph):2d}  mostly {top}')
    json.dump(dict(regions=regions, phrases=meta), open(os.path.join(out_dir, 'guitar.json'), 'w'), indent=1)
    print(len(meta), 'phrases in', len(regions), 'stretches,', round(sum(r['len'] for r in regions), 1), 's kept')


if __name__ == '__main__':
    main()
