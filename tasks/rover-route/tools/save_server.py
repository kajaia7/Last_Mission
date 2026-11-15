"""Local dev server for make-pictures.html (Python standard library only).

    python tasks/rover-route/tools/save_server.py

Serves the project on http://127.0.0.1:8137 and accepts the two route pictures
from make-pictures.html, writing them to tasks/rover-route/assets/.
Only route-a.png and route-b.png can be written.
"""
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
ASSETS = ROOT / 'tasks' / 'rover-route' / 'assets'
ALLOWED = {'route-a.png', 'route-b.png'}
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        name = self.path.removeprefix('/__save/')
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if 0 < length < 20_000_000 else b''
        if name not in ALLOWED or not body.startswith(PNG_SIGNATURE):
            self.send_error(400, 'Only route-a.png / route-b.png PNG uploads are accepted')
            return
        (ASSETS / name).write_bytes(body)
        self.send_response(204)
        self.end_headers()


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=str(ROOT))
    print('Open http://127.0.0.1:8137/tasks/rover-route/tools/make-pictures.html')
    http.server.ThreadingHTTPServer(('127.0.0.1', 8137), handler).serve_forever()
