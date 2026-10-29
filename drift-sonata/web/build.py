#!/usr/bin/env python3
"""Builds the DRIFT SONATA test bench: one HTML file with the engine (WebAssembly), the parameter table,
and optionally the choir/cello recordings and the header art.

  python3 web/build.py --wasi-sdk /path/to/wasi-sdk --out dist/DriftSonata.html \
      [--samples folder-with-choir_*.wav-and-cello_*.wav] [--header header.jpg] [--arp AVANTGARDIAN-ARP/dist] [--drums hits-folder] [--vox vox-folder]

The recordings come from sample packs, so they stay out of this (public) repository: point --samples at a
local folder. Without it the page plays the synth alone. --arp points at an AVANTGARDIAN ARP dist folder: its engine,
sound bank and voices go into the page, and its 2,281 patterns are packed (six bytes a note). --drums points at the
hits tools/chop_drums.py cut from drum loops and percussion recordings (sample packs too, so kept out as well), and
--vox at the wordless vocal pieces tools/chop_vox.py cut (the singers' own recordings, kept out too).
"""
import argparse, base64, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def run(cmd):
    subprocess.run(cmd, check=True)


ARP_FILES = ['performance.js', 'transport-clock.js', 'voice-output.js', 'engine.js', 'nb46-presets.js', 'nb46-bank.js',
             'studio-fx.js', 'nb-voice.js', 'sound-match.js', 'note-fx.js']


def arp_scripts(folder):
    """AVANTGARDIAN ARP inside the page: its scripts as they are (the ladder worklet loaded from the page itself),
    and its patterns packed: per pattern a meta row, per note start and length in 1/480 beats, pitch and velocity."""
    import struct
    safe = lambda code: code.replace('</script', '<\\/script')
    parts = ['<script>window.__ARP_LADDER = ' + json.dumps(open(os.path.join(folder, 'nb-ladder.js')).read()) + ';</script>']
    for f in ARP_FILES:
        code = open(os.path.join(folder, f)).read()
        if f == 'nb-voice.js':
            code = code.replace("c.audioWorklet.addModule('nb-ladder.js?v=09')", 'window.__arpLadder(c)')
        parts.append(f'<script>/* AVANTGARDIAN ARP · {f} */\n{safe(code)}\n</script>')
    pats = json.load(open(os.path.join(folder, 'assets', 'patterns.json')))['patterns']
    meta, blob = [], bytearray()
    for p in pats:
        meta.append([p['id'], p['name'], p.get('root', 0), p.get('mode', 'minor'), p.get('count', len(p['notes'])), p.get('low', 48), p.get('high', 72),
                     1 if p.get('living') else 0, p.get('phraseBars', 16), p.get('phraseGrid', 16), p.get('phraseSeed', 1), p.get('source', '')])
        blob += struct.pack('<H', len(p['notes']))
        for st, du, pi, ve in p['notes']:
            blob += struct.pack('<HHBB', min(65535, round(st * 480)), min(65535, max(1, round(du * 480))), int(pi) & 127, int(ve) & 127)
    parts.append('<script>const ARP_META = ' + json.dumps(meta, separators=(',', ':')) + ';\nconst ARP_BIN = "' + base64.b64encode(bytes(blob)).decode() + '";</script>')
    print(f'ARP: {len(pats)} patterns, {len(blob) / 1e6:.2f} MB packed')
    return '\n'.join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wasi-sdk', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--samples')
    ap.add_argument('--header')
    ap.add_argument('--arp')
    ap.add_argument('--drums')
    ap.add_argument('--vox')
    ap.add_argument('--piano')
    ap.add_argument('--guitar')
    ap.add_argument('--asmr')
    ap.add_argument('--world')
    ap.add_argument('--quality', choices=['web', 'full'], default='web', help='web: small enough to publish (under 16 MB); full: the best sound, for a file to keep')
    a = ap.parse_args()
    # AAC rates per kind of sound: the web page must stay under 16 MB, a file to keep need not
    BR = dict(samples='80k', drums='80k', vox='72k', piano='160k', guitar='64k', world='48k', asmr='48k') if a.quality == 'web' else \
        dict(samples='128k', drums='128k', vox='112k', piano='192k', guitar='128k', world='112k', asmr='96k')

    with tempfile.TemporaryDirectory() as tmp:
        wasm = os.path.join(tmp, 'drift.wasm')
        run([os.path.join(a.wasi_sdk, 'bin', 'clang++'), '--target=wasm32-wasip1', '--sysroot=' + os.path.join(a.wasi_sdk, 'share', 'wasi-sysroot'),
             '-O3', '-std=c++17', '-fno-exceptions', '-mexec-model=reactor', '-Wl,--strip-all',
             os.path.join(HERE, 'wasm_api.cpp'), os.path.join(ROOT, 'dsp', 'Engine.cpp'), '-o', wasm])
        exporter = os.path.join(tmp, 'export_json')
        run(['g++', '-std=c++17', '-O1', os.path.join(ROOT, 'tools', 'export_json.cpp'), '-o', exporter])
        data = subprocess.run([exporter], check=True, capture_output=True, text=True).stdout.strip()
        wasm_b64 = base64.b64encode(open(wasm, 'rb').read()).decode()

        samples = []
        if a.samples:
            # Each recording as AAC (small, and every browser decodes it), named <family>_<midi note>....wav
            fams = ['choir', 'cello', 'strings', 'brass', 'texture']
            tables = ['cello', 'choir', 'strings', 'brass', 'chimera']
            for name in sorted(os.listdir(a.samples)):
                t = re.match(r'wt_(\w+)\.wav$', name)
                if t and t.group(1) in tables:
                    # Wavetables go in as raw 16-bit frames: a codec or resampling would shift the cycles
                    import wave
                    w = wave.open(os.path.join(a.samples, name))
                    pcm = w.readframes(w.getnframes())
                    samples.append({'table': tables.index(t.group(1)), 'frames': w.getnframes() // 2048, 'pcm': base64.b64encode(pcm).decode()})
                    continue
                m = re.match(r'(choir|cello|strings|brass|texture)_([0-9.]+)', name)
                if not m or not name.lower().endswith('.wav'):
                    continue
                m4a = os.path.join(tmp, name + '.m4a')
                run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(a.samples, name), '-ac', '1', '-c:a', 'aac', '-b:a', BR['samples'], m4a])
                samples.append({'fam': fams.index(m.group(1)), 'root': float(m.group(2).rstrip('.')),
                                'b64': base64.b64encode(open(m4a, 'rb').read()).decode()})

        hits = []
        if a.drums:
            # Drum hits cut by tools/chop_drums.py, each as AAC (the page finds the attack again after decoding)
            for h in json.load(open(os.path.join(a.drums, 'hits.json'))):
                m4a = os.path.join(tmp, h['file'] + '.m4a')
                run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(a.drums, h['file']), '-ac', '1', '-c:a', 'aac', '-b:a', BR['drums'], m4a])
                hits.append({'cls': h['cls'], 'src': h['src'], 'kind': h['kind'], 'b64': base64.b64encode(open(m4a, 'rb').read()).decode()})

        vox = []
        if a.vox:
            # Vox pieces cut by tools/chop_vox.py, as AAC (the page finds the start again after decoding)
            for v in json.load(open(os.path.join(a.vox, 'vox.json'))):
                m4a = os.path.join(tmp, v['file'] + '.m4a')
                run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(a.vox, v['file']), '-ac', '1', '-c:a', 'aac', '-b:a', BR['vox'], m4a])
                vox.append({k: v[k] for k in ('kind', 'singer', 'midi', 'len', 'bright') if k in v} | {'b64': base64.b64encode(open(m4a, 'rb').read()).decode()})

        piano = []
        if a.piano:
            # Piano notes cut by tools/chop_piano.py, as AAC, with their key and partials
            for v in json.load(open(os.path.join(a.piano, 'piano.json'))):
                m4a = os.path.join(tmp, v['file'] + '.m4a')
                run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(a.piano, v['file']), '-ac', '1', '-c:a', 'aac', '-b:a', BR['piano'], m4a])
                piano.append({k: v[k] for k in ('midi', 'len', 'bright', 'parts') if k in v} | {'b64': base64.b64encode(open(m4a, 'rb').read()).decode()})

        def phrases(folder, rate):
            # Stretches and the phrases in them, from tools/chop_guitar.py, the stretches as AAC
            out = {'regions': [], 'phrases': []}
            if not folder: return out
            g = json.load(open(os.path.join(folder, 'guitar.json')))
            for r in g['regions']:
                m4a = os.path.join(tmp, r['file'] + '.m4a')
                run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(folder, r['file']), '-ac', '1', '-c:a', 'aac', '-b:a', rate, m4a])
                out['regions'].append({'src': r['src'], 'len': r['len'], 'b64': base64.b64encode(open(m4a, 'rb').read()).decode()})
            out['phrases'] = g['phrases']
            return out
        guitar, world = phrases(a.guitar, BR['guitar']), phrases(a.world, BR['world'])

        asmr = {'pieces': [], 'b64': ''}
        if a.asmr:
            # The ASMR material from tools/chop_asmr.py: one stream of all of it (noise mostly, so a low rate does) and its pieces
            m4a = os.path.join(tmp, 'asmr.m4a')
            run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(a.asmr, 'asmr.wav'), '-ac', '1', '-c:a', 'aac', '-b:a', BR['asmr'], m4a])
            asmr = json.load(open(os.path.join(a.asmr, 'asmr.json'))) | {'b64': base64.b64encode(open(m4a, 'rb').read()).decode()}

    page = open(os.path.join(HERE, 'page.html')).read()
    page = page.replace('"@@DATA@@"', data).replace('"@@WASM@@"', json.dumps(wasm_b64)).replace('"@@SAMPLES@@"', json.dumps(samples))
    page = page.replace('"@@DRUMHITS@@"', json.dumps(hits, separators=(',', ':')))
    page = page.replace('"@@VOX@@"', json.dumps(vox, separators=(',', ':')))
    page = page.replace('"@@PIANO@@"', json.dumps(piano, separators=(',', ':')))
    page = page.replace('"@@GUITAR@@"', json.dumps(guitar, separators=(',', ':')))
    page = page.replace('"@@ASMR@@"', json.dumps(asmr, separators=(',', ':')))
    page = page.replace('"@@WORLD@@"', json.dumps(world, separators=(',', ':')))
    page = page.replace('<!--@@ARP@@-->', arp_scripts(a.arp) if a.arp else '')
    if a.header:
        ext = os.path.splitext(a.header)[1].lower().lstrip('.')
        mime = {'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'webp': 'webp'}.get(ext, 'jpeg')
        img = base64.b64encode(open(a.header, 'rb').read()).decode()
        # The art carries the name itself, so the painted sky and wordmark step aside, and the banner keeps the
        # art's own 3:1 shape on phones too (cropping it would cut the name).
        page = page.replace('<!--@@HEADER@@-->', f'<img src="data:image/{mime};base64,{img}" alt="">'
                            '<style>.banner .word,.banner .orb{display:none}.banner{aspect-ratio:3/1!important;border:none}</style>')
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, 'w').write(page)
    print(f'{a.out}: {len(page) / 1e6:.2f} MB, {len([x for x in samples if "fam" in x])} recordings, {len([x for x in samples if "table" in x])} wavetables, {len(hits)} drum hits, {len(vox)} vox pieces, {len(piano)} piano notes, {len(guitar["phrases"])} guitar phrases, {len(asmr["pieces"])} asmr pieces, {len(world["phrases"])} world phrases')


if __name__ == '__main__':
    sys.exit(main())
