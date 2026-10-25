"""Optional local server. The application also works by opening index.html."""
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = self.path.split('?')[0]
        if route not in ('/', '/index.html', '/assets/rabbit-butler.png'):
            self.send_error(404)
            return
        is_image = route == '/assets/rabbit-butler.png'
        data = (ROOT / ('assets/rabbit-butler.png' if is_image else 'index.html')).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'image/png' if is_image else 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass

if __name__ == '__main__':
    ThreadingHTTPServer((os.environ.get('HOST', '127.0.0.1'), int(os.environ.get('PORT', '4174'))), Handler).serve_forever()
