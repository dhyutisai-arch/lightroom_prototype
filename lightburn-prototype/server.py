"""
LightBurn Prototype - Local Web Server
Runs a lightweight HTTP server to host the LightBurn Prototype.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Clean console log
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("=" * 60)
        print("  ⚡ LightBurn CAD/CAM Laser Cutting Prototype")
        print(f"  Server running at: {url}")
        print("  Press Ctrl+C to stop server.")
        print("=" * 60)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == '__main__':
    run()
