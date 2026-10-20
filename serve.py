#!/usr/bin/env python3
"""Tiny local web server for Pazar.

Serves the game folder on localhost (needed for YouTube music) and tells the
browser never to cache game files, so a reload always picks up the latest
version of every script instead of mixing old and new copies.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):  # keep the terminal quiet
        pass


if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'Pazar at http://localhost:{PORT}/')
        httpd.serve_forever()
