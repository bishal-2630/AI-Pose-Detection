// script.js - Mirror view with correct rep counting

// DOM Elements
const videoElement = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasCtx = overlayCanvas.getContext('2d');
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
const repsCounterElement = document.getElementById('repsCounter');
const totalCounterElement = document.getElementById('totalCounter');
const mobileLeftAngle = document.getElementById('mobileLeftAngle');
const mobileRightAngle = document.getElementById('mobileRightAngle');
const mobilePoints = document.getElementById('mobilePoints');
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
let totalReps = 0;
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

// Colors for mirror view (screen perspective)
const COLORS = {
    leftSide: '#FF6B6B',      // Red for left side (screen left in mirror)
    rightSide: '#4CC9F0',     // Blue for right side (screen right in mirror)
    center: '#FFD166',        // Yellow for center points
    connections: '#118AB2',   // Blue for skeleton lines
    angleArc: '#06D6A0'       // Green for angle arcs
};

// MediaPipe landmark indices (person's perspective)
const LANDMARK_INDICES = {
    NOSE: 0,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24
};

// Skeleton connections (person's perspective)
const SKELETON_CONNECTIONS = [
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.RIGHT_SHOULDER],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW],
    [LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW],
    [LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_HIP],
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_HIP],
    [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.RIGHT_HIP]
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
        
        // Draw skeleton with mirror view
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
    
    // Draw skeleton connections
    drawConnections(results.poseLandmarks, videoWidth, videoHeight);
    
    // Draw key landmarks
    drawKeyLandmarks(results.poseLandmarks, videoWidth, videoHeight);
    
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
            // Determine color based on side (mirror view)
            let color = COLORS.connections;
            
            // Mirror view: left side (screen left) = person's right
            if (startIdx === LANDMARK_INDICES.RIGHT_SHOULDER || 
                startIdx === LANDMARK_INDICES.RIGHT_ELBOW || 
                startIdx === LANDMARK_INDICES.RIGHT_WRIST ||
                endIdx === LANDMARK_INDICES.RIGHT_SHOULDER || 
                endIdx === LANDMARK_INDICES.RIGHT_ELBOW || 
                endIdx === LANDMARK_INDICES.RIGHT_WRIST) {
                color = COLORS.leftSide; // Screen left = red
            }
            // Mirror view: right side (screen right) = person's left
            else if (startIdx === LANDMARK_INDICES.LEFT_SHOULDER || 
                     startIdx === LANDMARK_INDICES.LEFT_ELBOW || 
                     startIdx === LANDMARK_INDICES.LEFT_WRIST ||
                     endIdx === LANDMARK_INDICES.LEFT_SHOULDER || 
                     endIdx === LANDMARK_INDICES.LEFT_ELBOW || 
                     endIdx === LANDMARK_INDICES.LEFT_WRIST) {
                color = COLORS.rightSide; // Screen right = blue
            }
            
            drawLine(start, end, width, height, color);
        }
    });
}

function drawLine(start, end, width, height, color) {
    // Mirror view: flip X coordinate
    const startX = width - (start.x * width);
    const startY = start.y * height;
    const endX = width - (end.x * width);
    const endY = end.y * height;
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    canvasCtx.lineTo(endX, endY);
    canvasCtx.strokeStyle = color;
    canvasCtx.stroke();
}

function drawKeyLandmarks(landmarks, width, height) {
    // Only draw key landmarks for arms and shoulders
    const keyLandmarks = [
        LANDMARK_INDICES.LEFT_SHOULDER,
        LANDMARK_INDICES.RIGHT_SHOULDER,
        LANDMARK_INDICES.LEFT_ELBOW,
        LANDMARK_INDICES.RIGHT_ELBOW,
        LANDMARK_INDICES.LEFT_WRIST,
        LANDMARK_INDICES.RIGHT_WRIST
    ];
    
    keyLandmarks.forEach(index => {
        const landmark = landmarks[index];
        if (landmark && landmark.visibility > 0.1) {
            // Mirror view: flip X coordinate
            const mirroredX = width - (landmark.x * width);
            const y = landmark.y * height;
            
            // Determine color based on side (mirror view)
            let color, size = 8;
            
            // Person's right = screen left (red)
            if (index === LANDMARK_INDICES.RIGHT_SHOULDER || 
                index === LANDMARK_INDICES.RIGHT_ELBOW || 
                index === LANDMARK_INDICES.RIGHT_WRIST) {
                color = COLORS.leftSide;
            }
            // Person's left = screen right (blue)
            else if (index === LANDMARK_INDICES.LEFT_SHOULDER || 
                     index === LANDMARK_INDICES.LEFT_ELBOW || 
                     index === LANDMARK_INDICES.LEFT_WRIST) {
                color = COLORS.rightSide;
            }
            
            drawPoint(mirroredX, y, color, size);
        }
    });
}

function drawPoint(x, y, color, size) {
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
}

function drawArmAngles(landmarks, width, height) {
    // Draw left arm angle (screen left = person's right)
    const leftShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const leftElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    
    if (leftShoulder && leftElbow && leftWrist && 
        leftShoulder.visibility > 0.3 && 
        leftElbow.visibility > 0.3 && 
        leftWrist.visibility > 0.3) {
        drawAngleArc(leftShoulder, leftElbow, leftWrist, width, height, COLORS.leftSide);
    }
    
    // Draw right arm angle (screen right = person's left)
    const rightShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    
    if (rightShoulder && rightElbow && rightWrist && 
        rightShoulder.visibility > 0.3 && 
        rightElbow.visibility > 0.3 && 
        rightWrist.visibility > 0.3) {
        drawAngleArc(rightShoulder, rightElbow, rightWrist, width, height, COLORS.rightSide);
    }
}

function drawAngleArc(shoulder, elbow, wrist, width, height, color) {
    // Mirror view: flip X coordinate
    const elbowX = width - (elbow.x * width);
    const elbowY = elbow.y * height;
    
    // Calculate angle
    const angle = calculateAngle(shoulder, elbow, wrist);
    const radius = 30;
    
    // Calculate arc angles (adjusted for mirror view)
    const startAngle = Math.atan2(
        shoulder.y - elbow.y,
        (width - shoulder.x * width) - elbowX
    );
    const endAngle = Math.atan2(
        wrist.y - elbow.y,
        (width - wrist.x * width) - elbowX
    );
    
    // Draw arc
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, startAngle, endAngle);
    canvasCtx.strokeStyle = angle < 90 ? COLORS.angleArc : color;
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = 'round';
    canvasCtx.stroke();
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ==================== ARM ANGLE CALCULATION ====================

function calculateArmAngles(landmarks) {
    // Calculate left arm angle (screen left = person's right)
    const leftShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const leftElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    
    // Calculate right arm angle (screen right = person's left)
    const rightShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    
    // Update left arm
    if (leftShoulder && leftElbow && leftWrist && 
        leftShoulder.visibility > 0.3 && 
        leftElbow.visibility > 0.3 && 
        leftWrist.visibility > 0.3) {
        leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        updateLeftArmUI(leftArmAngle);
        countCurl(leftArmAngle, 'left');
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
        countCurl(rightArmAngle, 'right');
    } else {
        rightArmAngle = 0;
        updateRightArmUI(0, false);
    }
    
    // Update arm visibility status
    updateArmVisibility(leftShoulder && rightShoulder);
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

// Track curl states for each arm
let leftArmState = { stage: null, hasCounted: false };
let rightArmState = { stage: null, hasCounted: false };

function countCurl(angle, arm) {
    let state = arm === 'left' ? leftArmState : rightArmState;
    let color = arm === 'left' ? '#FF6B6B' : '#4CC9F0';
    let stageElement = arm === 'left' ? leftStage : rightStage;
    let stageText = arm === 'left' ? leftStageText : rightStageText;
    let indicator = arm === 'left' ? leftStageIndicator : rightStageIndicator;
    
    // Reset hasCounted when arm goes down
    if (angle > 160) {
        state.stage = "down";
        state.hasCounted = false;
        updateStageUI(stageElement, stageText, "DOWN", color);
        updateStageProgress(indicator, 1);
    }
    
    // Count rep when arm goes up and hasn't been counted yet in this cycle
    if (angle < 40 && state.stage === "down" && !state.hasCounted) {
        state.stage = "up";
        state.hasCounted = true;
        totalReps++;
        updateCounters();
        updateStageUI(stageElement, stageText, "UP", '#EF476F');
        updateStageProgress(indicator, 0);
        
        // Animate the gauge
        if (arm === 'left') {
            animateLeftRep();
        } else {
            animateRightRep();
        }
    }
}

function updateStageUI(stageElement, stageText, text, color) {
    stageElement.textContent = text;
    stageText.textContent = text;
    stageText.style.color = color;
}

function updateStageProgress(indicator, progress) {
    indicator.style.width = `${progress * 100}%`;
}

// ==================== UI UPDATES ====================

function updateLeftArmUI(angle, visible = true) {
    const roundedAngle = Math.round(angle);
    leftAngleValue.textContent = `${roundedAngle}°`;
    mobileLeftAngle.textContent = `${roundedAngle}°`;
    
    if (visible) {
        const circlePercent = (angle / 180) * 360;
        leftAngleFill.style.background = 
            `conic-gradient(from 0deg, #FF6B6B 0deg, #FF6B6B ${circlePercent}deg, transparent ${circlePercent}deg, transparent 360deg)`;
    }
}

function updateRightArmUI(angle, visible = true) {
    const roundedAngle = Math.round(angle);
    rightAngleValue.textContent = `${roundedAngle}°`;
    mobileRightAngle.textContent = `${roundedAngle}°`;
    
    if (visible) {
        const circlePercent = (angle / 180) * 360;
        rightAngleFill.style.background = 
            `conic-gradient(from 0deg, #4CC9F0 0deg, #4CC9F0 ${circlePercent}deg, transparent ${circlePercent}deg, transparent 360deg)`;
    }
}

function updateCounters() {
    repsCounterElement.textContent = totalReps;
    totalCounterElement.textContent = totalReps;
    
    // Add animation
    repsCounterElement.classList.add('rep-animation');
    totalCounterElement.classList.add('rep-animation');
    setTimeout(() => {
        repsCounterElement.classList.remove('rep-animation');
        totalCounterElement.classList.remove('rep-animation');
    }, 500);
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

function updateLandmarkStats(count) {
    detectedPoints.textContent = count;
    mobilePoints.textContent = `${count}/33`;
    
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
    totalReps = 0;
    leftArmState = { stage: null, hasCounted: false };
    rightArmState = { stage: null, hasCounted: false };
    leftStageState = null;
    rightStageState = null;
    
    updateCounters();
    updateStageUI(leftStage, leftStageText, '--', '#a0a0c0');
    updateStageUI(rightStage, rightStageText, '--', '#a0a0c0');
    updateStageProgress(leftStageIndicator, 0);
    updateStageProgress(rightStageIndicator, 0);
    clearCanvas();
    
    // Visual feedback
    repsCounterElement.style.color = '#FF6B6B';
    totalCounterElement.style.color = '#FF6B6B';
    setTimeout(() => {
        repsCounterElement.style.color = '#FFFFFF';
        totalCounterElement.style.color = '#00dbde';
    }, 300);
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updateStatus('Starting camera...');
        
        await initializeMediaPipe();
        
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            }
        });
        
        videoElement.srcObject = mediaStream;
        
        // Apply mirror effect
        videoElement.style.transform = 'scaleX(-1)';
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = resolve;
        });
        
        // Set canvas size
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        
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

// Counters tap to reset
repsCounterElement.addEventListener('click', () => {
    totalReps = 0;
    updateCounters();
});

totalCounterElement.addEventListener('click', () => {
    totalReps = 0;
    updateCounters();
});

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting Pose Detection - Single Hand Rep Counting...');
    
    await startCamera();
    updateProcessingMode();
    
    console.log('System ready - Each arm curl counts as 1 rep');
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