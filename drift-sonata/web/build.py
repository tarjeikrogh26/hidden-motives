#!/usr/bin/env python3
"""Builds the DRIFT SONATA test bench: one HTML file with the engine (WebAssembly), the parameter table,
and optionally the choir/cello recordings and the header art.

  python3 web/build.py --wasi-sdk /path/to/wasi-sdk --out dist/DriftSonata.html \
      [--samples folder-with-choir_*.wav-and-cello_*.wav] [--header header.jpg]

The recordings come from sample packs, so they stay out of this (public) repository: point --samples at a
local folder. Without it the page plays the synth alone.
"""
import argparse, base64, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def run(cmd):
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wasi-sdk', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--samples')
    ap.add_argument('--header')
    a = ap.parse_args()

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
            for name in sorted(os.listdir(a.samples)):
                m = re.match(r'(choir|cello)_([0-9.]+)', name)
                if not m or not name.lower().endswith('.wav'):
                    continue
                m4a = os.path.join(tmp, name + '.m4a')
                run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(a.samples, name), '-ac', '1', '-c:a', 'aac', '-b:a', '96k', m4a])
                samples.append({'fam': 0 if m.group(1) == 'choir' else 1, 'root': float(m.group(2).rstrip('.')),
                                'b64': base64.b64encode(open(m4a, 'rb').read()).decode()})

    page = open(os.path.join(HERE, 'page.html')).read()
    page = page.replace('"@@DATA@@"', data).replace('"@@WASM@@"', json.dumps(wasm_b64)).replace('"@@SAMPLES@@"', json.dumps(samples))
    if a.header:
        ext = os.path.splitext(a.header)[1].lower().lstrip('.')
        mime = {'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'webp': 'webp'}.get(ext, 'jpeg')
        img = base64.b64encode(open(a.header, 'rb').read()).decode()
        page = page.replace('<!--@@HEADER@@-->', f'<img src="data:image/{mime};base64,{img}" alt=""><style>.banner .word,.banner .orb{{display:none}}</style>')
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, 'w').write(page)
    print(f'{a.out}: {len(page) / 1e6:.2f} MB, {len(samples)} recordings')


if __name__ == '__main__':
    sys.exit(main())
