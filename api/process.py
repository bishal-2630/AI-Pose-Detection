# api/process.py
from http.server import BaseHTTPRequestHandler
import json
import base64
import traceback

try:
    import cv2
    import numpy as np
    import mediapipe as mp
    
    # Initialize MediaPipe
    mp_pose = mp.solutions.pose
    HAS_MEDIAPIPE = True
except ImportError as e:
    print(f"Import error: {e}")
    HAS_MEDIAPIPE = False
    cv2 = None
    np = None
    mp = None

def calculate_angle(a, b, c):
    if np is None:
        return 0
    
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)

    if angle > 180.0:
        angle = 360 - angle

    return angle

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Test endpoint - check if API is running"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            'status': 'API is running',
            'mediapipe_available': HAS_MEDIAPIPE,
            'endpoint': '/api/process',
            'method': 'POST',
            'usage': 'Send POST request with {"image": "base64_data", "counter": 0, "stage": null}'
        }
        self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        """Process image and return pose data"""
        try:
            # Handle CORS
            self.send_header('Access-Control-Allow-Origin', '*')
            
            # Get request data
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "No data received")
                return
                
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            # Check if MediaPipe is available
            if not HAS_MEDIAPIPE:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': False,
                    'error': 'MediaPipe not installed',
                    'angle': 0,
                    'counter': data.get('counter', 0),
                    'stage': data.get('stage', None)
                }).encode())
                return
            
            # Decode base64 image
            image_str = data['image']
            if ',' in image_str:
                image_str = image_str.split(',')[1]
                
            image_data = base64.b64decode(image_str)
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                raise ValueError("Failed to decode image")
            
            # Get current state
            current_counter = data.get('counter', 0)
            current_stage = data.get('stage', None)
            
            # Process pose
            angle = 0
            landmarks_detected = False
            
            with mp_pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            ) as pose:
                
                # Convert to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                image_rgb.flags.writeable = False
                
                # Make detection
                results = pose.process(image_rgb)
                
                if results.pose_landmarks:
                    landmarks_detected = True
                    landmarks = results.pose_landmarks.landmark
                    
                    # Get right arm points
                    shoulder = [
                        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                        landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y
                    ]
                    elbow = [
                        landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                        landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y
                    ]
                    wrist = [
                        landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                        landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y
                    ]
                    
                    # Calculate angle
                    angle = calculate_angle(shoulder, elbow, wrist)
                    
                    # Curl counter logic
                    if angle > 160:
                        current_stage = "down"
                    if angle < 40 and current_stage == "down":
                        current_stage = "up"
                        current_counter += 1
            
            # Prepare response
            response = {
                'success': True,
                'angle': float(angle),
                'counter': current_counter,
                'stage': current_stage,
                'landmarks_detected': landmarks_detected
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': 'Invalid JSON data',
                'angle': 0,
                'counter': 0,
                'stage': None
            }).encode())
        except Exception as e:
            print(f"Error: {str(e)}")
            print(traceback.format_exc())
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {
                'success': False,
                'error': str(e),
                'angle': 0,
                'counter': data.get('counter', 0) if 'data' in locals() else 0,
                'stage': None
            }
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()