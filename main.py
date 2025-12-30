import cv2
import numpy as np

# Try importing MediaPipe with error handling
try:
    import mediapipe as mp
    
    # Initialize MediaPipe components
    mp_drawing = mp.solutions.drawing_utils
    mp_pose = mp.solutions.pose
    
    print("MediaPipe imported successfully!")
    
except ImportError as e:
    print(f"Error importing MediaPipe: {e}")
    print("Please install: pip install mediapipe")
    exit(1)
except Exception as e:
    print(f"Unexpected error importing MediaPipe: {e}")
    exit(1)

def calculate_angle(a, b, c):
    """Calculate the angle between three points"""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    # Calculate radians
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    
    # Ensure angle is between 0 and 180
    if angle > 180.0:
        angle = 360 - angle
    
    return angle

def calculate_torso_angle(shoulder, hip, ankle):
    """Calculate torso angle relative to vertical (0° = upright, 90° = horizontal)"""
    shoulder = np.array(shoulder)
    hip = np.array(hip)
    
    # Calculate torso vector (hip to shoulder)
    torso_vector = shoulder - hip
    
    # Calculate vertical vector (0, -1) pointing upward
    vertical_vector = np.array([0, -1])
    
    # Calculate angle between torso and vertical
    dot_product = np.dot(torso_vector, vertical_vector)
    norm_torso = np.linalg.norm(torso_vector)
    norm_vertical = np.linalg.norm(vertical_vector)
    
    # Avoid division by zero
    if norm_torso == 0:
        return 0
    
    cos_angle = dot_product / (norm_torso * norm_vertical)
    # Clamp value to avoid numerical errors
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    
    angle = np.degrees(np.arccos(cos_angle))
    
    return angle

def detect_exercise(landmarks, torso_angle, left_elbow_angle, right_elbow_angle):
    """Automatically detect which exercise is being performed"""
    
    try:
        # Get key landmarks
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        
        # Calculate average positions
        avg_shoulder_y = (left_shoulder.y + right_shoulder.y) / 2
        avg_hip_y = (left_hip.y + right_hip.y) / 2
        avg_wrist_y = (left_wrist.y + right_wrist.y) / 2
        
        # Check wrist position relative to body
        wrist_above_shoulders = avg_wrist_y < avg_shoulder_y - 0.1
        
        
        # Improved detection logic
        if torso_angle > 60:  
            # For push-ups, check if wrists are near shoulder level
            wrist_near_shoulders = abs(avg_wrist_y - avg_shoulder_y) < 0.2
            if wrist_near_shoulders:
                return "pushup"
        
        elif torso_angle <= 60:  # Body is more vertical
            if wrist_above_shoulders:  # Arms are overhead (pull-up)
                return "pullup"
            else:  # Arms at sides (curl)
                if avg_wrist_y > avg_hip_y - 0.15:
                    return "curl"
        
        return "none"
    except Exception as e:
        # print(f"Detection error: {e}")
        return "none"

def main():
    """Main function to run the exercise counter"""
    print("Initializing exercise counter...")
    
    # Initialize video capture
    print("Opening camera...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("ERROR: Could not open webcam!")
        print("Please check:")
        print("1. Is your webcam connected?")
        print("2. Is another program using the webcam?")
        print("3. Try running as administrator")
        return
    
    print("Camera opened successfully!")
    
    # Set webcam resolution for better performance
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    # Initialize counters and stages for each exercise
    curl_counter = 0
    pushup_counter = 0
    pullup_counter = 0
    
    curl_stage = None
    pushup_stage = None
    pullup_stage = None
    
    current_exercise = "none"
    exercise_history = []
    confidence_threshold = 5  # Number of frames to confirm exercise
    
    # Setup MediaPipe instance
    print("Initializing MediaPipe pose estimation...")
    with mp_pose.Pose(
        min_detection_confidence=0.5,  # Lowered for better detection
        min_tracking_confidence=0.5,   # Lowered for better tracking
        model_complexity=1  # 0=Light, 1=Full, 2=Heavy
    ) as pose:
        
        print("="*50)
        print("Starting exercise detection...")
        print("Instructions:")
        print("1. Bicep Curls: Stand with arms at sides")
        print("2. Push-ups: Get into plank position")
        print("3. Pull-ups: Stand with arms overhead")
        print("Press 'Q' to quit")
        print("="*50)
        
        frame_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            frame_count += 1
            
            if not ret:
                print(f"Frame {frame_count}: Failed to grab frame")
                break
            
            # Flip frame horizontally for mirror view
            frame = cv2.flip(frame, 1)
            
            # Recolor image to RGB (MediaPipe requires RGB)
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
            
            # Make detection
            results = pose.process(image)
            
            # Recolor back to BGR (OpenCV uses BGR)
            image.flags.writeable = True
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            # Get image dimensions
            h, w, _ = image.shape
            
            # Initialize angle variables
            left_elbow_angle = 0
            right_elbow_angle = 0
            torso_angle = 0
            avg_elbow_angle = 0
            
            # Extract landmarks and process
            try:
                if results.pose_landmarks:
                    landmarks = results.pose_landmarks.landmark
                    
                    # Get coordinates for calculations (LEFT SIDE)
                    left_shoulder_coords = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                                            landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                    left_elbow_coords = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                                         landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
                    left_wrist_coords = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                                         landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
                    left_hip_coords = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x,
                                       landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                    left_ankle_coords = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x,
                                         landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
                    
                    # Get coordinates for calculations (RIGHT SIDE)
                    right_shoulder_coords = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                                             landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    right_elbow_coords = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                                          landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    right_wrist_coords = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                                          landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
                    
                    # Calculate angles
                    left_elbow_angle = calculate_angle(left_shoulder_coords, left_elbow_coords, left_wrist_coords)
                    right_elbow_angle = calculate_angle(right_shoulder_coords, right_elbow_coords, right_wrist_coords)
                    
                    # Calculate torso angle
                    torso_angle = calculate_torso_angle(left_shoulder_coords, left_hip_coords, left_ankle_coords)
                    
                    # Detect current exercise
                    new_exercise = detect_exercise(landmarks, torso_angle, left_elbow_angle, right_elbow_angle)
                    
                    # Update exercise history
                    exercise_history.append(new_exercise)
                    if len(exercise_history) > 10:
                        exercise_history.pop(0)
                    
                    # Change exercise only if detected consistently
                    if len(exercise_history) >= confidence_threshold:
                        # Count occurrences of each exercise in recent history
                        from collections import Counter
                        exercise_counts = Counter(exercise_history)
                        
                        # Get the most common exercise (excluding "none")
                        valid_exercises = {k: v for k, v in exercise_counts.items() if k != "none"}
                        
                        if valid_exercises:
                            most_common = max(valid_exercises, key=valid_exercises.get)
                            if valid_exercises[most_common] >= confidence_threshold // 2:
                                current_exercise = most_common
                    
                    # Get average elbow angle for counting
                    avg_elbow_angle = (left_elbow_angle + right_elbow_angle) / 2
                    
                    # Exercise-specific counting logic
                    if current_exercise == "curl":
                        # Bicep curl counter logic
                        if avg_elbow_angle > 160:
                            curl_stage = "down"
                        if avg_elbow_angle < 40 and curl_stage == "down":
                            curl_stage = "up"
                            curl_counter += 1
                            print(f"Bicep Curl Rep: {curl_counter}")
                    
                    elif current_exercise == "pushup":
                        # Push-up counter logic
                        if avg_elbow_angle > 150:
                            pushup_stage = "up"
                        if avg_elbow_angle < 90 and pushup_stage == "up":
                            pushup_stage = "down"
                            pushup_counter += 1
                            print(f"Push-up Rep: {pushup_counter}")
                    
                    elif current_exercise == "pullup":
                        # Pull-up counter logic
                        if avg_elbow_angle > 150:
                            pullup_stage = "down"
                        if avg_elbow_angle < 60 and pullup_stage == "down":
                            pullup_stage = "up"
                            pullup_counter += 1
                            print(f"Pull-up Rep: {pullup_counter}")
                    
                    # Visual feedback on screen
                    # Display torso angle
                    cv2.putText(image, f'Torso: {torso_angle:.1f}°', 
                               (w - 250, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                    
                    # Display elbow angles
                    cv2.putText(image, f'L: {left_elbow_angle:.1f}°  R: {right_elbow_angle:.1f}°', 
                               (w - 250, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
                    
                    # Print debug info every 50 frames
                    if frame_count % 50 == 0:
                        print(f"Frame {frame_count}: Exercise={current_exercise}, "
                              f"Torso={torso_angle:.1f}°, L={left_elbow_angle:.1f}°, R={right_elbow_angle:.1f}°")
            
            except Exception as e:
                # Print error for debugging
                if frame_count % 100 == 0:  # Print every 100 frames to avoid spam
                    print(f"Frame {frame_count}: Error in pose processing: {e}")
            
            # Setup UI elements
            # Main status box
            cv2.rectangle(image, (0, 0), (400, 160), (40, 40, 40), -1)
            
            # Define exercise colors
            exercise_colors = {
                "curl": (0, 255, 0),      # Green
                "pushup": (255, 165, 0),  # Orange
                "pullup": (0, 191, 255),  # Blue
                "none": (150, 150, 150)   # Gray
            }
            
            current_color = exercise_colors.get(current_exercise, (150, 150, 150))
            
            # Current exercise display
            cv2.putText(image, 'CURRENT EXERCISE:', (20, 40), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
            
            exercise_text = current_exercise.upper() if current_exercise != "none" else "NONE - MOVE TO POSITION"
            cv2.putText(image, exercise_text, (20, 90), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1.2, current_color, 3, cv2.LINE_AA)
            
            # Counters display box
            cv2.rectangle(image, (0, 170), (400, 320), (30, 30, 30), -1)
            
            # Bicep Curls counter
            cv2.putText(image, 'CURLS:', (20, 210), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
            cv2.putText(image, str(curl_counter), (20, 260), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2.0, (0, 255, 0), 4, cv2.LINE_AA)
            
            # Push-ups counter
            cv2.putText(image, 'PUSH-UPS:', (150, 210), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 165, 0), 2, cv2.LINE_AA)
            cv2.putText(image, str(pushup_counter), (150, 260), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 165, 0), 4, cv2.LINE_AA)
            
            # Pull-ups counter
            cv2.putText(image, 'PULL-UPS:', (280, 210), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 191, 255), 2, cv2.LINE_AA)
            cv2.putText(image, str(pullup_counter), (280, 260), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2.0, (0, 191, 255), 4, cv2.LINE_AA)
            
            # Instructions at bottom
            cv2.putText(image, 'Press Q to quit', (w - 150, h - 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1, cv2.LINE_AA)
            
            # Position instructions
            cv2.putText(image, 'Curl: Stand with arms down', (20, h - 80), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1, cv2.LINE_AA)
            cv2.putText(image, 'Push-up: Plank position', (20, h - 50), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1, cv2.LINE_AA)
            cv2.putText(image, 'Pull-up: Arms overhead', (20, h - 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1, cv2.LINE_AA)
            
            # Render pose landmarks
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    image, 
                    results.pose_landmarks, 
                    mp_pose.POSE_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(245, 117, 66), thickness=2, circle_radius=2),
                    mp_drawing.DrawingSpec(color=(245, 66, 230), thickness=2, circle_radius=2)
                )
            
            # Show the output
            cv2.imshow('Automatic Exercise Counter - Curls, Push-ups, Pull-ups', image)
            
            # Exit on 'q' key press
            if cv2.waitKey(10) & 0xFF == ord('q'):
                print("\nUser pressed 'Q' to quit")
                break
    
    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    
    # Print final counts
    print("\n" + "="*30)
    print("FINAL EXERCISE COUNTS:")
    print("="*30)
    print(f"Bicep Curls: {curl_counter}")
    print(f"Push-ups:   {pushup_counter}")
    print(f"Pull-ups:   {pullup_counter}")
    print("="*30)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user.")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()