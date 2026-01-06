from http.server import BaseHTTPRequestHandler
import json
import numpy as np
import traceback

def calculate_angle(a, b, c):
    """Calculate angle between three points"""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)

    if angle > 180.0:
        angle = 360 - angle

    return angle

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
    def do_GET(self):
        """Simple health check endpoint"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'success': True,
            'message': 'Bicep Curl API is running',
            'version': '1.0.0'
        }).encode())
        
    def do_POST(self):
        """Receive landmarks and return angle"""
        try:
            # Handle CORS
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-type', 'application/json')
            
            # Get request data
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Get landmarks from frontend 
            shoulder = data.get('shoulder', [0, 0])
            elbow = data.get('elbow', [0, 0])
            wrist = data.get('wrist', [0, 0])
            
            # Calculate angle
            angle = calculate_angle(shoulder, elbow, wrist)
            
            # Get current state
            current_counter = data.get('counter', 0)
            current_stage = data.get('stage', None)
            
            # Curl counter logic
            if angle > 160:
                current_stage = "down"
            if angle < 40 and current_stage == "down":
                current_stage = "up"
                current_counter += 1
            
            # Response
            response = {
                'success': True,
                'angle': float(angle),
                'counter': current_counter,
                'stage': current_stage
            }
            
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            print(f"Error in API: {str(e)}")
            print(traceback.format_exc())
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e),
                'angle': 0,
                'counter': 0,
                'stage': None
            }).encode())