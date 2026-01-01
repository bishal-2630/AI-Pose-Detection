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

def check_pushup_position_simple(landmarks):
    """
    SIMPLE push-up position check with relaxed requirements
    """
    try:
        # Get key points
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        
        # Check if wrists are visible
        if left_wrist.visibility < 0.2 or right_wrist.visibility < 0.2:
            return False, "Wrists not visible"
        
        # Simple check: body should not be completely vertical (standing)
        shoulder_avg_y = (left_shoulder.y + right_shoulder.y) / 2
        hip_avg_y = (left_hip.y + right_hip.y) / 2
        
        # In push-up, shoulders should not be way above hips
        if shoulder_avg_y < hip_avg_y - 0.4:  # Shoulders way above hips = standing
            return False, "Standing (get lower)"
        
        # Relaxed check: wrists should be roughly near shoulders
        left_wrist_diff = abs(left_wrist.y - left_shoulder.y)
        right_wrist_diff = abs(right_wrist.y - right_shoulder.y)
        
        if left_wrist_diff > 0.5 or right_wrist_diff > 0.5:
            return False, "Hands not at shoulder level"
        
        return True, "Ready for push-ups"
        
    except:
        return False, "Detection error"

def count_curls(counter, stage, left_angle, right_angle):
    """Count bicep curls"""
    avg_angle = (left_angle + right_angle) / 2
    
    if avg_angle > 160:
        stage = "down"
    
    if avg_angle < 50 and stage == "down":
        stage = "up"
        counter += 1
        print(f"Curl Rep #{counter}: L: {left_angle:.0f}°, R: {right_angle:.0f}°")
    
    return counter, stage

def count_pushups_with_thresholds(counter, stage, left_angle, right_angle, landmarks):
    """
    Count push-ups with realistic thresholds:
    - DOWN: Bend up to 100° (more realistic)
    - UP: Extend above 130° (easier to achieve)
    """
    # Check if in plausible push-up position
    in_position, feedback = check_pushup_position_simple(landmarks)
    
    if not in_position:
        stage = None
        return counter, stage, in_position, feedback
    
    # Skip invalid angles
    if left_angle < 10 or right_angle < 10:
        return counter, stage, in_position, "Ready - move arms"
    
    # Calculate average angle for consistency
    avg_angle = (left_angle + right_angle) / 2
    
    # UPDATED THRESHOLDS:
    # DOWN position: Bend up to 100° (more realistic)
    if avg_angle < 100:  # CHANGED from 70° to 100°
        if stage != "down":
            stage = "down"
            print(f"Push-up DOWN: L: {left_angle:.0f}°, R: {right_angle:.0f}°, Avg: {avg_angle:.0f}°")
    
    # UP position (count rep): Extend above 130°
    if avg_angle > 130 and stage == "down":  # CHANGED from 140° to 130°
        stage = "up"
        counter += 1
        print(f"Push-up Rep #{counter}: L: {left_angle:.0f}°, R: {right_angle:.0f}°, Avg: {avg_angle:.0f}°")
    
    # If just extended without coming from down
    if avg_angle > 130 and stage != "down":
        stage = "up"
    
    return counter, stage, in_position, feedback

def count_pullups_simple(counter, stage, left_angle, right_angle, landmarks):
    """Simple pull-up counting"""
    # Check if in pull-up position
    try:
        left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        
        in_position = (left_wrist.y < left_shoulder.y or 
                      right_wrist.y < right_shoulder.y)
    except:
        in_position = False
    
    if not in_position:
        stage = None
        return counter, stage, in_position, "Arms not overhead"
    
    # Skip invalid angles
    if left_angle < 10 or right_angle < 10:
        return counter, stage, in_position, "Ready"
    
    avg_angle = (left_angle + right_angle) / 2
    
    # Use similar thresholds for pull-ups
    if avg_angle < 100:
        stage = "up"
    
    if avg_angle > 130 and stage == "up":
        stage = "down"
        counter += 1
        print(f"Pull-up Rep #{counter}: L: {left_angle:.0f}°, R: {right_angle:.0f}°")
    
    if avg_angle > 130 and stage != "up":
        stage = "down"
    
    return counter, stage, in_position, "Ready for pull-ups"

def run_exercise_counter(exercise):
    """Run camera and count reps"""
    display_names = {
        "curls": "BICEP CURLS",
        "pushups": "PUSH-UPS",
        "pullups": "PULL-UPS"
    }
    
    print(f"\nStarting {display_names[exercise]} counter...")
    print("=" * 50)
    
    if exercise == "pushups":
        print("PRACTICAL PUSH-UP COUNTER")
        print("=" * 50)
        print("UPDATED THRESHOLDS:")
        print("- DOWN position: Bend up to 100° (more realistic)")
        print("- UP position: Extend above 130° (easier to achieve)")
        print("- Count: When going from DOWN → UP")
        print("\nINSTRUCTIONS:")
        print("1. Get into any push-up-like position")
        print("2. Bend arms up to 100° (not too deep)")
        print("3. Extend arms above 130°")
        print("4. Make sure both arms move together")
        print("\nTIP: You don't need perfect 90° bends!")
    
    print("\nPress 'Q' to quit")
    print("-" * 50)
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open camera!")
        return 0
    
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    counter = 0
    stage = None
    
    with mp_pose.Pose(
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
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
            in_position = True  # Default for curls
            feedback = "Ready"
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                try:
                    # Calculate elbow angles
                    left_shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                                    landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                    left_elbow = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                                 landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
                    left_wrist = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                                 landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
                    left_angle = calculate_angle(left_shoulder, left_elbow, left_wrist)
                    
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
                        feedback = "Ready for curls"
                    elif exercise == "pushups":
                        counter, stage, in_position, feedback = count_pushups_with_thresholds(
                            counter, stage, left_angle, right_angle, landmarks)
                    elif exercise == "pullups":
                        counter, stage, in_position, feedback = count_pullups_simple(
                            counter, stage, left_angle, right_angle, landmarks)
                            
                except Exception as e:
                    feedback = "Calculating..."
                    pass
            
            # ===== UI =====
            ui_width = 300
            
            overlay = image.copy()
            cv2.rectangle(overlay, (0, 0), (ui_width, h), (0, 0, 0), -1)
            image = cv2.addWeighted(overlay, 0.7, image, 0.3, 0)
            
            colors = {
                "curls": (0, 255, 0),
                "pushups": (255, 165, 0),
                "pullups": (0, 191, 255)
            }
            
            # Title
            cv2.putText(image, display_names[exercise], (20, 40), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, colors[exercise], 2)
            
            # Counter
            counter_color = (0, 255, 0) if in_position else (100, 100, 100)
            cv2.putText(image, "REPS", (20, 90), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
            cv2.putText(image, str(counter), (20, 150), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2.5, counter_color, 4)
            
            # Stage indicator
            if stage and in_position:
                if stage == "up":
                    stage_color = (0, 255, 0)  # Green
                    stage_text = "UP (EXTENDED)"
                else:
                    stage_color = (255, 165, 0)  # Orange
                    stage_text = "DOWN (BENT)"
                
                cv2.putText(image, stage_text, (20, 200), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, stage_color, 2)
            
            # Current angles
            avg_angle = (left_angle + right_angle) / 2 if left_angle > 0 and right_angle > 0 else 0
            
            cv2.putText(image, "CURRENT ANGLES:", (20, h-120), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            cv2.putText(image, f"Left: {left_angle:.0f}°", (20, h-90), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            cv2.putText(image, f"Right: {right_angle:.0f}°", (20, h-60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            cv2.putText(image, f"Avg: {avg_angle:.0f}°", (20, h-30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 1)
            
            # Status box
            status_color = (0, 255, 0) if in_position else (255, 100, 100)
            cv2.rectangle(image, (15, 230), (ui_width-15, 300), (40, 40, 40), -1)
            cv2.rectangle(image, (15, 230), (ui_width-15, 300), (100, 100, 100), 1)
            
            cv2.putText(image, "STATUS:", (20, 250), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 1)
            
            # Show feedback
            if len(feedback) > 25:
                cv2.putText(image, feedback[:25], (20, 275), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                if len(feedback) > 50:
                    cv2.putText(image, feedback[25:50], (20, 295), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            else:
                cv2.putText(image, feedback, (20, 275), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Requirements for push-ups (with new thresholds)
            if exercise == "pushups":
                cv2.putText(image, "REQUIREMENTS:", (20, 310), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 255), 1)
                cv2.putText(image, "Bend: Up to 100°", (20, 330), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 255), 1)
                cv2.putText(image, "Extend: Above 130°", (20, 350), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 255), 1)
                
                # Angle status indicator
                if avg_angle > 0:
                    if avg_angle < 100:
                        angle_status = "GOOD BEND ✓"
                        angle_color = (255, 165, 0)
                    elif avg_angle > 130:
                        angle_status = "GOOD EXTENSION ✓"
                        angle_color = (0, 255, 0)
                    else:
                        angle_status = "MIDDLE RANGE"
                        angle_color = (255, 255, 0)
                    
                    cv2.putText(image, angle_status, (20, 370), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, angle_color, 1)
            
            # Visual angle indicators on elbows
            if left_angle > 10 and right_angle > 10:
                try:
                    # Get elbow positions
                    left_elbow = landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value]
                    right_elbow = landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value]
                    
                    le_x = int(left_elbow.x * w)
                    le_y = int(left_elbow.y * h)
                    re_x = int(right_elbow.x * w)
                    re_y = int(right_elbow.y * h)
                    
                    # Determine color based on angle
                    left_color = (255, 165, 0) if left_angle < 100 else (0, 255, 0) if left_angle > 130 else (255, 255, 0)
                    right_color = (255, 165, 0) if right_angle < 100 else (0, 255, 0) if right_angle > 130 else (255, 255, 0)
                    
                    # Draw elbow indicators
                    cv2.circle(image, (le_x, le_y), 10, left_color, -1)
                    cv2.circle(image, (re_x, re_y), 10, right_color, -1)
                    
                    # Draw angle text
                    cv2.putText(image, f"{left_angle:.0f}°", (le_x+15, le_y), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, left_color, 2)
                    cv2.putText(image, f"{right_angle:.0f}°", (re_x+15, re_y), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, right_color, 2)
                    
                except:
                    pass
            
            # Draw pose landmarks
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=colors[exercise], thickness=2, circle_radius=2),
                    mp_drawing.DrawingSpec(color=(100, 100, 100), thickness=1, circle_radius=1)
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
    print("PRACTICAL PUSH-UP COUNTER")
    print("Bend up to 100°, Extend above 130°")
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