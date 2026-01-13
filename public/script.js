// DOM Elements
const videoElement = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasCtx = overlayCanvas.getContext('2d');
const leftAngleTitle = document.getElementById('leftAngleTitle');
const rightAngleTitle = document.getElementById('rightAngleTitle');
const landmarkTitle = document.getElementById('landmarkTitle');
const totalRepsDisplay = document.getElementById('totalRepsDisplay');
const leftAngleValue = document.getElementById('leftAngleValue');
const rightAngleValue = document.getElementById('rightAngleValue');
const leftAngleFill = document.getElementById('leftAngleFill');
const rightAngleFill = document.getElementById('rightAngleFill');
const leftStage = document.getElementById('leftStage');
const rightStage = document.getElementById('rightStage');
const leftStageText = document.getElementById('leftStageText');
const rightStageText = document.getElementById('rightStageText');
const leftStageIndicator = document.getElementById('leftStageIndicator');
const rightStageIndicator = document.getElementById('rightStageIndicator');
const leftCounter = document.getElementById('leftCounter');
const rightCounter = document.getElementById('rightCounter');
const totalCounter = document.getElementById('totalCounter');
const detectedPoints = document.getElementById('detectedPoints');
const landmarksProgress = document.getElementById('landmarksProgress');
const poseStatus = document.getElementById('poseStatus');
const processingMode = document.getElementById('processingMode');
const latencyDisplay = document.getElementById('latencyDisplay');
const fpsCounter = document.getElementById('fpsCounter');
const confidenceDisplay = document.getElementById('confidenceDisplay');
const detectionStatus = document.getElementById('detectionStatus');
const armVisibility = document.getElementById('armVisibility');
const resetBtn = document.getElementById('resetBtn');
const selectionPage = document.getElementById('selectionPage');
const detectionPage = document.getElementById('detectionPage');
const backBtn = document.getElementById('backBtn');
const currentExerciseName = document.getElementById('currentExerciseName');
const permissionPrompt = document.getElementById('permissionPrompt');

// Exercise-specific configurations
const exerciseConfig = {
    bicep_curl: {
        name: 'Bicep Curls',
        angleUp: 40,    // Angle threshold for "up" position (arm bent)
        angleDown: 160, // Angle threshold for "down" position (arm extended)
        upLabel: 'UP',
        downLabel: 'DOWN',
        upColor: '#EF476F',
        downColor: '#FF6B6B',
        readyColor: '#a0a0c0',
        countingLogic: 'bicep_curl'
    },
    pull_up: {
        name: 'Pull-ups',
        angleUp: 30,    // Different thresholds for pull-ups (chin above bar)
        angleDown: 120, // Different thresholds for pull-ups (arms extended)
        upLabel: 'CHIN UP',
        downLabel: 'EXTENDED',
        upColor: '#06D6A0',
        downColor: '#4CC9F0',
        readyColor: '#a0a0c0',
        countingLogic: 'pull_up'
    },
    push_up: {
        name: 'Push-ups',
        angleUp: 60,    // Different thresholds for push-ups (chest down)
        angleDown: 150, // Different thresholds for push-ups (arms extended)
        upLabel: 'DOWN',
        downLabel: 'UP',
        upColor: '#EF476F',
        downColor: '#FFD166',
        readyColor: '#a0a0c0',
        countingLogic: 'push_up'
    }
};

// State variables
let leftArmCounter = 0;
let rightArmCounter = 0;
let totalRepsCounter = 0;
let leftStageState = null;
let rightStageState = null;
let leftArmAngle = 0;
let rightArmAngle = 0;
let useAPI = true;
let pose = null;
let camera = null;
let mediaStream = null;
let frameCount = 0;
let fps = 0;
let landmarks = null;
let detectionConfidence = 0;
let repInProgress = false;
let selectedExercise = 'bicep_curl';
let isCameraStarting = false;

// Colors for correct left/right mapping (person's perspective)
const COLORS = {
    leftSide: '#FF6B6B',      // Red for left side (person's left)
    rightSide: '#4CC9F0',     // Blue for right side (person's right)
    center: '#FFD166',        // Yellow for center points
    connections: '#118AB2',   // Blue for skeleton lines
    angleArc: '#06D6A0',      // Green for angle arcs
    activeArm: '#EF476F'      // Pink for active arm highlights
};

// MediaPipe landmark indices (person's perspective) - FULL SET
const LANDMARK_INDICES = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

// Full skeleton connections as before
const SKELETON_CONNECTIONS = [
    // Face connections
    [LANDMARK_INDICES.NOSE, LANDMARK_INDICES.LEFT_EYE_INNER],
    [LANDMARK_INDICES.LEFT_EYE_INNER, LANDMARK_INDICES.LEFT_EYE],
    [LANDMARK_INDICES.LEFT_EYE, LANDMARK_INDICES.LEFT_EYE_OUTER],
    [LANDMARK_INDICES.LEFT_EYE_OUTER, LANDMARK_INDICES.LEFT_EAR],
    [LANDMARK_INDICES.NOSE, LANDMARK_INDICES.RIGHT_EYE_INNER],
    [LANDMARK_INDICES.RIGHT_EYE_INNER, LANDMARK_INDICES.RIGHT_EYE],
    [LANDMARK_INDICES.RIGHT_EYE, LANDMARK_INDICES.RIGHT_EYE_OUTER],
    [LANDMARK_INDICES.RIGHT_EYE_OUTER, LANDMARK_INDICES.RIGHT_EAR],
    [LANDMARK_INDICES.MOUTH_LEFT, LANDMARK_INDICES.MOUTH_RIGHT],

    // Upper body
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.RIGHT_SHOULDER],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW],
    [LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW],
    [LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_HIP],
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_HIP],

    // Hand connections
    [LANDMARK_INDICES.LEFT_WRIST, LANDMARK_INDICES.LEFT_THUMB],
    [LANDMARK_INDICES.LEFT_WRIST, LANDMARK_INDICES.LEFT_INDEX],
    [LANDMARK_INDICES.LEFT_WRIST, LANDMARK_INDICES.LEFT_PINKY],
    [LANDMARK_INDICES.RIGHT_WRIST, LANDMARK_INDICES.RIGHT_THUMB],
    [LANDMARK_INDICES.RIGHT_WRIST, LANDMARK_INDICES.RIGHT_INDEX],
    [LANDMARK_INDICES.RIGHT_WRIST, LANDMARK_INDICES.RIGHT_PINKY],

    // Lower body
    [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.RIGHT_HIP],
    [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.LEFT_KNEE],
    [LANDMARK_INDICES.LEFT_KNEE, LANDMARK_INDICES.LEFT_ANKLE],
    [LANDMARK_INDICES.RIGHT_HIP, LANDMARK_INDICES.RIGHT_KNEE],
    [LANDMARK_INDICES.RIGHT_KNEE, LANDMARK_INDICES.RIGHT_ANKLE],
    [LANDMARK_INDICES.LEFT_ANKLE, LANDMARK_INDICES.LEFT_HEEL],
    [LANDMARK_INDICES.RIGHT_ANKLE, LANDMARK_INDICES.RIGHT_HEEL],
    [LANDMARK_INDICES.LEFT_HEEL, LANDMARK_INDICES.LEFT_FOOT_INDEX],
    [LANDMARK_INDICES.RIGHT_HEEL, LANDMARK_INDICES.RIGHT_FOOT_INDEX]
];

// ==================== HELPER FUNCTIONS ====================

function flipX(x, width) {
    return width - x * width; // Mirror effect
}

function flipY(y, height) {
    return y * height;
}

function distance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// ==================== PAGE NAVIGATION ====================

function goToDetectionPage(exerciseType) {
    console.log(`Starting exercise: ${exerciseType}`);
    
    selectedExercise = exerciseType;
    const config = exerciseConfig[exerciseType];
    
    if (!config) {
        console.error(`Invalid exercise type: ${exerciseType}`);
        return;
    }
    
    // Update UI
    currentExerciseName.textContent = config.name;
    
    // Switch pages
    selectionPage.classList.remove('active');
    detectionPage.classList.add('active');
    
    // Reset counters for new exercise
    resetAll();
    
    // Reset exercise-specific states
    resetExerciseSpecificStates();
    
    // Show permission prompt immediately
    showPermissionPrompt();
    
    // Start camera after a short delay
    setTimeout(() => {
        startCamera();
    }, 300);
}

function goToSelectionPage() {
    console.log('Going back to selection page');
    
    // Stop camera and clean up
    stopCamera();
    
    // Switch pages
    detectionPage.classList.remove('active');
    selectionPage.classList.add('active');
    
    // Reset all counters
    resetAll();
}

function showPermissionPrompt() {
    if (permissionPrompt) {
        permissionPrompt.style.display = 'flex';
    }
    updateStatus('Waiting for camera permission...');
}

function hidePermissionPrompt() {
    if (permissionPrompt) {
        permissionPrompt.style.display = 'none';
    }
}

// ==================== RESET FUNCTION ====================

function resetAll() {
    leftArmCounter = 0;
    rightArmCounter = 0;
    totalRepsCounter = 0;
    leftStageState = null;
    rightStageState = null;
    repInProgress = false;

    updateLeftCounter();
    updateRightCounter();
    updateTotalReps();
    updateTotalRepsDisplay();
    
    // Reset to exercise-specific default colors
    const config = exerciseConfig[selectedExercise];
    updateLeftStage('--', config.readyColor);
    updateRightStage('--', config.readyColor);
    updateLeftStageProgress(0);
    updateRightStageProgress(0);
    clearCanvas();
    
    updateTitleAngles();

    // Visual feedback
    totalRepsDisplay.style.color = '#EF476F';
    setTimeout(() => {
        totalRepsDisplay.style.color = '#FFFFFF';
    }, 300);
    
    updateStatus('Ready - Begin your exercise!');
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    if (isCameraStarting) {
        console.log('Camera is already starting...');
        return;
    }
    
    isCameraStarting = true;
    
    try {
        updateStatus('Requesting camera access...');
        
        // Clean up any existing camera
        stopCamera();
        
        // Request camera permissions
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        console.log('Requesting camera permissions...');
        
        // This will trigger the browser's permission dialog
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mediaStream) {
            throw new Error('Failed to get media stream');
        }
        
        console.log('Camera access granted!');
        hidePermissionPrompt();
        
        // Set the video stream
        videoElement.srcObject = mediaStream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        
        // Wait for video to be ready
        await waitForVideoReady();
        
        // Set canvas size
        overlayCanvas.width = videoElement.videoWidth || 640;
        overlayCanvas.height = videoElement.videoHeight || 480;
        
        console.log(`Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        
        // Initialize MediaPipe
        await initializeMediaPipe();
        
        if (!pose) {
            throw new Error('Failed to initialize pose detection');
        }
        
        // Start camera processing with MediaPipe
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (pose) {
                    try {
                        await pose.send({ image: videoElement });
                    } catch (error) {
                        console.error('Pose detection error:', error);
                    }
                }
            },
            width: videoElement.videoWidth || 640,
            height: videoElement.videoHeight || 480
        });
        
        await camera.start();
        updateStatus('Ready - Move into frame!');
        
        // Start FPS counter
        startFPSCounter();
        
        console.log('Camera and MediaPipe started successfully');
        
    } catch (error) {
        console.error('Camera error:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            updateStatus('Camera access denied');
            showPermissionPrompt();
            alert('⚠️ Camera access is required for exercise tracking.\n\nPlease click "Allow" when prompted for camera permissions.');
            
        } else if (error.name === 'NotFoundError') {
            updateStatus('No camera found');
            alert('No camera found on your device. Please connect a camera and try again.');
        } else {
            updateStatus('Error: ' + error.message);
            alert('Failed to start camera: ' + error.message);
        }
        
        // Go back to selection page after error
        setTimeout(() => {
            goToSelectionPage();
        }, 2000);
    } finally {
        isCameraStarting = false;
    }
}

function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (pose) {
        pose.close();
        pose = null;
    }
}

function waitForVideoReady() {
    return new Promise((resolve, reject) => {
        if (videoElement.readyState >= 2) {
            console.log('Video already ready');
            resolve();
            return;
        }
        
        const onLoaded = () => {
            console.log('Video metadata loaded');
            videoElement.removeEventListener('loadedmetadata', onLoaded);
            videoElement.removeEventListener('error', onError);
            resolve();
        };
        
        const onError = (error) => {
            console.error('Video error:', error);
            videoElement.removeEventListener('loadedmetadata', onLoaded);
            videoElement.removeEventListener('error', onError);
            reject(error);
        };
        
        videoElement.addEventListener('loadedmetadata', onLoaded);
        videoElement.addEventListener('error', onError);
        
        // Try to play the video
        videoElement.play().catch(error => {
            console.warn('Auto-play prevented:', error);
        });
        
        // Fallback timeout
        setTimeout(() => {
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                console.log('Video ready (fallback)');
                resolve();
            } else {
                console.warn('Video not fully loaded, but continuing');
                resolve();
            }
        }, 3000);
    });
}

// ==================== MEDIAPIPE INITIALIZATION ====================

async function initializeMediaPipe() {
    try {
        updateStatus('Loading pose detection...');
        
        // Load MediaPipe scripts if not already loaded
        if (typeof window.Pose === 'undefined' || typeof window.Camera === 'undefined') {
            console.log('Loading MediaPipe scripts...');
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
            console.log('MediaPipe scripts loaded');
        }
        
        // Initialize MediaPipe Pose
        pose = new window.Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        pose.onResults(onPoseResults);
        
        console.log('MediaPipe Pose initialized successfully');
        updateStatus('Pose detection ready');
        return true;
        
    } catch (error) {
        console.error('MediaPipe initialization error:', error);
        updateStatus('Pose detection failed');
        return false;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            console.log(`Script already loaded: ${src}`);
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`Script loaded: ${src}`);
            resolve();
        };
        script.onerror = (error) => {
            console.error(`Failed to load script: ${src}`, error);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}

// ==================== POSE DETECTION & VISUALIZATION ====================

function onPoseResults(results) {
    if (!results) return;
    
    const startTime = performance.now();
    
    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        landmarks = results.poseLandmarks;
        detectionConfidence = calculateConfidence(results);

        // Count detected landmarks
        const detectedCount = countDetectedLandmarks(landmarks);
        updateLandmarkStats(detectedCount);

        // Clear and draw skeleton with correct left/right mapping
        clearCanvas();
        drawSkeleton(results);

        // Calculate and display both arm angles
        calculateArmAngles(landmarks);

        updateStatus(`${detectedCount} points detected`);
        
        // Update latency
        const latency = Math.round(performance.now() - startTime);
        updateLatency(latency);
    } else {
        landmarks = null;
        clearCanvas();
        updateLandmarkStats(0);
        updateStatus('Move into frame - No pose detected');
    }
    
    frameCount++;
}

function countDetectedLandmarks(landmarks) {
    return landmarks.filter(landmark =>
        landmark && landmark.visibility && landmark.visibility > 0.1
    ).length;
}

function calculateConfidence(results) {
    if (!results.poseWorldLandmarks) return 0;
    const sum = results.poseWorldLandmarks.reduce((acc, landmark) =>
        acc + (landmark.visibility || 0), 0
    );
    return Math.round((sum / results.poseWorldLandmarks.length) * 100);
}

function drawSkeleton(results) {
    const videoWidth = overlayCanvas.width;
    const videoHeight = overlayCanvas.height;

    // Draw all connections first
    drawConnections(results.poseLandmarks, videoWidth, videoHeight);

    // Draw all landmarks on top
    drawLandmarks(results.poseLandmarks, videoWidth, videoHeight);

    // Draw arm angles
    drawArmAngles(results.poseLandmarks, videoWidth, videoHeight);
}

function drawConnections(landmarks, width, height) {
    if (!landmarks) return;
    
    canvasCtx.lineWidth = 3;
    canvasCtx.lineCap = 'round';

    SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];

        if (start && end && start.visibility > 0.1 && end.visibility > 0.1) {
            // Determine color based on side (person's perspective)
            let color = COLORS.connections;

            // Person's left side connections
            if (startIdx === LANDMARK_INDICES.LEFT_SHOULDER || 
                startIdx === LANDMARK_INDICES.LEFT_ELBOW ||
                startIdx === LANDMARK_INDICES.LEFT_WRIST ||
                startIdx === LANDMARK_INDICES.LEFT_HIP ||
                startIdx === LANDMARK_INDICES.LEFT_KNEE ||
                startIdx === LANDMARK_INDICES.LEFT_ANKLE ||
                endIdx === LANDMARK_INDICES.LEFT_SHOULDER ||
                endIdx === LANDMARK_INDICES.LEFT_ELBOW ||
                endIdx === LANDMARK_INDICES.LEFT_WRIST ||
                endIdx === LANDMARK_INDICES.LEFT_HIP ||
                endIdx === LANDMARK_INDICES.LEFT_KNEE ||
                endIdx === LANDMARK_INDICES.LEFT_ANKLE) {
                color = COLORS.leftSide;
            }
            // Person's right side connections
            else if (startIdx === LANDMARK_INDICES.RIGHT_SHOULDER ||
                     startIdx === LANDMARK_INDICES.RIGHT_ELBOW ||
                     startIdx === LANDMARK_INDICES.RIGHT_WRIST ||
                     startIdx === LANDMARK_INDICES.RIGHT_HIP ||
                     startIdx === LANDMARK_INDICES.RIGHT_KNEE ||
                     startIdx === LANDMARK_INDICES.RIGHT_ANKLE ||
                     endIdx === LANDMARK_INDICES.RIGHT_SHOULDER ||
                     endIdx === LANDMARK_INDICES.RIGHT_ELBOW ||
                     endIdx === LANDMARK_INDICES.RIGHT_WRIST ||
                     endIdx === LANDMARK_INDICES.RIGHT_HIP ||
                     endIdx === LANDMARK_INDICES.RIGHT_KNEE ||
                     endIdx === LANDMARK_INDICES.RIGHT_ANKLE) {
                color = COLORS.rightSide;
            }

            drawLine(start, end, width, height, color);
        }
    });
}

function drawLine(start, end, width, height, color) {
    // Convert normalized coordinates to canvas coordinates with mirroring
    const startX = flipX(start.x, width);
    const startY = flipY(start.y, height);
    const endX = flipX(end.x, width);
    const endY = flipY(end.y, height);

    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    canvasCtx.lineTo(endX, endY);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 3;
    canvasCtx.lineCap = 'round';
    canvasCtx.stroke();
}

function drawLandmarks(landmarks, width, height) {
    if (!landmarks) return;
    
    landmarks.forEach((landmark, index) => {
        if (landmark && landmark.visibility > 0.1) {
            // Determine color based on side and importance
            let color, size;

            if (index <= 10) {
                // Face landmarks
                color = index <= 3 || index === 7 || index === 9 ? 
                        COLORS.leftSide : COLORS.rightSide;
                size = 5;
            } else if (index <= 22) {
                // Upper body
                if (index === LANDMARK_INDICES.LEFT_SHOULDER ||
                    index === LANDMARK_INDICES.LEFT_ELBOW ||
                    index === LANDMARK_INDICES.LEFT_WRIST ||
                    index === LANDMARK_INDICES.LEFT_PINKY ||
                    index === LANDMARK_INDICES.LEFT_INDEX ||
                    index === LANDMARK_INDICES.LEFT_THUMB) {
                    color = COLORS.leftSide;
                    size = 8;
                } else if (index === LANDMARK_INDICES.RIGHT_SHOULDER ||
                           index === LANDMARK_INDICES.RIGHT_ELBOW ||
                           index === LANDMARK_INDICES.RIGHT_WRIST ||
                           index === LANDMARK_INDICES.RIGHT_PINKY ||
                           index === LANDMARK_INDICES.RIGHT_INDEX ||
                           index === LANDMARK_INDICES.RIGHT_THUMB) {
                    color = COLORS.rightSide;
                    size = 8;
                } else {
                    color = COLORS.center;
                    size = 6;
                }
            } else {
                // Lower body
                color = index % 2 === 1 ? COLORS.leftSide : COLORS.rightSide;
                size = 7;
            }

            if (index === 0) { // Nose
                color = COLORS.center;
                size = 9;
            }

            if (index === 11 || index === 12) { // Shoulders
                size = 10;
            }

            drawPoint(landmark, width, height, color, size, index);
        }
    });
}

function drawPoint(landmark, width, height, color, size, index) {
    const x = flipX(landmark.x, width);
    const y = flipY(landmark.y, height);

    // Outer glow
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 1.5, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color + '40';
    canvasCtx.fill();

    // Main point
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();

    // White center dot
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 0.4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.fill();

    // Draw index number for key landmarks (for debugging)
    if ([0, 11, 12, 13, 14, 15, 16].includes(index)) {
        canvasCtx.fillStyle = '#FFFFFF';
        canvasCtx.font = 'bold 11px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText(index.toString(), x, y);
    }
}

function drawArmAngles(landmarks, width, height) {
    // Draw left arm angle (person's left)
    const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const leftElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];

    if (leftShoulder && leftElbow && leftWrist &&
        leftShoulder.visibility > 0.3 &&
        leftElbow.visibility > 0.3 &&
        leftWrist.visibility > 0.3) {
        drawAngleArc(leftShoulder, leftElbow, leftWrist, width, height, COLORS.leftSide, "LEFT");
    }

    // Draw right arm angle (person's right)
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];

    if (rightShoulder && rightElbow && rightWrist &&
        rightShoulder.visibility > 0.3 &&
        rightElbow.visibility > 0.3 &&
        rightWrist.visibility > 0.3) {
        drawAngleArc(rightShoulder, rightElbow, rightWrist, width, height, COLORS.rightSide, "RIGHT");
    }
}

function drawAngleArc(shoulder, elbow, wrist, width, height, color, side) {
    const elbowX = flipX(elbow.x, width);
    const elbowY = flipY(elbow.y, height);
    
    const shoulderX = flipX(shoulder.x, width);
    const shoulderY = flipY(shoulder.y, height);
    const wristX = flipX(wrist.x, width);
    const wristY = flipY(wrist.y, height);

    // Calculate angle
    const angle = calculateAngle(shoulder, elbow, wrist);
    const radius = 35;

    // Calculate arc angles (vectors from elbow to shoulder and wrist)
    const startAngle = Math.atan2(shoulderY - elbowY, shoulderX - elbowX);
    const endAngle = Math.atan2(wristY - elbowY, wristX - elbowX);

    // Draw arc
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, startAngle, endAngle);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = 'round';
    canvasCtx.stroke();

    // Draw angle text
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(`${Math.round(angle)}°`, elbowX, elbowY - radius - 10);

    // Draw side label
    canvasCtx.fillStyle = color;
    canvasCtx.font = 'bold 12px Arial';
    canvasCtx.fillText(side, elbowX, elbowY + radius + 15);
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ==================== ARM ANGLE CALCULATION ====================

function calculateArmAngles(landmarks) {
    // Calculate left arm angle (person's left)
    const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const leftElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];

    // Calculate right arm angle (person's right)
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];

    // Update left arm
    if (leftShoulder && leftElbow && leftWrist &&
        leftShoulder.visibility > 0.3 &&
        leftElbow.visibility > 0.3 &&
        leftWrist.visibility > 0.3) {
        leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        updateLeftArmUI(leftArmAngle);
        countExercise(leftArmAngle, 'left');
    } else {
        leftArmAngle = 0;
        updateLeftArmUI(0, false);
    }

    // Update right arm
    if (rightShoulder && rightElbow && rightWrist &&
        rightShoulder.visibility > 0.3 &&
        rightElbow.visibility > 0.3 &&
        rightWrist.visibility > 0.3) {
        rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        updateRightArmUI(rightArmAngle);
        countExercise(rightArmAngle, 'right');
    } else {
        rightArmAngle = 0;
        updateRightArmUI(0, false);
    }

    // Update arm visibility status
    const leftArmVisible = leftShoulder && leftElbow && leftWrist;
    const rightArmVisible = rightShoulder && rightElbow && rightWrist;
    updateArmVisibility(leftArmVisible, rightArmVisible);
    
    // Update title angles
    updateTitleAngles();
}

function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - 
                    Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    
    return angle;
}

function countExercise(angle, side) {
    const config = exerciseConfig[selectedExercise];
    
    
    if (selectedExercise === 'bicep_curl') {
        
        if (side === 'right' && angle > 160 && leftArmAngle > 160) {
            repInProgress = false;
        }
        if (side === 'left' && angle > 160 && rightArmAngle > 160) {
            repInProgress = false;
        }
    } else if (selectedExercise === 'pull_up') {
        // For pull-ups: reset when both arms are extended (>120)
        if (side === 'right' && angle > 120 && leftArmAngle > 120) {
            repInProgress = false;
        }
        if (side === 'left' && angle > 120 && rightArmAngle > 120) {
            repInProgress = false;
        }
    } else if (selectedExercise === 'push_up') {
        // For push-ups: reset when both arms are extended (>150)
        if (side === 'right' && angle > 150 && leftArmAngle > 150) {
            repInProgress = false;
        }
        if (side === 'left' && angle > 150 && rightArmAngle > 150) {
            repInProgress = false;
        }
    }
    
    // EXERCISE-SPECIFIC COUNTING LOGIC
    if (selectedExercise === 'bicep_curl') {
    if (side === 'left') {
        if (angle > config.angleDown) {
            leftStageState = "down";
            updateLeftStage(config.downLabel, config.downColor);
            updateLeftStageProgress(1);
        }

        if (angle < config.angleUp && leftStageState === "down") {
            leftStageState = "up";
            leftArmCounter++;
            updateLeftCounter();
            updateTotalReps();
            updateLeftStage(config.upLabel, config.upColor);
            updateLeftStageProgress(0);
            animateLeftRep();
            
            // ALWAYS count total rep for bicep curls (single or both arms)
            totalRepsCounter++;
            updateTotalRepsDisplay();
            animateTotalRep();
        }
    } else { // right arm
        if (angle > config.angleDown) {
            rightStageState = "down";
            updateRightStage(config.downLabel, config.downColor);
            updateRightStageProgress(1);
        }

        if (angle < config.angleUp && rightStageState === "down") {
            rightStageState = "up";
            rightArmCounter++;
            updateRightCounter();
            updateTotalReps();
            updateRightStage(config.upLabel, config.upColor);
            updateRightStageProgress(0);
            animateRightRep();
            
            // ALWAYS count total rep for bicep curls (single or both arms)
            totalRepsCounter++;
            updateTotalRepsDisplay();
            animateTotalRep();
        }
    }}
    else if (selectedExercise === 'pull_up') {
        // Pull-up: Count when arm goes from bent (<30) to extended (>120)
        if (side === 'left') {
            if (angle < config.angleUp) {
                leftStageState = "up";
                updateLeftStage(config.upLabel, config.upColor);
                updateLeftStageProgress(1);
            }

            if (angle > config.angleDown && leftStageState === "up") {
                leftStageState = "down";
                leftArmCounter++;
                updateLeftCounter();
                updateTotalReps();
                updateLeftStage(config.downLabel, config.downColor);
                updateLeftStageProgress(0);
                animateLeftRep();
                
                if (!repInProgress) {
                    repInProgress = true;
                    totalRepsCounter++;
                    updateTotalRepsDisplay();
                    animateTotalRep();
                }
            }
        } else { // right arm
            if (angle < config.angleUp) {
                rightStageState = "up";
                updateRightStage(config.upLabel, config.upColor);
                updateRightStageProgress(1);
            }

            if (angle > config.angleDown && rightStageState === "up") {
                rightStageState = "down";
                rightArmCounter++;
                updateRightCounter();
                updateTotalReps();
                updateRightStage(config.downLabel, config.downColor);
                updateRightStageProgress(0);
                animateRightRep();
                
                if (!repInProgress) {
                    repInProgress = true;
                    totalRepsCounter++;
                    updateTotalRepsDisplay();
                    animateTotalRep();
                }
            }
        }
    } 
     else if (selectedExercise === 'pull_up') {
        // Pull-up: Count when arm goes from bent (<30) to extended (>120)
        if (side === 'left') {
            if (angle < config.angleUp) {
                leftStageState = "up";
                updateLeftStage(config.upLabel, config.upColor);
                updateLeftStageProgress(1);
            }

            if (angle > config.angleDown && leftStageState === "up") {
                leftStageState = "down";
                leftArmCounter++;
                updateLeftCounter();
                updateTotalReps();
                updateLeftStage(config.downLabel, config.downColor);
                updateLeftStageProgress(0);
                animateLeftRep();
                
                if (!repInProgress) {
                    repInProgress = true;
                    totalRepsCounter++;
                    updateTotalRepsDisplay();
                    animateTotalRep();
                }
            }
        } else { // right arm
            if (angle < config.angleUp) {
                rightStageState = "up";
                updateRightStage(config.upLabel, config.upColor);
                updateRightStageProgress(1);
            }

            if (angle > config.angleDown && rightStageState === "up") {
                rightStageState = "down";
                rightArmCounter++;
                updateRightCounter();
                updateTotalReps();
                updateRightStage(config.downLabel, config.downColor);
                updateRightStageProgress(0);
                animateRightRep();
                
                if (!repInProgress) {
                    repInProgress = true;
                    totalRepsCounter++;
                    updateTotalRepsDisplay();
                    animateTotalRep();
                }
            }
        }
    } 
    else if (selectedExercise === 'push_up') {
        // Push-up: Count when arm goes from extended (>150) to bent (<60)
        
        if (side === 'left') {
            if (angle > config.angleDown) {
                leftStageState = "up";
                updateLeftStage(config.downLabel, config.downColor);
                updateLeftStageProgress(1);
            }

            if (angle < config.angleUp && leftStageState === "up") {
                leftStageState = "down";
                leftArmCounter++;
                updateLeftCounter();
                updateTotalReps();
                updateLeftStage(config.upLabel, config.upColor);
                updateLeftStageProgress(0);
                animateLeftRep();
                
                if (!repInProgress) {
                    repInProgress = true;
                    totalRepsCounter++;
                    updateTotalRepsDisplay();
                    animateTotalRep();
                }
            }
        } else { // right arm
            if (angle > config.angleDown) {
                rightStageState = "up";
                updateRightStage(config.downLabel, config.downColor);
                updateRightStageProgress(1);
            }

            if (angle < config.angleUp && rightStageState === "up") {
                rightStageState = "down";
                rightArmCounter++;
                updateRightCounter();
                updateTotalReps();
                updateRightStage(config.upLabel, config.upColor);
                updateRightStageProgress(0);
                animateRightRep();
                
                if (!repInProgress) {
                    repInProgress = true;
                    totalRepsCounter++;
                    updateTotalRepsDisplay();
                    animateTotalRep();
                }
            }
        }
    }
}

function resetExerciseSpecificStates() {
    const config = exerciseConfig[selectedExercise];
    
    // Reset stage states for the selected exercise
    leftStageState = null;
    rightStageState = null;
    repInProgress = false;
    
    // Reset UI to default for selected exercise
    updateLeftStage('--', config.readyColor);
    updateRightStage('--', config.readyColor);
    updateLeftStageProgress(0);
    updateRightStageProgress(0);
}

// ==================== UI UPDATES ====================

function updateTitleAngles() {
    leftAngleTitle.textContent = `${Math.round(leftArmAngle)}°`;
    rightAngleTitle.textContent = `${Math.round(rightArmAngle)}°`;
}

function updateLeftArmUI(angle, visible = true) {
    const roundedAngle = Math.round(angle);
    leftAngleValue.textContent = `${roundedAngle}°`;

    if (visible) {
        const circlePercent = (angle / 180) * 360;
        leftAngleFill.style.background = 
            `conic-gradient(from 0deg, #FF6B6B 0deg, #FF6B6B ${circlePercent}deg, transparent ${circlePercent}deg, transparent 360deg)`;
    } else {
        leftAngleFill.style.background = `conic-gradient(from 0deg, transparent 0deg, transparent 360deg)`;
    }
}

function updateRightArmUI(angle, visible = true) {
    const roundedAngle = Math.round(angle);
    rightAngleValue.textContent = `${roundedAngle}°`;

    if (visible) {
        const circlePercent = (angle / 180) * 360;
        rightAngleFill.style.background = 
            `conic-gradient(from 0deg, #4CC9F0 0deg, #4CC9F0 ${circlePercent}deg, transparent ${circlePercent}deg, transparent 360deg)`;
    } else {
        rightAngleFill.style.background = `conic-gradient(from 0deg, transparent 0deg, transparent 360deg)`;
    }
}

function updateLeftStage(text, color) {
    leftStage.textContent = text;
    leftStageText.textContent = text;
    leftStageText.style.color = color;
    leftStageIndicator.style.backgroundColor = color;
}

function updateRightStage(text, color) {
    rightStage.textContent = text;
    rightStageText.textContent = text;
    rightStageText.style.color = color;
    rightStageIndicator.style.backgroundColor = color;
}

function updateLeftStageProgress(progress) {
    leftStageIndicator.style.width = `${progress * 100}%`;
}

function updateRightStageProgress(progress) {
    rightStageIndicator.style.width = `${progress * 100}%`;
}

function updateLeftCounter() {
    leftCounter.textContent = leftArmCounter;
    leftCounter.classList.add('rep-animation');
    setTimeout(() => leftCounter.classList.remove('rep-animation'), 500);
}

function updateRightCounter() {
    rightCounter.textContent = rightArmCounter;
    rightCounter.classList.add('rep-animation');
    setTimeout(() => rightCounter.classList.remove('rep-animation'), 500);
}

function updateTotalReps() {
    totalCounter.textContent = leftArmCounter + rightArmCounter;
}

function updateTotalRepsDisplay() {
    totalRepsDisplay.textContent = totalRepsCounter;
    totalRepsDisplay.classList.add('rep-animation');
    setTimeout(() => totalRepsDisplay.classList.remove('rep-animation'), 500);
}

function animateLeftRep() {
    document.querySelector('.left-angle').classList.add('highlight-active');
    setTimeout(() => {
        document.querySelector('.left-angle').classList.remove('highlight-active');
    }, 1000);
}

function animateRightRep() {
    document.querySelector('.right-angle').classList.add('highlight-active');
    setTimeout(() => {
        document.querySelector('.right-angle').classList.remove('highlight-active');
    }, 1000);
}

function animateTotalRep() {
    totalRepsDisplay.classList.add('highlight-total');
    setTimeout(() => {
        totalRepsDisplay.classList.remove('highlight-total');
    }, 1000);
}

function updateLandmarkStats(count) {
    detectedPoints.textContent = count;
    landmarkTitle.textContent = `Points: ${count}/33`;

    const percent = (count / 33) * 100;
    landmarksProgress.style.width = `${percent}%`;

    confidenceDisplay.textContent = `Confidence: ${detectionConfidence}%`;
    confidenceDisplay.style.color = detectionConfidence > 70 ? '#4CC9F0' :
                                   detectionConfidence > 50 ? '#FFD166' : '#FF6B6B';
}

function updateArmVisibility(leftVisible, rightVisible) {
    if (leftVisible && rightVisible) {
        armVisibility.textContent = 'Both arms visible';
        armVisibility.style.color = '#06D6A0';
    } else if (leftVisible || rightVisible) {
        armVisibility.textContent = 'One arm visible';
        armVisibility.style.color = '#FFD166';
    } else {
        armVisibility.textContent = 'No arms visible';
        armVisibility.style.color = '#FF6B6B';
    }
}

function updateStatus(message) {
    const config = exerciseConfig[selectedExercise];
    poseStatus.textContent = `${config.name}: ${message}`;
    detectionStatus.textContent = `${config.name}: ${message}`;
}

function updateLatency(latency) {
    latencyDisplay.textContent = `Latency: ${latency}ms`;
    latencyDisplay.style.color = latency > 200 ? '#FF6B6B' :
                                latency > 100 ? '#FFD166' : '#4CC9F0';
}

function updateProcessingMode() {
    processingMode.textContent = useAPI ? 'API' : 'Browser';
}

function startFPSCounter() {
    setInterval(() => {
        fps = frameCount;
        frameCount = 0;
        fpsCounter.textContent = `${fps} FPS`;

        fpsCounter.style.color = fps < 15 ? '#FF6B6B' :
                                fps < 25 ? '#FFD166' : '#4CC9F0';
    }, 1000);
}

// ==================== EVENT LISTENERS ====================

resetBtn.addEventListener('click', resetAll);

leftCounter.addEventListener('click', () => {
    leftArmCounter = 0;
    updateLeftCounter();
    updateTotalReps();
});

rightCounter.addEventListener('click', () => {
    rightArmCounter = 0;
    updateRightCounter();
    updateTotalReps();
});

totalRepsDisplay.addEventListener('click', () => {
    totalRepsCounter = 0;
    updateTotalRepsDisplay();
});

window.addEventListener('resize', () => {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
    }
});

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Fitness Tracker initialized');
    
    // Set up exercise selection
    const exerciseItems = document.querySelectorAll('.exercise-item');
    console.log(`Found ${exerciseItems.length} exercise items`);
    
    exerciseItems.forEach(item => {
        item.addEventListener('click', function() {
            const exercise = this.getAttribute('data-exercise');
            console.log(`Exercise clicked: ${exercise}`);
            
            // Update selected exercise
            selectedExercise = exercise;
            const config = exerciseConfig[exercise];
            
            // Update UI
            currentExerciseName.textContent = config.name;
            
            // Switch pages
            selectionPage.classList.remove('active');
            detectionPage.classList.add('active');
            
            // Reset counters for new exercise
            resetAll();
            
            // Show permission prompt immediately
            showPermissionPrompt();
            
            // Start camera after a short delay
            setTimeout(() => {
                startCamera();
            }, 300);
        });
    });
    
    // Set up back button
    if (backBtn) {
        backBtn.addEventListener('click', goToSelectionPage);
    }
    
    // Initialize with selection page visible
    selectionPage.classList.add('active');
    detectionPage.classList.remove('active');
    
    // Set video element properties for mobile
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('webkit-playsinline', '');
    videoElement.setAttribute('muted', '');
    videoElement.setAttribute('autoplay', '');
    
    updateProcessingMode();
});

// Cleanup
window.addEventListener('beforeunload', () => {
    stopCamera();
});