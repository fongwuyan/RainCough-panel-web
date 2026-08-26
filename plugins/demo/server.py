import os, json, http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"hello": "world", "ns": os.environ.get("RAINCOUGH_NS",""), "p": self.path}).encode()
        self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        ln = int(self.headers.get("Content-Length",0)); data = self.rfile.read(ln)
        body = json.dumps({"echo": data.decode()}).encode()
        self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
http.server.HTTPServer(("127.0.0.1", int(os.environ["RAINCOUGH_PORT"])), H).serve_forever()
