import cv2
import numpy as np
import mediapipe as mp

# Initialize MediaPipe components
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

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

# Initialize video capture
cap = cv2.VideoCapture(0)

# Initialize counter variables
counter = 0
stage = None

# Setup MediaPipe instance
with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    while cap.isOpened():
        ret, frame = cap.read()
        
        if not ret:
            print("Failed to grab frame")
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
        
        # Extract landmarks
        try:
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Get coordinates for left arm
                shoulder = [
                    landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                    landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y
                ]
                elbow = [
                    landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                    landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y
                ]
                wrist = [
                    landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                    landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y
                ]
                
                # Calculate elbow angle
                angle = calculate_angle(shoulder, elbow, wrist)
                
                # Visualize angle near elbow
                h, w, _ = image.shape
                elbow_pixel = (int(elbow[0] * w), int(elbow[1] * h))
                
                cv2.putText(
                    image, 
                    f'Angle: {angle:.1f}',
                    elbow_pixel,
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.7, 
                    (0, 255, 0), 
                    2, 
                    cv2.LINE_AA
                )
                
                # Curl counter logic
                if angle > 160:
                    stage = "down"
                if angle < 30 and stage == "down":
                    stage = "up"
                    counter += 1
                    print(f"Rep Count: {counter}")
        
        except Exception as e:
            # print(f"Error: {e}")
            pass
        
        # Setup status box
        cv2.rectangle(image, (0, 0), (225, 100), (245, 117, 16), -1)
        
        # Rep data
        cv2.putText(image, 'REPS', (15, 20), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA)
        cv2.putText(image, str(counter), 
                    (15, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Stage data
        cv2.putText(image, 'STAGE', (100, 20), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA)
        cv2.putText(image, stage if stage else "None", 
                    (100, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)
        
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
        cv2.imshow('Pose Estimation - Bicep Curl Counter', image)
        
        # Exit on 'q' key press
        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

# Cleanup
cap.release()
cv2.destroyAllWindows()