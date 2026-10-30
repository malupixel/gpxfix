"""Deterministic substitutes for external elevation/routing; real API/database remain in use."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, unquote
import json

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Avoid logging long elevation queries in test runs.

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/v1/elevation':
            count = len(parse_qs(url.query)['latitude'][0].split(','))
            body = {'elevation': [100.0 + i for i in range(count)]}
        elif url.path.startswith('/route/v1/cycling/'):
            points = [[float(n) for n in p.split(',')] for p in unquote(url.path.rsplit('/', 1)[1]).split(';')]
            body = {'code': 'Ok', 'routes': [{'geometry': {'coordinates': points}}]}
        else:
            self.send_error(404)
            return
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

HTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
