#!/bin/bash
# Norwegian Breaks: starts a small local web server and opens the app.
# Double-click in Finder. Close this window (or press Ctrl+C) to stop.
cd "$(dirname "$0")"
PORT=8765
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "  Norwegian Breaks is running."
echo "  On this Mac:   http://localhost:$PORT/Norwegian%20Breaks.html"
if [ -n "$IP" ]; then
echo "  On the iPhone (same Wi-Fi), open Safari and type:"
echo "                 http://$IP:$PORT/Norwegian%20Breaks.html"
fi
echo ""
echo "  Close this window to stop."
echo ""
(sleep 1; open "http://localhost:$PORT/Norwegian%20Breaks.html") &
exec python3 -m http.server $PORT --bind 0.0.0.0
