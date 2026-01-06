// script.js - Simplified version with real-time skeleton drawing

// DOM Elements
const videoElement = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasCtx = overlayCanvas.getContext('2d');
const counterElement = document.getElementById('counter');
const stageTextElement = document.getElementById('stageText');
const angleValueElement = document.getElementById('angleValue');
const angleDisplayElement = document.getElementById('angleDisplay');
const angleProgressElement = document.getElementById('angleProgress');
const angleBarElement = document.getElementById('angleBar');
const stageIndicatorElement = document.getElementById('stageIndicator');
const poseStatusElement = document.getElementById('poseStatus');
const processingModeElement = document.getElementById('processingMode');
const apiLatencyElement = document.getElementById('apiLatency');
const fpsCounterElement = document.getElementById('fpsCounter');
const detectionStatusElement = document.getElementById('detectionStatus');
const apiToggleBtn = document.getElementById('apiToggle');
const resetBtn = document.getElementById('resetBtn');

// State variables
let counter = 0;
let stage = null;
let currentAngle = 0;
let useAPI = true;
let pose = null;
let camera = null;
let mediaStream = null;
let frameCount = 0;
let fps = 0;
let landmarks = null;

// Motion trail for smooth visualization
const motionTrail = {
    wrist: [],
    elbow: [],
    maxPoints: 15
};

// Colors for visualization
const COLORS = {
    shoulder: '#4cc9f0',
    elbow: '#ff6b6b',
    wrist: '#ffd166',
    line: '#00dbde',
    trail: 'rgba(255, 107, 107, 0.3)'
};

// ==================== MEDIAPIPE INITIALIZATION ====================

async function initializeMediaPipe() {
    try {
        updateDetectionStatus('Loading MediaPipe...');
        
        // Load MediaPipe dynamically
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
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            enableSegmentation: false
        });
        
        // Set up results callback
        pose.onResults(onPoseResults);
        
        updateDetectionStatus('Ready');
        return true;
        
    } catch (error) {
        console.error('MediaPipe initialization error:', error);
        updateDetectionStatus('Failed');
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

// ==================== POSE DETECTION & DRAWING ====================

function onPoseResults(results) {
    if (results.poseLandmarks) {
        landmarks = results.poseLandmarks;
        updateDetectionStatus('Body Detected ✓');
        
        // Draw skeleton in real-time
        drawSkeleton(results);
        
        // Add to motion trail
        updateMotionTrail(results);
        
        // Process the landmarks
        processLandmarks(results);
    } else {
        landmarks = null;
        clearOverlay();
        updateDetectionStatus('Searching...');
        updatePoseStatus('No body detected');
    }
    
    frameCount++;
}

function drawSkeleton(results) {
    const videoWidth = overlayCanvas.width;
    const videoHeight = overlayCanvas.height;
    
    // Clear previous frame
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
    
    // Get right arm landmarks
    const rightShoulder = results.poseLandmarks[12];
    const rightElbow = results.poseLandmarks[14];
    const rightWrist = results.poseLandmarks[16];
    
    if (!rightShoulder || !rightElbow || !rightWrist) {
        updatePoseStatus('Arm not fully visible');
        return;
    }
    
    // Draw motion trail
    drawMotionTrail(videoWidth, videoHeight);
    
    // Draw skeleton lines with glow effect
    drawSkeletonLine(rightShoulder, rightElbow, videoWidth, videoHeight, COLORS.line, 4);
    drawSkeletonLine(rightElbow, rightWrist, videoWidth, videoHeight, COLORS.line, 4);
    
    // Draw landmark points with pulsing effect
    drawLandmarkPoint(rightShoulder, videoWidth, videoHeight, COLORS.shoulder, 12, 'Shoulder');
    drawLandmarkPoint(rightElbow, videoWidth, videoHeight, COLORS.elbow, 15, 'Elbow');
    drawLandmarkPoint(rightWrist, videoWidth, videoHeight, COLORS.wrist, 12, 'Wrist');
    
    // Draw angle arc at elbow
    drawAngleArc(rightShoulder, rightElbow, rightWrist, videoWidth, videoHeight);
}

function drawSkeletonLine(start, end, width, height, color, lineWidth) {
    const startX = start.x * width;
    const startY = start.y * height;
    const endX = end.x * width;
    const endY = end.y * height;
    
    // Draw line with shadow for glow effect
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    canvasCtx.lineTo(endX, endY);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.lineCap = 'round';
    
    // Add glow
    canvasCtx.shadowColor = color;
    canvasCtx.shadowBlur = 15;
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
}

function drawLandmarkPoint(landmark, width, height, color, size, label) {
    const x = landmark.x * width;
    const y = landmark.y * height;
    
    // Draw outer glow
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 1.5, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color + '40';
    canvasCtx.fill();
    
    // Draw inner point
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();
    
    // Draw white center
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 0.4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.fill();
    
    // Draw label
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = 'bold 14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(label, x, y - size - 10);
}

function drawAngleArc(shoulder, elbow, wrist, width, height) {
    const elbowX = elbow.x * width;
    const elbowY = elbow.y * height;
    
    // Calculate angle
    const angle = calculateAngle(shoulder, elbow, wrist);
    const radius = 35;
    
    // Calculate start and end angles
    const startAngle = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
    const endAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    
    // Draw angle arc
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, startAngle, endAngle);
    canvasCtx.strokeStyle = angle < 90 ? COLORS.elbow : COLORS.line;
    canvasCtx.lineWidth = 3;
    canvasCtx.lineCap = 'round';
    canvasCtx.stroke();
    
    // Draw angle value
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = 'bold 16px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(`${Math.round(angle)}°`, elbowX, elbowY - radius - 15);
}

function updateMotionTrail(results) {
    const wrist = results.poseLandmarks[16];
    const elbow = results.poseLandmarks[14];
    
    if (wrist) {
        motionTrail.wrist.push({x: wrist.x, y: wrist.y});
        if (motionTrail.wrist.length > motionTrail.maxPoints) {
            motionTrail.wrist.shift();
        }
    }
    
    if (elbow) {
        motionTrail.elbow.push({x: elbow.x, y: elbow.y});
        if (motionTrail.elbow.length > motionTrail.maxPoints) {
            motionTrail.elbow.shift();
        }
    }
}

function drawMotionTrail(width, height) {
    drawTrailPath(motionTrail.wrist, width, height, COLORS.trail);
    drawTrailPath(motionTrail.elbow, width, height, 'rgba(76, 201, 240, 0.3)');
}

function drawTrailPath(points, width, height, color) {
    if (points.length < 2) return;
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(points[0].x * width, points[0].y * height);
    
    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const x = point.x * width;
        const y = point.y * height;
        
        // Fade out older points
        const alpha = 0.7 * (i / points.length);
        canvasCtx.strokeStyle = color.replace(')', `, ${alpha})`);
        canvasCtx.lineWidth = 3 * (i / points.length);
        canvasCtx.lineCap = 'round';
        
        canvasCtx.lineTo(x, y);
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.moveTo(x, y);
    }
}

function clearOverlay() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    motionTrail.wrist = [];
    motionTrail.elbow = [];
}

// ==================== LANDMARK PROCESSING ====================

function processLandmarks(results) {
    try {
        const rightShoulder = results.poseLandmarks[12];
        const rightElbow = results.poseLandmarks[14];
        const rightWrist = results.poseLandmarks[16];
        
        if (!rightShoulder || !rightElbow || !rightWrist) {
            updatePoseStatus('Arm landmarks missing');
            return;
        }
        
        if (useAPI) {
            sendToAPI(rightShoulder, rightElbow, rightWrist);
        } else {
            processLocally(rightShoulder, rightElbow, rightWrist);
        }
        
    } catch (error) {
        console.error('Processing error:', error);
        updatePoseStatus('Processing error');
    }
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

async function sendToAPI(shoulder, elbow, wrist) {
    const startTime = performance.now();
    
    try {
        const requestData = {
            shoulder: [shoulder.x, shoulder.y],
            elbow: [elbow.x, elbow.y],
            wrist: [wrist.x, wrist.y],
            counter: counter,
            stage: stage
        };
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestData)
        });
        
        const latency = Math.round(performance.now() - startTime);
        updateLatency(latency);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                updateFromAPI(data);
                updatePoseStatus('API Processing ✓');
                return;
            }
        }
    } catch (error) {
        console.error('API error:', error);
    }
    
    // Fallback to local processing
    processLocally(shoulder, elbow, wrist);
    updatePoseStatus('Using local fallback');
}

function processLocally(shoulder, elbow, wrist) {
    const angle = calculateAngle(shoulder, elbow, wrist);
    currentAngle = angle;
    
    updateAngleDisplay(angle);
    updateCounterLogic(angle);
    updateLatency(0);
    updatePoseStatus('Local Processing ✓');
}

function updateFromAPI(data) {
    currentAngle = data.angle || 0;
    counter = data.counter || counter;
    stage = data.stage || stage;
    
    updateAngleDisplay(currentAngle);
    updateCounterFromAPI();
}

function updateCounterLogic(angle) {
    // Update angle-based UI
    updateAngleDisplay(angle);
    
    // Curl counter logic
    if (angle > 160) {
        stage = "down";
        updateStageUI("DOWN", "#4cc9f0");
        updateStageProgress(1);
    }
    
    if (angle < 40 && stage === "down") {
        stage = "up";
        counter++;
        updateCounter();
        updateStageUI("UP", "#ff6b6b");
        updateStageProgress(0);
        animateRep();
    }
}

function updateCounterFromAPI() {
    updateCounter();
    
    if (stage === "up") {
        updateStageUI("UP", "#ff6b6b");
        updateStageProgress(0);
        animateRep();
    } else if (stage === "down") {
        updateStageUI("DOWN", "#4cc9f0");
        updateStageProgress(1);
    } else {
        updateStageUI("Waiting...", "#a0a0c0");
        updateStageProgress(0.5);
    }
}

// ==================== UI UPDATES ====================

function updateAngleDisplay(angle) {
    const roundedAngle = Math.round(angle);
    angleValueElement.textContent = `${roundedAngle}°`;
    angleDisplayElement.textContent = `Angle: ${roundedAngle}°`;
    
    // Update progress bars
    const anglePercent = (angle / 180) * 100;
    angleProgressElement.style.width = `${Math.min(anglePercent, 100)}%`;
    angleBarElement.style.width = `${Math.min(anglePercent, 100)}%`;
}

function updateStageUI(text, color) {
    stageTextElement.textContent = text;
    stageTextElement.style.color = color;
}

function updateStageProgress(progress) {
    stageIndicatorElement.style.width = `${progress * 100}%`;
}

function updateCounter() {
    counterElement.textContent = counter;
    counterElement.classList.add('rep-animation');
    setTimeout(() => {
        counterElement.classList.remove('rep-animation');
    }, 500);
}

function animateRep() {
    // Visual feedback for completed rep
    document.querySelectorAll('.landmark-dot').forEach(dot => {
        dot.classList.add('point-glow');
        setTimeout(() => dot.classList.remove('point-glow'), 1000);
    });
}

function updatePoseStatus(message) {
    poseStatusElement.textContent = message;
}

function updateDetectionStatus(message) {
    detectionStatusElement.textContent = message;
}

function updateLatency(latency) {
    apiLatencyElement.textContent = `Latency: ${latency}ms`;
    
    // Color code based on latency
    if (latency > 200) {
        apiLatencyElement.style.color = '#ff6b6b';
    } else if (latency > 100) {
        apiLatencyElement.style.color = '#ffd166';
    } else {
        apiLatencyElement.style.color = '#4cc9f0';
    }
}

function updateProcessingMode() {
    processingModeElement.textContent = useAPI ? 'API' : 'Browser';
    apiToggleBtn.querySelector('.btn-text').textContent = 
        useAPI ? 'API Mode: ON' : 'API Mode: OFF';
}

function toggleProcessingMode() {
    useAPI = !useAPI;
    updateProcessingMode();
    updatePoseStatus(useAPI ? 'Switched to API mode' : 'Switched to browser mode');
}

function resetCounter() {
    counter = 0;
    stage = null;
    updateCounter();
    updateStageUI('Waiting...', '#a0a0c0');
    updateStageProgress(0.5);
    clearOverlay();
    
    // Visual feedback
    counterElement.style.color = '#ff6b6b';
    setTimeout(() => {
        counterElement.style.color = '#00dbde';
    }, 300);
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updateDetectionStatus('Starting camera...');
        
        // Initialize MediaPipe
        await initializeMediaPipe();
        
        // Get camera stream
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            }
        });
        
        videoElement.srcObject = mediaStream;
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = resolve;
        });
        
        // Set canvas dimensions
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        
        // Start MediaPipe camera
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
        updateDetectionStatus('Ready');
        
        // Start FPS counter
        startFPSCounter();
        
    } catch (error) {
        console.error('Camera error:', error);
        updateDetectionStatus('Camera access denied');
    }
}

function startFPSCounter() {
    setInterval(() => {
        fps = frameCount;
        frameCount = 0;
        fpsCounterElement.textContent = `${fps} FPS`;
        
        // Color code based on FPS
        if (fps < 15) {
            fpsCounterElement.style.color = '#ff6b6b';
        } else if (fps < 25) {
            fpsCounterElement.style.color = '#ffd166';
        } else {
            fpsCounterElement.style.color = '#4cc9f0';
        }
    }, 1000);
}

// ==================== EVENT LISTENERS ====================

apiToggleBtn.addEventListener('click', toggleProcessingMode);
resetBtn.addEventListener('click', resetCounter);

// Counter tap to reset
counterElement.addEventListener('click', resetCounter);

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Starting Real-time Pose Detection...');
    
    // Start camera and processing
    await startCamera();
    updateProcessingMode();
    
    console.log('System ready - Drawing skeleton in real-time');
});

// Cleanup on page close
window.addEventListener('beforeunload', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (camera) {
        camera.stop();
    }
});