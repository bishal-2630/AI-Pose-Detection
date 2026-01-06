// script.js - Mirror view with single hand rep counting

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
const totalRepsElement = document.getElementById('totalReps');
const totalCounterElement = document.getElementById('totalCounter');
const mobileLeftAngle = document.getElementById('mobileLeftAngle');
const mobileRightAngle = document.getElementById('mobileRightAngle');
const mobileTotalPoints = document.getElementById('mobileTotalPoints');
const landmarkCount = document.getElementById('landmarkCount');
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
let lastRepTime = 0;
let repCooldown = 1000; // 1 second cooldown between reps

// Colors for mirror view (screen perspective)
const COLORS = {
    leftSide: '#FF6B6B',      // Red for left side (screen left in mirror)
    rightSide: '#4CC9F0',     // Blue for right side (screen right in mirror)
    center: '#FFD166',        // Yellow for center points
    connections: '#118AB2',   // Blue for skeleton lines
    angleArc: '#06D6A0'      // Green for angle arcs
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

// Skeleton connections for arms only
const SKELETON_CONNECTIONS = [
    // Upper body
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.RIGHT_SHOULDER],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW],
    [LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW],
    [LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],
    [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_HIP],
    [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_HIP]
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
    
    // Draw all connections
    drawConnections(results.poseLandmarks, videoWidth, videoHeight);
    
    // Draw key landmarks only
    drawLandmarks(results.poseLandmarks, videoWidth, videoHeight);
    
    // Draw reps counter on canvas (top left corner)
    drawRepsCounter(videoWidth, videoHeight);
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

function drawLandmarks(landmarks, width, height) {
    // Draw only key points
    const keyPoints = [
        LANDMARK_INDICES.LEFT_SHOULDER,
        LANDMARK_INDICES.RIGHT_SHOULDER,
        LANDMARK_INDICES.LEFT_ELBOW,
        LANDMARK_INDICES.RIGHT_ELBOW,
        LANDMARK_INDICES.LEFT_WRIST,
        LANDMARK_INDICES.RIGHT_WRIST
    ];
    
    keyPoints.forEach(index => {
        const landmark = landmarks[index];
        if (landmark && landmark.visibility > 0.1) {
            // Mirror view: flip X coordinate
            const mirroredX = width - (landmark.x * width);
            const y = landmark.y * height;
            
            // Determine color based on side
            let color, size = 8;
            
            if (index === LANDMARK_INDICES.RIGHT_SHOULDER || 
                index === LANDMARK_INDICES.RIGHT_ELBOW || 
                index === LANDMARK_INDICES.RIGHT_WRIST) {
                color = COLORS.leftSide; // Screen left = red
            } else if (index === LANDMARK_INDICES.LEFT_SHOULDER || 
                      index === LANDMARK_INDICES.LEFT_ELBOW || 
                      index === LANDMARK_INDICES.LEFT_WRIST) {
                color = COLORS.rightSide; // Screen right = blue
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

function drawRepsCounter(width, height) {
    // Draw background box
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    canvasCtx.fillRect(20, 20, 180, 80);
    
    // Draw border
    canvasCtx.strokeStyle = '#00dbde';
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeRect(20, 20, 180, 80);
    
    // Draw "REPS" label
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 16px Arial';
    canvasCtx.textAlign = 'left';
    canvasCtx.fillText('BICEP CURL REPS', 35, 45);
    
    // Draw total reps count
    canvasCtx.fillStyle = '#00dbde';
    canvasCtx.font = 'bold 36px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(totalReps.toString(), 110, 85);
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
        countReps('left', leftArmAngle);
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
        countReps('right', rightArmAngle);
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

function countReps(side, angle) {
    const currentTime = Date.now();
    const timeSinceLastRep = currentTime - lastRepTime;
    
    if (side === 'left') {
        if (angle > 160) {
            leftStageState = "down";
            updateLeftStage("DOWN", "#FF6B6B");
            updateLeftStageProgress(1);
        }
        
        if (angle < 40 && leftStageState === "down" && timeSinceLastRep > repCooldown) {
            leftStageState = "up";
            leftArmCounter++;
            totalReps++;
            lastRepTime = currentTime;
            updateCounters();
            updateLeftStage("UP", "#EF476F");
            updateLeftStageProgress(0);
            animateLeftRep();
        }
    } else if (side === 'right') {
        if (angle > 160) {
            rightStageState = "down";
            updateRightStage("DOWN", "#4CC9F0");
            updateRightStageProgress(1);
        }
        
        if (angle < 40 && rightStageState === "down" && timeSinceLastRep > repCooldown) {
            rightStageState = "up";
            rightArmCounter++;
            totalReps++;
            lastRepTime = currentTime;
            updateCounters();
            updateRightStage("UP", "#EF476F");
            updateRightStageProgress(0);
            animateRightRep();
        }
    }
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

function updateCounters() {
    totalRepsElement.textContent = totalReps;
    totalCounterElement.textContent = totalReps;
    
    // Add animation
    totalCounterElement.classList.add('rep-animation');
    setTimeout(() => totalCounterElement.classList.remove('rep-animation'), 500);
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
    landmarkCount.textContent = `Points: ${count}/33`;
    mobileTotalPoints.textContent = count;
    
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
    totalReps = 0;
    leftStageState = null;
    rightStageState = null;
    lastRepTime = 0;
    
    updateCounters();
    updateLeftStage('--', '#a0a0c0');
    updateRightStage('--', '#a0a0c0');
    updateLeftStageProgress(0);
    updateRightStageProgress(0);
    clearCanvas();
    
    // Visual feedback
    totalCounterElement.style.color = '#FF6B6B';
    setTimeout(() => {
        totalCounterElement.style.color = '#00dbde';
    }, 300);
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updateStatus('Starting camera...');
        
        await initializeMediaPipe();
        
        // Request camera access
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        });
        
        // Set video source
        videoElement.srcObject = mediaStream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                // Set canvas size to match video
                overlayCanvas.width = videoElement.videoWidth;
                overlayCanvas.height = videoElement.videoHeight;
                resolve();
            };
        });
        
        // Start MediaPipe processing
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (pose) {
                    await pose.send({ image: videoElement });
                }
            },
            width: overlayCanvas.width,
            height: overlayCanvas.height
        });
        
        await camera.start();
        updateStatus('Ready - Do bicep curls!');
        
        // Start FPS counter
        startFPSCounter();
        
    } catch (error) {
        console.error('Camera error:', error);
        updateStatus('Camera access required - Please allow camera permissions');
        
        // Show user-friendly error
        if (error.name === 'NotAllowedError') {
            alert('Please allow camera access to use this application. Refresh the page and click "Allow" when prompted.');
        }
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

// Total counter tap to reset
totalCounterElement.addEventListener('click', () => {
    totalReps = 0;
    updateCounters();
});

// Mobile summary tap to reset
totalRepsElement.addEventListener('click', () => {
    totalReps = 0;
    updateCounters();
});

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting Bicep Curl Counter...');
    
    // Set canvas size initially
    overlayCanvas.width = 640;
    overlayCanvas.height = 480;
    
    await startCamera();
    updateProcessingMode();
    
    console.log('System ready - Single hand rep counting active');
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