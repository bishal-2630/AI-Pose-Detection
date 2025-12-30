import cv2
import numpy as np

# Try importing MediaPipe
try:
    import mediapipe as mp
    mp_drawing = mp.solutions.drawing_utils
    mp_pose = mp.solutions.pose
    print("MediaPipe imported successfully!")
except ImportError as e:
    print(f"Error: {e}")
    print("Install: pip install mediapipe")
    exit(1)

def show_exercise_dialog():
    """Show dialog box to select exercise"""
    dialog = np.zeros((300, 500, 3), dtype=np.uint8)
    
    cv2.putText(dialog, 'SELECT EXERCISE', (100, 50), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    
    button_width = 200
    button_height = 50
    start_y = 100
    
    exercises = [
        ("BICEP CURLS", (0, 255, 0)),
        ("PUSH-UPS", (255, 165, 0)),
        ("PULL-UPS", (0, 191, 255)),
        ("EXIT", (255, 50, 50))
    ]
    
    buttons = []
    
    for i, (name, color) in enumerate(exercises):
        y = start_y + i * (button_height + 20)
        x = 150
        
        cv2.rectangle(dialog, (x, y), (x + button_width, y + button_height), color, -1)
        cv2.rectangle(dialog, (x, y), (x + button_width, y + button_height), (255, 255, 255), 2)
        
        text_size = cv2.getTextSize(name, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
        text_x = x + (button_width - text_size[0]) // 2
        text_y = y + (button_height + text_size[1]) // 2
        
        cv2.putText(dialog, name, (text_x, text_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        buttons.append((x, y, x + button_width, y + button_height, name))
    
    cv2.putText(dialog, 'Click to select | Press ESC to exit', (100, 280), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
    
    cv2.imshow('Select Exercise', dialog)
    
    selected = None
    while True:
        key = cv2.waitKey(1) & 0xFF
        
        def mouse_callback(event, x, y, flags, param):
            nonlocal selected
            if event == cv2.EVENT_LBUTTONDOWN:
                for bx1, by1, bx2, by2, name in buttons:
                    if bx1 <= x <= bx2 and by1 <= y <= by2:
                        selected = name
                        break
        
        cv2.setMouseCallback('Select Exercise', mouse_callback)
        
        if selected is not None:
            break
            
        if key == 27:
            selected = "EXIT"
            break
    
    cv2.destroyWindow('Select Exercise')
    
    if selected == "EXIT":
        return None
    
    exercise_map = {
        "BICEP CURLS": "curls",
        "PUSH-UPS": "pushups",
        "PULL-UPS": "pullups"
    }
    
    print(f"\nSelected: {selected}")
    return exercise_map.get(selected)

def calculate_angle(a, b, c):
    """Calculate angle between three points"""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
    
    return angle

def is_pushup_position_for_face_camera(landmarks):
    """
    Check if body is in push-up position when camera is facing you.
    Camera sees your face when you're in push-up position.
    """
    try:
        # Get key landmarks
        nose = landmarks[mp_pose.PoseLandmark.NOSE.value]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        
        # For push-ups with camera facing you:
        # 1. Nose should be visible (camera sees your face)
        # 2. Shoulders should be above hips (you're looking at camera)
        # 3. Wrists should be near shoulder level (hands on ground)
        
        # Check if nose is visible (y coordinate < 1.0 means it's in frame)
        nose_visible = nose.y < 0.9
        
        # Check if shoulders are above hips (for push-up position)
        shoulders_above_hips = (left_shoulder.y < left_hip.y and 
                               right_shoulder.y < right_hip.y)
        
        # Check if wrists are near shoulders (hands at shoulder level)
        left_wrist_near_shoulder = abs(left_wrist.y - left_shoulder.y) < 0.3
        right_wrist_near_shoulder = abs(right_wrist.y - right_shoulder.y) < 0.3
        wrists_at_shoulder_level = left_wrist_near_shoulder or right_wrist_near_shoulder
        
        # All conditions must be true for push-up position
        return nose_visible and shoulders_above_hips and wrists_at_shoulder_level
        
    except:
        return False

def count_curls(counter, stage, left_angle, right_angle):
    """Count bicep curls"""
    avg_angle = (left_angle + right_angle) / 2
    
    if avg_angle > 160:
        stage = "down"
    
    if avg_angle < 50 and stage == "down":
        stage = "up"
        counter += 1
        print(f"Curl Rep: {counter}")
    
    return counter, stage

def count_pushups_for_face_camera(counter, stage, left_angle, right_angle, landmarks):
    """
    Count push-ups when camera is facing you.
    Uses elbow angle to count reps.
    """
    avg_angle = (left_angle + right_angle) / 2
    
    # First check if we're in push-up position (camera sees face)
    in_position = is_pushup_position_for_face_camera(landmarks)
    
    if not in_position:
        # Not in push-up position
        stage = None
        return counter, stage, in_position
    
    # IN PUSH-UP POSITION - count using elbow angles
    
    # Push-up counting logic:
    # UP position: Arms extended (elbow angle > 160°)
    # DOWN position: Arms bent, chest lowered (elbow angle < 90°)
    # Count: When going from UP -> DOWN -> UP (one full rep)
    
    if avg_angle > 160:  # Arms fully extended - UP position
        stage = "up"
    
    if avg_angle < 90 and stage == "up":  # Arms bent - DOWN position (count rep)
        stage = "down"
        counter += 1
        print(f"Push-up Rep: {counter}")
    
    return counter, stage, in_position

def count_pullups(counter, stage, left_angle, right_angle, landmarks):
    """Count pull-ups"""
    avg_angle = (left_angle + right_angle) / 2
    
    # Check if in pull-up position (arms overhead)
    try:
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        
        left_wrist_above = left_wrist.y < left_shoulder.y - 0.05
        right_wrist_above = right_wrist.y < right_shoulder.y - 0.05
        in_position = left_wrist_above or right_wrist_above
    except:
        in_position = False
    
    if not in_position:
        stage = None
        return counter, stage, in_position
    
    if avg_angle > 150:
        stage = "down"
    
    if avg_angle < 80 and stage == "down":
        stage = "up"
        counter += 1
        print(f"Pull-up Rep: {counter}")
    
    return counter, stage, in_position

def run_exercise_counter(exercise):
    """Run camera and count reps"""
    display_names = {
        "curls": "BICEP CURLS",
        "pushups": "PUSH-UPS",
        "pullups": "PULL-UPS"
    }
    
    print(f"\nStarting {display_names[exercise]} counter...")
    print("INSTRUCTIONS:")
    
    if exercise == "pushups":
        print("1. Place camera in front of your face")
        print("2. Get into push-up position (camera should see your face)")
        print("3. Perform push-ups normally")
    elif exercise == "curls":
        print("1. Stand facing camera")
        print("2. Perform bicep curls")
    elif exercise == "pullups":
        print("1. Stand with arms overhead")
        print("2. Perform pull-up motion")
    
    print("\nPress 'Q' to quit\n")
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open camera!")
        return 0
    
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    counter = 0
    stage = None
    
    with mp_pose.Pose(
        min_detection_confidence=0.7,
        min_tracking_confidence=0.7,
        model_complexity=1
    ) as pose:
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Flip for mirror view
            frame = cv2.flip(frame, 1)
            
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
            results = pose.process(image)
            image.flags.writeable = True
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            h, w = image.shape[:2]
            
            left_angle = right_angle = 0
            landmarks = None
            in_position = True  # Default True for curls
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Get left elbow angle
                left_shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                                landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                left_elbow = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                             landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
                left_wrist = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                             landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
                left_angle = calculate_angle(left_shoulder, left_elbow, left_wrist)
                
                # Get right elbow angle
                right_shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                                 landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                right_elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                              landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                right_wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                              landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
                right_angle = calculate_angle(right_shoulder, right_elbow, right_wrist)
                
                # Count based on exercise
                if exercise == "curls":
                    counter, stage = count_curls(counter, stage, left_angle, right_angle)
                    in_position = True
                elif exercise == "pushups":
                    counter, stage, in_position = count_pushups_for_face_camera(
                        counter, stage, left_angle, right_angle, landmarks)
                elif exercise == "pullups":
                    counter, stage, in_position = count_pullups(
                        counter, stage, left_angle, right_angle, landmarks)
            
            # ===== UI ON LEFT SIDE =====
            ui_width = 250
            
            overlay = image.copy()
            cv2.rectangle(overlay, (0, 0), (ui_width, h), (0, 0, 0), -1)
            image = cv2.addWeighted(overlay, 0.7, image, 0.3, 0)
            
            colors = {
                "curls": (0, 255, 0),
                "pushups": (255, 165, 0),
                "pullups": (0, 191, 255)
            }
            
            cv2.putText(image, display_names[exercise], (20, 40), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, colors[exercise], 2)
            
            # Counter
            cv2.putText(image, "REPS:", (20, 100), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
            cv2.putText(image, str(counter), (20, 160), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2.0, (0, 255, 0), 3)
            
            # Stage
            if stage:
                stage_color = (0, 255, 0) if stage == "up" else (255, 165, 0)
                cv2.putText(image, f"STAGE: {stage.upper()}", (20, 220), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, stage_color, 2)
            
            # Angles
            cv2.putText(image, f"L: {left_angle:.0f}°", (20, h-80), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            cv2.putText(image, f"R: {right_angle:.0f}°", (20, h-50), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            
            # Position status
            if exercise in ["pushups", "pullups"]:
                if in_position:
                    status_text = "READY TO COUNT ✓"
                    status_color = (0, 255, 0)
                else:
                    if exercise == "pushups":
                        status_text = "MOVE TO PUSH-UP"
                    else:
                        status_text = "ARMS NOT OVERHEAD"
                    status_color = (0, 0, 255)
                
                cv2.putText(image, status_text, (20, 260), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
            
            # Draw landmarks if in position (or always for curls)
            if results.pose_landmarks:
                if exercise == "curls" or in_position:
                    mp_drawing.draw_landmarks(
                        image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                        mp_drawing.DrawingSpec(color=colors[exercise], thickness=2, circle_radius=2),
                        mp_drawing.DrawingSpec(color=(200, 200, 200), thickness=2, circle_radius=2)
                    )
            
            # Instruction
            cv2.putText(image, "Press Q to quit", (w-150, h-20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 255), 1)
            
            # Show image
            cv2.imshow(f'{display_names[exercise]} Counter', image)
            
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break
    
    cap.release()
    cv2.destroyAllWindows()
    return counter

def main():
    print("="*50)
    print("EXERCISE COUNTER")
    print("="*50)
    
    while True:
        exercise = show_exercise_dialog()
        
        if exercise is None:
            print("\nGoodbye!")
            break
        
        count = run_exercise_counter(exercise)
        
        print(f"\n{'='*40}")
        print(f"RESULT: {count} reps")
        print(f"{'='*40}")
        
        again = input("\nCount another exercise? (y/n): ").lower()
        if again != 'y':
            print("\nGoodbye!")
            break

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nStopped by user")
    except Exception as e:
        print(f"\nError: {e}")