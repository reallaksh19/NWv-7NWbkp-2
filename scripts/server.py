import http.server
import socketserver
import json
import os
import sys

PORT = 3001
PUBLIC_DIR = os.path.join(os.getcwd(), 'public')
DATA_DIR = os.path.join(PUBLIC_DIR, 'data')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Map API endpoints to file paths
API_FILES = {
    '/api/settings': os.path.join(PUBLIC_DIR, 'settings.json'),
    '/api/blacklist': os.path.join(DATA_DIR, 'blacklist.json'),
    '/api/user_plan': os.path.join(DATA_DIR, 'user_plan.json'),
    '/api/market_snapshot': os.path.join(DATA_DIR, 'market_snapshot.json')
}

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in API_FILES:
            filepath = API_FILES[self.path]
            if os.path.exists(filepath):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                with open(filepath, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                # Return empty object/list defaults if file missing
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                if 'blacklist' in self.path:
                    self.wfile.write(b'[]')
                else:
                    self.wfile.write(b'{}')
            return

        # Serve static files otherwise (optional, mainly for verifying public/)
        super().do_GET()

    def do_POST(self):
        if self.path in API_FILES:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                # Validate JSON
                json_data = json.loads(post_data)

                filepath = API_FILES[self.path]
                # Ensure directory exists
                os.makedirs(os.path.dirname(filepath), exist_ok=True)

                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, indent=4)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
                print(f"Saved {self.path} to {filepath}")

            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"status": "error", "message": "Invalid JSON"}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f'{{"status": "error", "message": "{str(e)}"}}'.encode())
            return

        self.send_response(404)
        self.end_headers()

print(f"Serving API on port {PORT}")
print(f"Public Directory: {PUBLIC_DIR}")
print(f"Data Directory: {DATA_DIR}")

with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
