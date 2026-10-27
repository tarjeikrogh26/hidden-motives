"""Compact AVANTGARDIAN ARP's pattern library for Dropfather: every arp-ready pattern, first 16 beats (4 bars),
notes unchanged ([beat, length, pitch, velocity]). A drop lead never uses more than 4 bars.
Usage: python3 tools/extract-arp-patterns.py path/to/dist/assets/patterns.json src/vendor/arp/patterns-4bars.json"""
import json, sys
src, dst = sys.argv[1], sys.argv[2]
lib = json.load(open(src, encoding='utf-8'))
out = []
for p in lib['patterns']:
    if not p.get('arpReady'):
        continue
    notes = [n[:4] for n in p['notes'] if n[0] < 16]
    if notes:
        out.append({'id': p['id'], 'name': p['name'], 'root': p['root'], 'mode': p['mode'], 'beats': 16, 'arpReady': True, 'notes': notes})
json.dump({'format': 'dropfather-arp-patterns', 'source': 'AVANTGARDIAN ARP v0.18 assets/patterns.json', 'patterns': out}, open(dst, 'w', encoding='utf-8'), separators=(',', ':'))
print(len(out), 'patterns')
