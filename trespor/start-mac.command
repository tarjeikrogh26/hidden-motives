#!/bin/bash
# TRE SPOR – start på Mac. Dobbeltklikk denne fila i Finder.
# Starter en liten lokal webserver, åpner instrumentet i nettleseren
# og viser adressen du kan åpne på iPhone (samme Wi-Fi).
cd "$(dirname "$0")" || exit 1
PORT=8765

IP=""
for IF in en0 en1 en2; do
  IP=$(ipconfig getifaddr "$IF" 2>/dev/null)
  [ -n "$IP" ] && break
done

if ! command -v python3 >/dev/null 2>&1 || ! python3 -c "import http.server" >/dev/null 2>&1; then
  echo "Fant ikke python3. Åpner TRE SPOR direkte fra fil i stedet (fungerer fint på Mac)."
  echo "For iPhone: installer Python (xcode-select --install) og start på nytt."
  open "index.html"
  exit 0
fi

# bruk neste ledige port hvis 8765 er opptatt
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done

echo ""
echo "  TRE SPOR kjører"
echo "  ─────────────────────────────────────────────"
echo "  På denne Macen:          http://localhost:$PORT"
if [ -n "$IP" ]; then
  echo "  På iPhone (samme Wi-Fi):  http://$IP:$PORT"
fi
echo "  ─────────────────────────────────────────────"
echo "  Lukk dette vinduet eller trykk Ctrl+C for å stoppe."
echo ""

(sleep 1; open "http://localhost:$PORT") &
exec python3 -m http.server "$PORT" --bind 0.0.0.0
