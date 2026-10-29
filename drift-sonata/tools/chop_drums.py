#!/usr/bin/env python3
"""Cuts drum loops and percussion recordings into single hits for DRIFT SONATA's drum kits.

  python3 tools/chop_drums.py <folder with loops and one-shots> <out folder>

Every file is read through ffmpeg (WAV or AIFF), its hits found by spectral flux, and each hit sorted into
kick, snare, hat or perc by where its energy sits. A loop gives a few of each (the cleanest: a hit with room
after it, and different from the ones already taken); a percussion file (toms, congas, cowbells ...), a snap, an
effect, a foley texture or an orchestral loop gives its hits as perc (each kind in its own pool for the Perc channel);
a one-shot snare goes to the drum kits as a snare. The out folder gets one 16-bit mono WAV per hit and hits.json describing them. The recordings
come from sample packs, so neither they nor the hits go into the repository; build.py --drums embeds them.
"""
import json, os, re, subprocess, sys, wave

import numpy as np

SR = 44100
# Which files are loops and which are percussion, and what to call them (matched on the file name)
SOURCES = [
    (r'203_Break', 'loop', 'Break 203'), (r'BUMPY_KNUCKLES', 'loop', 'Bumpy Knuckles'), (r'13_79_bpm', 'loop', 'Thirteen'),
    (r'all_u_do', 'loop', 'All U Do'), (r'elevators', 'loop', 'Elevators'), (r'12_77_bpm', 'loop', 'Twelve'),
    (r'07_Drums_1', 'loop', 'Drums One'), (r'TheAttic', 'loop', 'The Attic'), (r'Birra_Moretti', 'loop', 'Birra'),
    (r'Skimmy', 'loop', 'Cruiser'), (r'Junk_Yard', 'loop', 'Junk Yard'),
    (r'JETS_modular_one_shot_stone', 'perc', 'Stone'), (r'JETS_modular_one_shot_team', 'perc', 'Team'),
    (r'Cowbells', 'perc', 'Cowbell'), (r'hats_stereo', 'hatloop', 'Tek hats'), (r'shaker_loop', 'shaker', 'Shaker'),
    (r'Toms', 'perc', 'Toms'), (r'06_Tom', 'perc', 'Tom'), (r'Tom_D', 'perc', 'Low tom'), (r'Bongos', 'perc', 'Bongo'),
    (r'CONGA|Conga', 'perc', 'Conga'), (r'Timbales', 'perc', 'Timbale'), (r'cuts_meat', 'perc', 'Meat cut'),
    (r'Percussion_66', 'perc', 'Lys'), (r'Coin_Bag', 'perc', 'Coin bag'), (r'Perc_1_', 'perc', 'Perc one'), (r'Perc_5_', 'perc', 'Perc five'),
    (r'Rims_-_Operator', 'perc', 'Operator rim'),
    (r'snap__landscape', 'snap', 'Landscape snap'), (r'Snap_Human', 'snap', 'Human snap'), (r'snap_castanet', 'snap', 'Castanet'),
    (r'Whoosh_rask', 'fx', 'Whoosh'), (r'IceCrackFreeze', 'fx', 'Ice crack'), (r'RatSqueak', 'fx', 'Squeak'), (r'laser_hot', 'fx', 'Laser'),
    (r'cricket_tek', 'fx', 'Cricket'), (r'impact_smell', 'fx', 'Impact'),
    (r'eating_chips_left', 'texture', 'Chips left'), (r'eating_chips_right_ear_var', 'texture', 'Chips var'), (r'eating_chips_right_ear\.', 'texture', 'Chips right'),
    (r'spray_bottle', 'texture', 'Spray'), (r'aluminum_foil', 'texture', 'Foil'), (r'apple_jimmy', 'texture', 'Apple'),
    (r'Drum_Fill_Loop_Orchestral', 'orch', 'Orchestral fill'), (r'ORCHST_LOOP_01', 'orch', 'Orchestra one'), (r'ORCHST_LOOP_03', 'orch', 'Orchestra three'),
    (r'ORCHST_LOOP_06', 'orch', 'Orchestra sticks'), (r'ORCHST_LOOP_10', 'orch', 'Orchestra ten'),
    (r'snare_trap', 'snare', 'Trap snare'), (r'thick_snappy_dark', 'snare', 'Dark snare'), (r'snare_48', 'snare', 'Snare 48'),
    (r'snare_A_015', 'snare', 'Snare A'), (r'SNARE_25', 'snare', 'Snare 25'),
]
# Kinds: loop (a break: kick, snare, hat and perc sorted out), perc (hand percussion), hatloop and shaker (hats), snap (snaps
# and castanets), fx (one-shot effects: cracks, lasers, crickets, whooshes), texture (foley: chips, foil, spray, cut into
# crumbs), orch (orchestral percussion loops, cut into hits) and snare (a one-shot snare for the drum kits)
MAXLEN = {'loop': .7, 'perc': 1.4, 'hatloop': .35, 'shaker': .3, 'snap': .8, 'fx': 2.2, 'texture': .45, 'orch': 1.1, 'snare': 1.0}
ROOM_CUT = ('loop', 'texture', 'orch')  # cut where the next hit starts
TAKE = {'kick': 3, 'snare': 3, 'hat': 3, 'perc': 3}


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def onsets(x):
    n, hop = 1024, 256
    frames = 1 + max(0, (len(x) - n) // hop)
    win = np.hanning(n)
    mag = np.abs(np.fft.rfft(np.stack([x[i * hop:i * hop + n] * win for i in range(frames)]), axis=1))
    lm = np.log1p(mag * 20)
    flux = np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    out, last = [], -10**9
    for i in range(1, len(flux) - 1):
        lo, hi = max(0, i - 10), min(len(flux), i + 10)
        thr = np.median(flux[lo:hi]) * 1.5 + flux.max() * .06
        if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and (i - last) * hop > SR * .06:
            # back up to just before the attack
            s = i * hop
            env = np.abs(x[max(0, s - 768):s + 512])
            k = int(np.argmax(env > env.max() * .12)) if env.size else 0
            out.append(max(0, s - 768 + k - int(SR * .002)))
            last = i
    return out


def features(h):
    a = h[:int(SR * .08)]
    spec = np.abs(np.fft.rfft(a * np.hanning(len(a)), 8192)) ** 2
    f = np.fft.rfftfreq(8192, 1 / SR)
    tot = spec.sum() + 1e-12
    low = spec[f < 150].sum() / tot
    high = spec[f > 6000].sum() / tot
    cen = float((spec * f).sum() / tot)
    flat = float(np.exp(np.mean(np.log(spec[(f > 200) & (f < 10000)] + 1e-12))) / (np.mean(spec[(f > 200) & (f < 10000)]) + 1e-12))
    return low, high, cen, flat


def classify(low, high, cen, flat):
    if low > .4 and cen < 1000: return 'kick'
    if high > .3 or cen > 5500: return 'hat'
    if 1000 < cen <= 5500 and flat > .1: return 'snare'  # often with a kick under it in a break: cut away below
    return 'perc'


def highpass(h, hz):
    # gentle, zero-phase: the bins fade in over an octave below hz
    n = 1 << int(np.ceil(np.log2(len(h) + 4096)))
    H = np.fft.rfft(np.pad(h, (0, n - len(h))))
    f = np.fft.rfftfreq(n, 1 / SR)
    H *= np.clip(np.log2(np.maximum(f, 1) / (hz / 2)), 0, 1)
    return np.fft.irfft(H, n)[:len(h)].astype(np.float32)


def trim(h):
    # cut the tail where it has died away, fade the ends, and bring every hit to the same peak
    env = np.abs(h)
    peak = env.max() + 1e-9
    above = np.nonzero(env > peak * .02)[0]
    end = min(len(h), (above[-1] if above.size else len(h)) + int(SR * .02))
    h = h[:end].copy()
    fi, fo = min(len(h), 32), min(len(h) // 3, int(SR * .012))
    h[:fi] *= np.linspace(0, 1, fi)
    if fo: h[-fo:] *= np.linspace(1, 0, fo)
    return h / peak * .89


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    hits, count = [], {}
    for name in sorted(os.listdir(src)):
        m = next((s for s in SOURCES if re.search(s[0], name)), None)
        if not m or not name.lower().endswith(('.wav', '.aif', '.aiff')): continue
        _, kind, label = m
        x = read(os.path.join(src, name))
        on = onsets(x) if len(x) > SR * .5 else [0]
        if not on: on = [0]
        cands = []
        for k, s in enumerate(on):
            nxt = on[k + 1] if k + 1 < len(on) else len(x)
            room = (nxt - s) / SR
            maxlen = MAXLEN[kind]
            h = x[s:s + int(SR * min(maxlen, room if kind in ROOM_CUT else max(room, .5) if kind == 'fx' else maxlen))]
            if len(h) < SR * .03 or np.abs(h).max() < .02: continue
            low, high, cen, flat = features(h)
            cls = classify(low, high, cen, flat) if kind == 'loop' else 'hat' if kind in ('hatloop', 'shaker') else 'snare' if kind == 'snare' else 'perc'
            loud = float(np.sqrt(np.mean(h[:int(SR * .05)] ** 2)))
            cands.append(dict(h=h, cls=cls, room=room, loud=loud, feat=(low, high, cen / 10000, flat)))
        # per class: the clean, strong ones first, then only ones that sound different from those taken
        taken = {}
        limit = dict(TAKE) if kind == 'loop' else {'perc': {'perc': 8, 'snap': 6, 'fx': 4, 'texture': 10, 'orch': 8}.get(kind, 3), 'hat': 3, 'snare': 1}
        for c in sorted(cands, key=lambda c: -(min(c['room'], .3) * 3 + c['loud'] * 4)):
            t = taken.setdefault(c['cls'], [])
            if len(t) >= limit.get(c['cls'], 0): continue
            if any(np.linalg.norm(np.subtract(c['feat'], o['feat'])) < .03 for o in t): continue
            t.append(c)
        for cls, t in taken.items():
            for c in t:
                h = c['h']
                if cls in ('snare', 'hat'): h = highpass(h, (90 if kind == 'snare' else 160) if cls == 'snare' else 400)
                h = trim(h)
                n = count[label, cls] = count.get((label, cls), 0) + 1  # several files can share a name (Toms, Conga)
                fn = re.sub(r'[^a-z0-9]+', '-', label.lower()) + f'-{cls}-{n}.wav'
                w = wave.open(os.path.join(out, fn), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
                w.writeframes((np.clip(h, -1, 1) * 32767).astype('<i2').tobytes()); w.close()
                hits.append(dict(file=fn, src=label, cls=cls, kind=kind, len=round(len(h) / SR, 3), cen=round(c['feat'][2] * 10000),
                                 low=round(c['feat'][0], 3), flat=round(c['feat'][3], 3)))
        print(f'{label:16s} {kind:8s} ' + ' '.join(f'{k}:{len(v)}' for k, v in sorted(taken.items())))
    json.dump(hits, open(os.path.join(out, 'hits.json'), 'w'), indent=1)
    print(len(hits), 'hits')


if __name__ == '__main__':
    main()
