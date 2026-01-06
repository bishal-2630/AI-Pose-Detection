// script.js - FIXED left/right mapping issue

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
const apiToggleBtn = document.getElementById('apiToggle');

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

// Colors for correct left/right mapping (person's perspective)
const COLORS = {
    leftSide: '#FF6B6B',      // Red for left side (person's left)
    rightSide: '#4CC9F0',     // Blue for right side (person's right)
    center: '#FFD166',        // Yellow for center points
    connections: '#118AB2',   // Blue for skeleton lines
    angleArc: '#06D6A0',      // Green for angle arcs
    activeArm: '#EF476F'      // Pink for active arm highlights
};

// MediaPipe landmark indices (person's perspective)
const LANDMARK_INDICES = {
    // Face landmarks
    NOSE: 0,
    LEFT_EYE_INNER: 1,    // Person's left
    LEFT_EYE: 2,          // Person's left
    LEFT_EYE_OUTER: 3,    // Person's left
    RIGHT_EYE_INNER: 4,   // Person's right
    RIGHT_EYE: 5,         // Person's right
    RIGHT_EYE_OUTER: 6,   // Person's right
    LEFT_EAR: 7,          // Person's left
    RIGHT_EAR: 8,         // Person's right
    MOUTH_LEFT: 9,        // Person's left
    MOUTH_RIGHT: 10,      // Person's right

    // Body landmarks - Person's perspective (no swapping needed)
    LEFT_SHOULDER: 11,    // Person's left
    RIGHT_SHOULDER: 12,   // Person's right
    LEFT_ELBOW: 13,       // Person's left
    RIGHT_ELBOW: 14,      // Person's right
    LEFT_WRIST: 15,       // Person's left
    RIGHT_WRIST: 16,      // Person's right

    // Hands
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,

    // Lower body
    LEFT_HIP: 23,         // Person's left
    RIGHT_HIP: 24,        // Person's right
    LEFT_KNEE: 25,        // Person's left
    RIGHT_KNEE: 26,       // Person's right
    LEFT_ANKLE: 27,       // Person's left
    RIGHT_ANKLE: 28,      // Person's right
    LEFT_HEEL: 29,        // Person's left
    RIGHT_HEEL: 30,       // Person's right
    LEFT_FOOT_INDEX: 31,  // Person's left
    RIGHT_FOOT_INDEX: 32  // Person's right
};

// Connections for person's perspective (no swapping needed)
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

    // Upper body - Person's perspective
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.RIGHT_SHOULDER],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW],    // Person's left arm
    [LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],      // Person's left arm
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW],  // Person's right arm
    [LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],    // Person's right arm
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
    [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.LEFT_KNEE],        // Person's left leg
    [LANDMARK_INDICES.LEFT_KNEE, LANDMARK_INDICES.LEFT_ANKLE],      // Person's left leg
    [LANDMARK_INDICES.RIGHT_HIP, LANDMARK_INDICES.RIGHT_KNEE],      // Person's right leg
    [LANDMARK_INDICES.RIGHT_KNEE, LANDMARK_INDICES.RIGHT_ANKLE],    // Person's right leg
    [LANDMARK_INDICES.LEFT_ANKLE, LANDMARK_INDICES.LEFT_HEEL],
    [LANDMARK_INDICES.RIGHT_ANKLE, LANDMARK_INDICES.RIGHT_HEEL]
];

// ==================== MEDIAPIPE INITIALIZATION ====================

async function initializeMediaPipe() {
    try {
        updateStatus('Loading pose detection...');

        // Load MediaPipe
        if (typeof window.Pose === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
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

        updateStatus('Ready for detection');
        return true;

    } catch (error) {
        console.error('MediaPipe error:', error);
        updateStatus('Failed to initialize');
        return false;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ==================== POSE DETECTION & VISUALIZATION ====================

function onPoseResults(results) {
    if (results.poseLandmarks) {
        landmarks = results.poseLandmarks;
        detectionConfidence = calculateConfidence(results);

        // Count detected landmarks
        const detectedCount = countDetectedLandmarks(landmarks);
        updateLandmarkStats(detectedCount);

        // Draw skeleton with correct left/right mapping
        drawSkeleton(results);

        // Calculate and display both arm angles
        calculateArmAngles(landmarks);

        updateStatus(`${detectedCount} points detected`);
    } else {
        landmarks = null;
        clearCanvas();
        updateLandmarkStats(0);
        updateStatus('Move into frame');
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

    // Clear canvas
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);

    // Draw all connections
    drawConnections(results.poseLandmarks, videoWidth, videoHeight);

    // Draw all landmarks
    drawLandmarks(results.poseLandmarks, videoWidth, videoHeight);

    // Draw arm angles
    drawArmAngles(results.poseLandmarks, videoWidth, videoHeight);
}

function drawConnections(landmarks, width, height) {
    canvasCtx.lineWidth = 3;
    canvasCtx.lineCap = 'round';

    SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];

        if (start && end && start.visibility > 0.1 && end.visibility > 0.1) {
            // Determine color based on side (person's perspective)
            let color = COLORS.connections;

            // Person's left side
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
                color = COLORS.leftSide; // Person's left = red
            }
            // Person's right side
            else if (startIdx === LANDMARK_INDICES.RIGHT_SHOULDER ||
                startIdx === LANDMARK_INDICES.RIGHT_ELBOW ||
                startIdx === LANDMARK_INDices.RIGHT_WRIST ||
                startIdx === LANDMARK_INDICES.RIGHT_HIP ||
                startIdx === LANDMARK_INDICES.RIGHT_KNEE ||
                startIdx === LANDMARK_INDICES.RIGHT_ANKLE ||
                endIdx === LANDMARK_INDICES.RIGHT_SHOULDER ||
                endIdx === LANDMARK_INDICES.RIGHT_ELBOW ||
                endIdx === LANDMARK_INDICES.RIGHT_WRIST ||
                endIdx === LANDMARK_INDICES.RIGHT_HIP ||
                endIdx === LANDMARK_INDICES.RIGHT_KNEE ||
                endIdx === LANDMARK_INDICES.RIGHT_ANKLE) {
                color = COLORS.rightSide; // Person's right = blue
            }

            drawLine(start, end, width, height, color);
        }
    });
}

function drawLine(start, end, width, height, color) {
    // Convert normalized coordinates to canvas coordinates
    const startX = start.x * width;
    const startY = start.y * height;
    const endX = end.x * width;
    const endY = end.y * height;

    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    canvasCtx.lineTo(endX, endY);
    canvasCtx.strokeStyle = color;
    canvasCtx.stroke();
}

function drawLandmarks(landmarks, width, height) {
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
                    index === LANDMARK_INDICES.LEFT_WRIST) {
                    color = COLORS.leftSide; // Person's left = red
                    size = 8;
                } else if (index === LANDMARK_INDICES.RIGHT_SHOULDER ||
                    index === LANDMARK_INDICES.RIGHT_ELBOW ||
                    index === LANDMARK_INDICES.RIGHT_WRIST) {
                    color = COLORS.rightSide; // Person's right = blue
                    size = 8;
                } else {
                    color = COLORS.center;
                    size = 6;
                }
            } else {
                // Lower body
                color = index === 23 || index === 25 || index === 27 || index === 29 || index === 31 ?
                    COLORS.leftSide : COLORS.rightSide;
                size = 7;
            }

            if (index === 0) { // Nose
                color = COLORS.center;
                size = 9;
            }

            drawPoint(landmark, width, height, color, size, index);
        }
    });
}

function drawPoint(landmark, width, height, color, size, index) {
    const x = landmark.x * width;
    const y = landmark.y * height;

    // Outer circle
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 1.5, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color + '40';
    canvasCtx.fill();

    // Main point
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();

    // White center
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 0.4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.fill();

    // Draw index for key points (optional)
    if ([0, 11, 12, 13, 14, 15, 16, 23, 24].includes(index)) {
        canvasCtx.fillStyle = '#FFFFFF';
        canvasCtx.font = 'bold 10px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText(index, x, y);
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
    const elbowX = elbow.x * width;
    const elbowY = elbow.y * height;

    // Calculate angle
    const angle = calculateAngle(shoulder, elbow, wrist);
    const radius = 35;

    // Calculate arc angles
    const startAngle = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
    const endAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);

    // Draw arc
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, startAngle, endAngle);
    canvasCtx.strokeStyle = angle < 90 ? COLORS.angleArc : color;
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = 'round';
    canvasCtx.stroke();

    // Draw angle text
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 14px Arial';
    canvasCtx.textAlign = 'center';
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
        countLeftCurl(leftArmAngle);
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
        countRightCurl(rightArmAngle);
    } else {
        rightArmAngle = 0;
        updateRightArmUI(0, false);
    }

    // Update arm visibility status
    updateArmVisibility(leftShoulder && rightShoulder);
    
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

function countLeftCurl(angle) {
    if (angle > 160) {
        leftStageState = "down";
        updateLeftStage("DOWN", "#FF6B6B");
        updateLeftStageProgress(1);
    }

    if (angle < 40 && leftStageState === "down") {
        leftStageState = "up";
        leftArmCounter++;
        updateLeftCounter();
        updateTotalReps();
        updateLeftStage("UP", "#EF476F");
        updateLeftStageProgress(0);
        animateLeftRep();
        
        // Count rep if either arm completes curl
        if (!repInProgress) {
            repInProgress = true;
            totalRepsCounter++;
            updateTotalRepsDisplay();
            animateTotalRep();
        }
    }
}

function countRightCurl(angle) {
    if (angle > 160) {
        rightStageState = "down";
        updateRightStage("DOWN", "#4CC9F0");
        updateRightStageProgress(1);
    }

    if (angle < 40 && rightStageState === "down") {
        rightStageState = "up";
        rightArmCounter++;
        updateRightCounter();
        updateTotalReps();
        updateRightStage("UP", "#EF476F");
        updateRightStageProgress(0);
        animateRightRep();
        
        // Count rep if either arm completes curl
        if (!repInProgress) {
            repInProgress = true;
            totalRepsCounter++;
            updateTotalRepsDisplay();
            animateTotalRep();
        }
    }
    
    // Reset repInProgress when both arms are extended
    if (angle > 160 && leftArmAngle > 160) {
        repInProgress = false;
    }
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
    }
}

function updateRightArmUI(angle, visible = true) {
    const roundedAngle = Math.round(angle);
    rightAngleValue.textContent = `${roundedAngle}°`;

    if (visible) {
        const circlePercent = (angle / 180) * 360;
        rightAngleFill.style.background =
            `conic-gradient(from 0deg, #4CC9F0 0deg, #4CC9F0 ${circlePercent}deg, transparent ${circlePercent}deg, transparent 360deg)`;
    }
}

function updateLeftStage(text, color) {
    leftStage.textContent = text;
    leftStageText.textContent = text;
    leftStageText.style.color = color;
}

function updateRightStage(text, color) {
    rightStage.textContent = text;
    rightStageText.textContent = text;
    rightStageText.style.color = color;
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

function updateArmVisibility(bothVisible) {
    if (bothVisible) {
        armVisibility.textContent = 'Both arms visible';
        armVisibility.style.color = '#06D6A0';
    } else {
        armVisibility.textContent = 'One arm hidden';
        armVisibility.style.color = '#FFD166';
    }
}

function updateStatus(message) {
    poseStatus.textContent = message;
    detectionStatus.textContent = message;
}

function updateLatency(latency) {
    latencyDisplay.textContent = `Latency: ${latency}ms`;
    latencyDisplay.style.color = latency > 200 ? '#FF6B6B' :
        latency > 100 ? '#FFD166' : '#4CC9F0';
}

function updateProcessingMode() {
    processingMode.textContent = useAPI ? 'API' : 'Browser';
    apiToggleBtn.querySelector('.btn-text').textContent =
        useAPI ? 'API Mode: ON' : 'API Mode: OFF';
}

function toggleProcessingMode() {
    useAPI = !useAPI;
    updateProcessingMode();
    updateStatus(useAPI ? 'Using API mode' : 'Using browser mode');
}

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
    updateLeftStage('--', '#a0a0c0');
    updateRightStage('--', '#a0a0c0');
    updateLeftStageProgress(0);
    updateRightStageProgress(0);
    clearCanvas();
    
    updateTitleAngles();

    // Visual feedback
    totalRepsDisplay.style.color = '#EF476F';
    setTimeout(() => {
        totalRepsDisplay.style.color = '#FFFFFF';
    }, 300);
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updateStatus('Starting camera...');

        await initializeMediaPipe();

        // Get screen dimensions for better mobile sizing
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Adjust camera resolution for mobile
        const isMobile = screenWidth <= 768;
        const videoConstraints = {
            video: {
                width: { ideal: isMobile ? 640 : 1280 },
                height: { ideal: isMobile ? 480 : 720 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            }
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(videoConstraints);

        videoElement.srcObject = mediaStream;

        await new Promise((resolve) => {
            videoElement.onloadedmetadata = resolve;
        });

        // Set canvas size to match video with mirroring
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;

        // Apply mirror effect to canvas for consistency
        canvasCtx.translate(overlayCanvas.width, 0);
        canvasCtx.scale(-1, 1);

        // Start camera processing
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (pose) {
                    await pose.send({ image: videoElement });
                }
            },
            width: videoElement.videoWidth,
            height: videoElement.videoHeight
        });

        await camera.start();
        updateStatus('Ready - Move your arms!');

        // Start FPS counter
        startFPSCounter();

    } catch (error) {
        console.error('Camera error:', error);
        updateStatus('Camera access required');
    }
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

apiToggleBtn.addEventListener('click', toggleProcessingMode);
resetBtn.addEventListener('click', resetAll);

// Counter tap to reset individual counters
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

// Handle window resize for better mobile experience
window.addEventListener('resize', () => {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        
        // Re-apply mirror transform
        canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
        canvasCtx.translate(overlayCanvas.width, 0);
        canvasCtx.scale(-1, 1);
    }
});

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting Dual Arm Angle Tracking...');

    await startCamera();
    updateProcessingMode();

    console.log('System ready - Left/Right correctly mapped');
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (camera) {
        camera.stop();
    }
});