# Lager «Motivmotor.html»: hele appen i én fil (app, notemodell og modellvekter), så den kan
# dobbeltklikkes på Macen uten server og uten nett. Kjør fra motivmotor-mappa:  python3 tools/build.py
import base64, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text(encoding='utf8')
css = (root / 'css/app.css').read_text(encoding='utf8')
safe = lambda js: js.replace('</script', '<\\/script')
scripts = re.findall(r'<script src="([^"]+)"></script>', src)
body = ''.join('<script>\n' + safe((root / s).read_text(encoding='utf8')) + '\n</script>\n' for s in scripts)
vendor = ''.join('<script>' + safe((root / 'vendor' / f).read_text(encoding='utf8')) + '</script>\n' for f in ['bp.js', 'bpmodel.js'])
icon = 'data:image/svg+xml;base64,' + base64.b64encode((root / 'icon.svg').read_bytes()).decode()
out = re.sub(r'<!--SCRIPTS-->.*<!--/SCRIPTS-->', lambda m: vendor + body, src, flags=re.S)
out = out.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + css + '\n</style>')
out = out.replace('<link rel="icon" href="icon.svg">', '<link rel="icon" href="' + icon + '">')
out = out.replace('<link rel="apple-touch-icon" href="icon-180.png">\n', '')
(root / 'Motivmotor.html').write_text(out, encoding='utf8')
print('Motivmotor.html', round(len(out.encode('utf8')) / 1e6, 1), 'MB')
