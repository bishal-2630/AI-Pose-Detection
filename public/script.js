// script.js - Fixed pose detection with proper landmark visualization

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
const totalCounterElement = document.getElementById('totalCounter');
const mobileLeftAngle = document.getElementById('mobileLeftAngle');
const mobileRightAngle = document.getElementById('mobileRightAngle');
const mobileTotalPoints = document.getElementById('mobileTotalPoints');
const detectedPoints = document.getElementById('detectedPoints');
const landmarksProgress = document.getElementById('landmarksProgress');
const processingMode = document.getElementById('processingMode');
const latencyDisplay = document.getElementById('latencyDisplay');
const fpsCounter = document.getElementById('fpsCounter');
const confidenceDisplay = document.getElementById('confidenceDisplay');
const detectionStatus = document.getElementById('detectionStatus');
const armVisibility = document.getElementById('armVisibility');
const resetBtn = document.getElementById('resetBtn');
const apiToggleBtn = document.getElementById('apiToggle');
const cameraStatus = document.getElementById('cameraStatus');

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
let mediaStream = null;
let frameCount = 0;
let fps = 0;
let landmarks = null;
let detectionConfidence = 0;
let lastRepTime = 0;
let repCooldown = 1000;
let lastFrameTime = 0;
let animationFrameId = null;
let isPoseReady = false;

// Colors for mirror view
const COLORS = {
    leftSide: '#FF6B6B',     // Red for left arm (screen)
    rightSide: '#4CC9F0',    // Blue for right arm (screen)
    center: '#FFD166',       // Yellow for center points
    connections: '#118AB2',  // Blue for skeleton lines
    angleArc: '#06D6A0'      // Green for angles
};

// Landmark indices for MediaPipe
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

// Pose connections for drawing skeleton
const POSE_CONNECTIONS = [
    [11, 12], // Shoulders
    [12, 14], // Right shoulder to right elbow
    [14, 16], // Right elbow to right wrist
    [11, 13], // Left shoulder to left elbow
    [13, 15], // Left elbow to left wrist
    [12, 24], // Right shoulder to right hip
    [11, 23], // Left shoulder to left hip
    [24, 23], // Hips
    [24, 26], // Right hip to right knee
    [23, 25]  // Left hip to left knee
];

// ==================== MEDIAPIPE INITIALIZATION ====================

async function initializeMediaPipe() {
    try {
        updateStatus('Loading pose detection...');
        
        // Check if MediaPipe is already loaded
        if (typeof window.Pose === 'undefined') {
            const poseScript = document.createElement('script');
            poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
            document.head.appendChild(poseScript);
            
            await new Promise(resolve => {
                poseScript.onload = resolve;
            });
        }
        
        // Initialize MediaPipe Pose
        pose = new Pose({
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
        
        isPoseReady = true;
        updateStatus('Pose detection ready - Start exercising!');
        return true;
        
    } catch (error) {
        console.error('MediaPipe error:', error);
        updateStatus('Failed to load pose detection');
        return false;
    }
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updateStatus('Requesting camera access...');
        
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: false
        });
        
        videoElement.srcObject = mediaStream;
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                overlayCanvas.width = videoElement.videoWidth;
                overlayCanvas.height = videoElement.videoHeight;
                console.log(`Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                updateStatus('Camera ready - Start exercising!');
                drawTopLeftRepsCounter(); // Draw initial reps counter
                resolve();
            };
            videoElement.onerror = () => {
                console.error('Video element error');
                updateStatus('Failed to load video');
                resolve();
            };
        });
        
        await initializeMediaPipe();
        startFrameProcessing();
        startFPSCounter();
        
    } catch (error) {
        console.error('Camera error:', error);
        if (error.name === 'NotAllowedError') {
            updateStatus('Camera access denied. Please allow camera permissions.');
            alert('Camera access is required. Please allow camera permissions and refresh the page.');
        } else if (error.name === 'NotFoundError') {
            updateStatus('No camera found. Please connect a camera.');
        } else {
            updateStatus(`Camera error: ${error.message}`);
        }
    }
}

function startFrameProcessing() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    function processFrame() {
        if (videoElement.readyState >= 2 && pose && isPoseReady) {
            pose.send({image: videoElement});
            frameCount++;
        }
        animationFrameId = requestAnimationFrame(processFrame);
    }
    
    processFrame();
}

function startFPSCounter() {
    setInterval(() => {
        const now = performance.now();
        const elapsed = now - lastFrameTime;
        fps = elapsed > 0 ? Math.round(1000 / elapsed) : 0;
        lastFrameTime = now;
        
        fpsCounter.textContent = `${fps} FPS`;
        fpsCounter.style.color = fps < 15 ? '#FF6B6B' : 
                                fps < 25 ? '#FFD166' : '#4CC9F0';
    }, 1000);
}

// ==================== POSE DETECTION & VISUALIZATION ====================

function onPoseResults(results) {
    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        landmarks = results.poseLandmarks;
        detectionConfidence = calculateConfidence(results);
        
        const detectedCount = countDetectedLandmarks(landmarks);
        updateLandmarkStats(detectedCount);
        
        clearCanvas();
        drawSkeleton(results);
        drawTopLeftRepsCounter(); // Draw reps counter on every frame
        
        if (detectedCount > 0) {
            updateStatus(`${detectedCount} points detected`);
            calculateArmAngles(landmarks);
        }
    } else {
        landmarks = null;
        clearCanvas();
        drawTopLeftRepsCounter(); // Always show reps counter
        updateLandmarkStats(0);
        updateStatus('Move into frame');
    }
}

function countDetectedLandmarks(landmarks) {
    if (!landmarks) return 0;
    return landmarks.filter(landmark => 
        landmark && landmark.visibility && landmark.visibility > 0.1
    ).length;
}

function calculateConfidence(results) {
    if (!results.poseWorldLandmarks || !results.poseWorldLandmarks.length) return 0;
    const sum = results.poseWorldLandmarks.reduce((acc, landmark) => 
        acc + (landmark.visibility || 0), 0
    );
    return Math.round((sum / results.poseWorldLandmarks.length) * 100);
}

function drawSkeleton(results) {
    const width = overlayCanvas.width;
    const height = overlayCanvas.height;
    
    if (results.poseLandmarks) {
        drawConnections(results.poseLandmarks, width, height);
        drawKeyLandmarks(results.poseLandmarks, width, height);
    }
}

function drawConnections(landmarks, width, height) {
    canvasCtx.lineWidth = 3;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    
    // Draw all pose connections
    POSE_CONNECTIONS.forEach(connection => {
        const startIndex = connection[0];
        const endIndex = connection[1];
        
        const startLandmark = landmarks[startIndex];
        const endLandmark = landmarks[endIndex];
        
        if (startLandmark && endLandmark && 
            startLandmark.visibility > 0.1 && endLandmark.visibility > 0.1) {
            
            // Determine color based on side
            let color = COLORS.connections;
            if (startIndex >= 11 && startIndex <= 16) {
                // Arm landmarks
                if (startIndex === 13 || startIndex === 15) {
                    color = COLORS.rightSide; // Left arm (screen right)
                } else if (startIndex === 14 || startIndex === 16) {
                    color = COLORS.leftSide; // Right arm (screen left)
                }
            }
            
            drawLine(startLandmark, endLandmark, width, height, color);
        }
    });
}

function drawLine(start, end, width, height, color) {
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

function drawKeyLandmarks(landmarks, width, height) {
    // Draw arm landmarks with larger dots
    const armPoints = [
        {index: LANDMARK_INDICES.LEFT_SHOULDER, color: COLORS.rightSide, label: 'LS'},
        {index: LANDMARK_INDICES.RIGHT_SHOULDER, color: COLORS.leftSide, label: 'RS'},
        {index: LANDMARK_INDICES.LEFT_ELBOW, color: COLORS.rightSide, label: 'LE'},
        {index: LANDMARK_INDICES.RIGHT_ELBOW, color: COLORS.leftSide, label: 'RE'},
        {index: LANDMARK_INDICES.LEFT_WRIST, color: COLORS.rightSide, label: 'LW'},
        {index: LANDMARK_INDICES.RIGHT_WRIST, color: COLORS.leftSide, label: 'RW'}
    ];
    
    armPoints.forEach(point => {
        const landmark = landmarks[point.index];
        if (landmark && landmark.visibility > 0.1) {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            // Outer circle
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 10, 0, 2 * Math.PI);
            canvasCtx.fillStyle = point.color + '80'; // 50% opacity
            canvasCtx.fill();
            
            // Inner circle
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
            canvasCtx.fillStyle = point.color;
            canvasCtx.fill();
            
            // White center
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 3, 0, 2 * Math.PI);
            canvasCtx.fillStyle = '#FFFFFF';
            canvasCtx.fill();
            
            // Label
            canvasCtx.fillStyle = '#FFFFFF';
            canvasCtx.font = 'bold 12px Arial';
            canvasCtx.textAlign = 'center';
            canvasCtx.textBaseline = 'middle';
            canvasCtx.fillText(point.label, x, y);
        }
    });
    
    // Draw center points (hips and nose) in yellow
    const centerPoints = [
        {index: LANDMARK_INDICES.NOSE, color: COLORS.center, label: 'N'},
        {index: LANDMARK_INDICES.LEFT_HIP, color: COLORS.center, label: 'LH'},
        {index: LANDMARK_INDICES.RIGHT_HIP, color: COLORS.center, label: 'RH'}
    ];
    
    centerPoints.forEach(point => {
        const landmark = landmarks[point.index];
        if (landmark && landmark.visibility > 0.1) {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 8, 0, 2 * Math.PI);
            canvasCtx.fillStyle = point.color;
            canvasCtx.fill();
            
            canvasCtx.fillStyle = '#000000';
            canvasCtx.font = 'bold 10px Arial';
            canvasCtx.textAlign = 'center';
            canvasCtx.textBaseline = 'middle';
            canvasCtx.fillText(point.label, x, y);
        }
    });
}

function drawTopLeftRepsCounter() {
    const width = overlayCanvas.width;
    const padding = 15;
    const boxWidth = 180;
    const boxHeight = 70;
    
    // Background box
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    canvasCtx.fillRect(padding, padding, boxWidth, boxHeight);
    
    // Border
    canvasCtx.strokeStyle = '#00dbde';
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeRect(padding, padding, boxWidth, boxHeight);
    
    // Title
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 16px Arial';
    canvasCtx.textAlign = 'left';
    canvasCtx.textBaseline = 'top';
    canvasCtx.fillText('BICEP CURL REPS', padding + 10, padding + 10);
    
    // Reps count
    canvasCtx.fillStyle = '#00dbde';
    canvasCtx.font = 'bold 36px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(totalReps.toString(), padding + boxWidth/2, padding + boxHeight/2 + 5);
    
    // Status dot
    if (landmarks && landmarks.length > 0) {
        canvasCtx.fillStyle = '#06D6A0';
        canvasCtx.beginPath();
        canvasCtx.arc(padding + 10, padding + 10, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ==================== ARM ANGLE CALCULATION ====================

function calculateArmAngles(landmarks) {
    // Note: Due to mirror view, left arm in camera is right side in landmarks
    const leftShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER]; // Screen left
    const leftElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const leftWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    
    const rightShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER]; // Screen right
    const rightElbow = landmarks[LANDMARK_INDICES.LEFT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST];
    
    if (leftShoulder && leftElbow && leftWrist && 
        leftShoulder.visibility > 0.3 && 
        leftElbow.visibility > 0.3 && 
        leftWrist.visibility > 0.3) {
        leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        updateLeftArmUI(leftArmAngle);
        countReps('left', leftArmAngle);
        drawAngleArc(leftShoulder, leftElbow, leftWrist, COLORS.leftSide);
    } else {
        leftArmAngle = 0;
        updateLeftArmUI(0, false);
    }
    
    if (rightShoulder && rightElbow && rightWrist && 
        rightShoulder.visibility > 0.3 && 
        rightElbow.visibility > 0.3 && 
        rightWrist.visibility > 0.3) {
        rightArmAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        updateRightArmUI(rightArmAngle);
        countReps('right', rightArmAngle);
        drawAngleArc(rightShoulder, rightElbow, rightWrist, COLORS.rightSide);
    } else {
        rightArmAngle = 0;
        updateRightArmUI(0, false);
    }
    
    updateArmVisibility(leftShoulder && rightShoulder);
}

function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - 
                   Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    
    return Math.min(angle, 180);
}

function drawAngleArc(a, b, c, color) {
    const width = overlayCanvas.width;
    const height = overlayCanvas.height;
    
    const bx = b.x * width;
    const by = b.y * height;
    const radius = 25;
    
    // Calculate angle for arc
    const angleBA = Math.atan2(a.y * height - by, a.x * width - bx);
    const angleBC = Math.atan2(c.y * height - by, c.x * width - bx);
    const angle = calculateAngle(a, b, c);
    
    // Draw arc
    canvasCtx.beginPath();
    canvasCtx.arc(bx, by, radius, angleBA, angleBC);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 3;
    canvasCtx.stroke();
    
    // Draw angle text near the elbow
    canvasCtx.fillStyle = color;
    canvasCtx.font = 'bold 14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.textBaseline = 'middle';
    canvasCtx.fillText(`${Math.round(angle)}°`, bx, by - 20);
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
            drawTopLeftRepsCounter(); // Redraw with new count
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
            drawTopLeftRepsCounter(); // Redraw with new count
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
    totalCounterElement.textContent = totalReps;
    
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
    mobileTotalPoints.textContent = count;
    
    const percent = Math.min((count / 33) * 100, 100);
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
    detectionStatus.textContent = message;
    if (cameraStatus) {
        cameraStatus.textContent = message;
    }
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
    
    drawTopLeftRepsCounter(); // Draw reset counter
    
    totalCounterElement.style.color = '#FF6B6B';
    setTimeout(() => {
        totalCounterElement.style.color = '#00dbde';
    }, 300);
}

// ==================== EVENT LISTENERS ====================

apiToggleBtn.addEventListener('click', toggleProcessingMode);
resetBtn.addEventListener('click', resetAll);

// Total counter tap to reset
totalCounterElement.addEventListener('click', () => {
    totalReps = 0;
    updateCounters();
    drawTopLeftRepsCounter();
});

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting Bicep Curl Counter...');
    
    // Set initial canvas size
    overlayCanvas.width = 640;
    overlayCanvas.height = 480;
    
    await startCamera();
    updateProcessingMode();
    
    console.log('System initialized');
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});