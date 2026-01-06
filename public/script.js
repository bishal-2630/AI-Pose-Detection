// script.js - Complete 33 Landmark Points Visualization

// DOM Elements
const videoElement = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasCtx = overlayCanvas.getContext('2d');
const counterElement = document.getElementById('counter');
const stageTextElement = document.getElementById('stageText');
const angleValueElement = document.getElementById('angleValue');
const angleDisplayElement = document.getElementById('angleDisplay');
const angleProgressElement = document.getElementById('angleProgress');
const angleCircleFillElement = document.getElementById('angleCircleFill');
const stageIndicatorElement = document.getElementById('stageIndicator');
const landmarkCountElement = document.getElementById('landmarkCount');
const detectedLandmarksElement = document.getElementById('detectedLandmarks');
const landmarkBarElement = document.getElementById('landmarkBar');
const poseStatusElement = document.getElementById('poseStatus');
const processingModeElement = document.getElementById('processingMode');
const apiLatencyElement = document.getElementById('apiLatency');
const confidenceValueElement = document.getElementById('confidenceValue');
const fpsCounterElement = document.getElementById('fpsCounter');
const stageHintElement = document.getElementById('stageHint');
const processingHintElement = document.getElementById('processingHint');
const performanceHintElement = document.getElementById('performanceHint');
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
let detectionConfidence = 0;

// Colors for different landmark groups
const COLORS = {
    face: '#FF6B6B',        // Red for face landmarks
    upperBody: '#4CC9F0',   // Blue for upper body
    lowerBody: '#FFD166',   // Yellow for lower body
    connections: '#00DBDE', // Cyan for connections
    special: '#FC00FF',     // Purple for special points
    angleArc: '#FF9E6B',    // Orange for angle arcs
    rightArm: '#4CC9F0',    // Blue for right arm
    leftArm: '#FF6B6B'      // Red for left arm
};

// MediaPipe landmark indices
const LANDMARK_INDICES = {
    // Face landmarks (0-10)
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
    
    // Upper body (11-22)
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
    
    // Lower body (23-32)
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

// Skeleton connections (pairs of landmark indices)
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
    [LANDMARK_INDICES.LEFT_EYE, LANDMARK_INDICES.MOUTH_LEFT],
    [LANDMARK_INDICES.RIGHT_EYE, LANDMARK_INDICES.MOUTH_RIGHT],
    
    // Upper body connections
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
    
    // Lower body connections
    [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.RIGHT_HIP],
    [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.LEFT_KNEE],
    [LANDMARK_INDICES.LEFT_KNEE, LANDMARK_INDICES.LEFT_ANKLE],
    [LANDMARK_INDICES.RIGHT_HIP, LANDMARK_INDICES.RIGHT_KNEE],
    [LANDMARK_INDICES.RIGHT_KNEE, LANDMARK_INDICES.RIGHT_ANKLE],
    [LANDMARK_INDICES.LEFT_ANKLE, LANDMARK_INDICES.LEFT_HEEL],
    [LANDMARK_INDICES.RIGHT_ANKLE, LANDMARK_INDICES.RIGHT_HEEL],
    [LANDMARK_INDICES.LEFT_HEEL, LANDMARK_INDICES.LEFT_FOOT_INDEX],
    [LANDMARK_INDICES.RIGHT_HEEL, LANDMARK_INDICES.RIGHT_FOOT_INDEX],
    [LANDMARK_INDICES.LEFT_ANKLE, LANDMARK_INDICES.LEFT_FOOT_INDEX],
    [LANDMARK_INDICES.RIGHT_ANKLE, LANDMARK_INDICES.RIGHT_FOOT_INDEX]
];

// ==================== MEDIAPIPE INITIALIZATION ====================

async function initializeMediaPipe() {
    try {
        updatePoseStatus('Loading MediaPipe...');
        
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
            modelComplexity: 2, // Use complex model for better accuracy
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        // Set up results callback
        pose.onResults(onPoseResults);
        
        updatePoseStatus('Ready for detection');
        return true;
        
    } catch (error) {
        console.error('MediaPipe initialization error:', error);
        updatePoseStatus('Initialization failed');
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
        detectionConfidence = results.poseWorldLandmarks ? 
            calculateAverageConfidence(results.poseWorldLandmarks) : 0.7;
        
        // Count detected landmarks
        const detectedCount = countDetectedLandmarks(landmarks);
        updateLandmarkStats(detectedCount);
        
        // Draw complete skeleton with all 33 points
        drawCompleteSkeleton(results);
        
        // Process for bicep curl counting
        processBicepCurl(landmarks);
        
        updatePoseStatus(`${detectedCount} landmarks detected`);
    } else {
        landmarks = null;
        clearCanvas();
        updateLandmarkStats(0);
        updatePoseStatus('No body detected - Move into frame');
    }
    
    frameCount++;
}

function countDetectedLandmarks(landmarks) {
    return landmarks.filter(landmark => 
        landmark && landmark.visibility && landmark.visibility > 0.1
    ).length;
}

function calculateAverageConfidence(worldLandmarks) {
    if (!worldLandmarks) return 0;
    const sum = worldLandmarks.reduce((acc, landmark) => 
        acc + (landmark.visibility || 0), 0
    );
    return Math.round((sum / worldLandmarks.length) * 100);
}

function drawCompleteSkeleton(results) {
    const videoWidth = overlayCanvas.width;
    const videoHeight = overlayCanvas.height;
    
    // Clear previous frame
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);
    
    // Draw all skeleton connections
    drawAllConnections(results.poseLandmarks, videoWidth, videoHeight);
    
    // Draw all 33 landmark points
    drawAllLandmarks(results.poseLandmarks, videoWidth, videoHeight);
    
    // Highlight right arm for bicep curl
    highlightRightArm(results.poseLandmarks, videoWidth, videoHeight);
}

function drawAllConnections(landmarks, width, height) {
    canvasCtx.lineWidth = 2;
    canvasCtx.lineCap = 'round';
    
    SKELETON_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        
        if (start && end && start.visibility > 0.1 && end.visibility > 0.1) {
            // Determine color based on connection type
            let color = COLORS.connections;
            
            // Face connections
            if (startIdx <= 10 || endIdx <= 10) {
                color = COLORS.face;
            }
            // Upper body connections
            else if (startIdx <= 22 || endIdx <= 22) {
                color = startIdx === LANDMARK_INDICES.RIGHT_SHOULDER || 
                        endIdx === LANDMARK_INDICES.RIGHT_SHOULDER ? 
                        COLORS.rightArm : COLORS.upperBody;
            }
            // Lower body connections
            else {
                color = COLORS.lowerBody;
            }
            
            drawConnection(start, end, width, height, color);
        }
    });
}

function drawConnection(start, end, width, height, color) {
    const startX = start.x * width;
    const startY = start.y * height;
    const endX = end.x * width;
    const endY = end.y * height;
    
    // Draw line with glow effect
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    canvasCtx.lineTo(endX, endY);
    canvasCtx.strokeStyle = color;
    
    // Add subtle glow
    canvasCtx.shadowColor = color;
    canvasCtx.shadowBlur = 8;
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
}

function drawAllLandmarks(landmarks, width, height) {
    landmarks.forEach((landmark, index) => {
        if (landmark && landmark.visibility > 0.1) {
            // Determine color based on landmark group
            let color, size;
            
            if (index <= 10) {
                // Face landmarks
                color = COLORS.face;
                size = 5;
            } else if (index <= 22) {
                // Upper body landmarks
                color = index === LANDMARK_INDICES.RIGHT_SHOULDER || 
                        index === LANDMARK_INDICES.RIGHT_ELBOW || 
                        index === LANDMARK_INDICES.RIGHT_WRIST ? 
                        COLORS.rightArm : COLORS.upperBody;
                size = 7;
            } else {
                // Lower body landmarks
                color = COLORS.lowerBody;
                size = 6;
            }
            
            // Special landmarks (nose, shoulders, hips)
            if (index === LANDMARK_INDICES.NOSE) {
                color = COLORS.special;
                size = 8;
            } else if (index === LANDMARK_INDICES.LEFT_SHOULDER || 
                      index === LANDMARK_INDICES.RIGHT_SHOULDER) {
                size = 9;
            } else if (index === LANDMARK_INDICES.LEFT_HIP || 
                      index === LANDMARK_INDICES.RIGHT_HIP) {
                size = 8;
            }
            
            drawLandmark(landmark, width, height, color, size, index);
        }
    });
}

function drawLandmark(landmark, width, height, color, size, index) {
    const x = landmark.x * width;
    const y = landmark.y * height;
    
    // Draw outer glow
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 1.8, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color + '30';
    canvasCtx.fill();
    
    // Draw main point
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();
    
    // Draw white center for better visibility
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, size * 0.4, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.fill();
    
    // Draw landmark number for key points
    if ([0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(index)) {
        canvasCtx.fillStyle = '#FFFFFF';
        canvasCtx.font = 'bold 10px Arial';
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText(index, x, y);
    }
}

function highlightRightArm(landmarks, width, height) {
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
    const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
    
    if (rightShoulder && rightElbow && rightWrist && 
        rightShoulder.visibility > 0.1 && 
        rightElbow.visibility > 0.1 && 
        rightWrist.visibility > 0.1) {
        
        // Draw thicker arm lines
        drawConnection(rightShoulder, rightElbow, width, height, COLORS.rightArm);
        drawConnection(rightElbow, rightWrist, width, height, COLORS.rightArm);
        
        // Draw angle arc at elbow
        drawAngleArc(rightShoulder, rightElbow, rightWrist, width, height);
    }
}

function drawAngleArc(shoulder, elbow, wrist, width, height) {
    const elbowX = elbow.x * width;
    const elbowY = elbow.y * height;
    
    // Calculate angle
    const angle = calculateAngle(shoulder, elbow, wrist);
    const radius = 40;
    
    // Calculate start and end angles
    const startAngle = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
    const endAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    
    // Draw angle arc
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, startAngle, endAngle);
    canvasCtx.strokeStyle = angle < 90 ? COLORS.angleArc : COLORS.rightArm;
    canvasCtx.lineWidth = 3;
    canvasCtx.lineCap = 'round';
    canvasCtx.stroke();
    
    // Draw angle value
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(`${Math.round(angle)}°`, elbowX, elbowY - radius - 10);
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ==================== BICEP CURL PROCESSING ====================

function processBicepCurl(landmarks) {
    try {
        const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
        const rightElbow = landmarks[LANDMARK_INDICES.RIGHT_ELBOW];
        const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST];
        
        if (!rightShoulder || !rightElbow || !rightWrist ||
            rightShoulder.visibility < 0.3 || 
            rightElbow.visibility < 0.3 || 
            rightWrist.visibility < 0.3) {
            updatePoseStatus('Right arm not fully visible');
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
                updateProcessingHint('API processing active');
                return;
            }
        }
    } catch (error) {
        console.error('API error:', error);
    }
    
    // Fallback to local processing
    processLocally(shoulder, elbow, wrist);
    updateProcessingHint('Using local fallback');
}

function processLocally(shoulder, elbow, wrist) {
    const angle = calculateAngle(shoulder, elbow, wrist);
    currentAngle = angle;
    
    updateAngleDisplay(angle);
    updateCounterLogic(angle);
    updateLatency(0);
    updateProcessingHint('Local processing active');
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
        updateStageHint('Ready to curl up');
    }
    
    if (angle < 40 && stage === "down") {
        stage = "up";
        counter++;
        updateCounter();
        updateStageUI("UP", "#ff6b6b");
        updateStageProgress(0);
        updateStageHint('Full contraction!');
        animateRep();
    }
}

function updateCounterFromAPI() {
    updateCounter();
    
    if (stage === "up") {
        updateStageUI("UP", "#ff6b6b");
        updateStageProgress(0);
        updateStageHint('Full contraction!');
        animateRep();
    } else if (stage === "down") {
        updateStageUI("DOWN", "#4cc9f0");
        updateStageProgress(1);
        updateStageHint('Ready to curl up');
    } else {
        updateStageUI("Waiting...", "#a0a0c0");
        updateStageProgress(0.5);
        updateStageHint('Perform bicep curls');
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
    
    // Update angle circle
    const circlePercent = (angle / 180) * 360;
    angleCircleFillElement.style.background = 
        `conic-gradient(from 0deg, #00dbde 0deg, #00dbde ${circlePercent}deg, transparent ${circlePercent}deg, transparent 360deg)`;
}

function updateLandmarkStats(count) {
    detectedLandmarksElement.textContent = count;
    landmarkCountElement.textContent = `Landmarks: ${count}/33`;
    
    // Update progress bar
    const percent = (count / 33) * 100;
    landmarkBarElement.style.width = `${percent}%`;
    
    // Update confidence
    confidenceValueElement.textContent = `${Math.round(detectionConfidence)}%`;
    confidenceValueElement.style.color = detectionConfidence > 70 ? '#4cc9f0' : 
                                       detectionConfidence > 50 ? '#ffd166' : '#ff6b6b';
}

function updateStageUI(text, color) {
    stageTextElement.textContent = text;
    stageTextElement.style.color = color;
}

function updateStageProgress(progress) {
    stageIndicatorElement.style.width = `${progress * 100}%`;
}

function updateStageHint(hint) {
    stageHintElement.textContent = hint;
}

function updateProcessingHint(hint) {
    processingHintElement.textContent = hint;
}

function updateCounter() {
    counterElement.textContent = counter;
    counterElement.classList.add('rep-animation');
    setTimeout(() => {
        counterElement.classList.remove('rep-animation');
    }, 500);
}

function animateRep() {
    // Highlight right arm landmarks
    const rightArmIndices = [12, 14, 16]; // Shoulder, Elbow, Wrist
    rightArmIndices.forEach(index => {
        // Visual feedback in UI
        const landmarkItems = document.querySelectorAll('.landmark-list span');
        if (landmarkItems[index]) {
            landmarkItems[index].classList.add('landmark-active');
            setTimeout(() => landmarkItems[index].classList.remove('landmark-active'), 1000);
        }
    });
}

function updatePoseStatus(message) {
    poseStatusElement.textContent = message;
}

function updateLatency(latency) {
    apiLatencyElement.textContent = `Latency: ${latency}ms`;
    
    // Color code based on latency
    if (latency > 200) {
        apiLatencyElement.style.color = '#ff6b6b';
        performanceHintElement.textContent = 'High latency';
    } else if (latency > 100) {
        apiLatencyElement.style.color = '#ffd166';
        performanceHintElement.textContent = 'Moderate latency';
    } else {
        apiLatencyElement.style.color = '#4cc9f0';
        performanceHintElement.textContent = 'Low latency';
    }
}

function updateProcessingMode() {
    processingModeElement.textContent = useAPI ? 'Python API' : 'Browser';
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
    updateStageHint('Perform bicep curls');
    clearCanvas();
    
    // Visual feedback
    counterElement.style.color = '#ff6b6b';
    setTimeout(() => {
        counterElement.style.color = '#00dbde';
    }, 300);
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updatePoseStatus('Starting camera...');
        
        // Initialize MediaPipe
        await initializeMediaPipe();
        
        // Get camera stream
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
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
        updatePoseStatus('Ready - Showing all 33 landmarks');
        
        // Start FPS counter
        startFPSCounter();
        
    } catch (error) {
        console.error('Camera error:', error);
        updatePoseStatus('Camera access denied - Please allow camera');
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
            performanceHintElement.textContent = 'Low FPS';
        } else if (fps < 25) {
            fpsCounterElement.style.color = '#ffd166';
            performanceHintElement.textContent = 'Moderate FPS';
        } else {
            fpsCounterElement.style.color = '#4cc9f0';
            performanceHintElement.textContent = 'High FPS';
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
    console.log('Starting Full Body Pose Detection with 33 Landmarks...');
    
    // Start camera and processing
    await startCamera();
    updateProcessingMode();
    
    console.log('System ready - Displaying all 33 landmark points');
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