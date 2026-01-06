// script.js - Enhanced with movement lines, mobile optimizations, and better UI

// DOM Elements
const videoElement = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasCtx = overlayCanvas.getContext('2d');
const counterElement = document.getElementById('counter');
const stageTextElement = document.getElementById('stageText');
const angleValueElement = document.getElementById('angleValue');
const angleDisplayElement = document.getElementById('angleDisplay');
const angleFillElement = document.getElementById('angleFill');
const angleCircleFillElement = document.getElementById('angleCircleFill');
const stageProgressElement = document.getElementById('stageProgress');
const cameraStatusElement = document.getElementById('cameraStatus');
const processingModeElement = document.getElementById('processingMode');
const apiStatusElement = document.getElementById('apiStatus');
const apiLatencyElement = document.getElementById('apiLatency');
const fpsCounterElement = document.getElementById('fpsCounter');
const batteryStatusElement = document.getElementById('batteryStatus');

const resetBtn = document.getElementById('resetBtn');
const cameraBtn = document.getElementById('cameraBtn');
const apiToggleBtn = document.getElementById('apiToggle');
const drawToggleBtn = document.getElementById('drawToggle');
const trailToggle = document.getElementById('trailToggle');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const quickResetBtn = document.getElementById('quickReset');
const quickCameraBtn = document.getElementById('quickCamera');
const quickModeBtn = document.getElementById('quickMode');

// State variables
let counter = 0;
let stage = null;
let currentAngle = 0;
let isCameraOn = true;
let useAPI = true;
let drawSkeleton = true;
let showMotionTrail = true;
let pose = null;
let camera = null;
let mediaStream = null;
let frameCount = 0;
let fps = 0;
let landmarks = null;
let poseResults = null;

// Motion trail data
const motionTrail = {
    wrist: [],
    elbow: [],
    maxPoints: 20,
    colors: ['#FF6B6B', '#4CC9F0', '#FFD166']
};

// Battery management
let battery = null;

// ==================== MEDIAPIPE INITIALIZATION ====================

async function initializeMediaPipe() {
    try {
        updateCameraStatus('Loading MediaPipe...', 'warning');
        updateAPIStatus('Waiting for MediaPipe...', 'warning');
        
        // Check if MediaPipe is already loaded
        if (typeof window.Pose === 'undefined') {
            // Load MediaPipe dynamically
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
            enableSegmentation: false,
            smoothSegmentation: true
        });
        
        // Set up results callback
        pose.onResults(onPoseResults);
        
        updateCameraStatus('MediaPipe Ready', 'success');
        return true;
        
    } catch (error) {
        console.error('MediaPipe initialization error:', error);
        updateCameraStatus('MediaPipe Failed', 'error');
        updateAPIStatus('MediaPipe Failed', 'error');
        return false;
    }
}

// Load external script
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ==================== POSE DETECTION RESULTS ====================

function onPoseResults(results) {
    poseResults = results;
    
    if (results.poseLandmarks) {
        landmarks = results.poseLandmarks;
        
        // Draw skeleton and overlays
        if (drawSkeleton) {
            drawSkeletonOverlay(results);
        }
        
        // Add points to motion trail
        if (showMotionTrail) {
            updateMotionTrail(results);
        }
        
        // Process landmarks
        if (useAPI) {
            sendLandmarksToAPI();
        } else {
            processLandmarksLocally();
        }
    } else {
        landmarks = null;
        clearOverlayCanvas();
        updateAPIStatus('No person detected', 'warning');
    }
    
    frameCount++;
}

// ==================== DRAWING FUNCTIONS ====================

function drawSkeletonOverlay(results) {
    clearOverlayCanvas();
    
    if (!results.poseLandmarks) return;
    
    const videoWidth = overlayCanvas.width;
    const videoHeight = overlayCanvas.height;
    
    // Draw connections (skeleton lines)
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = 'rgba(0, 219, 222, 0.8)';
    canvasCtx.lineCap = 'round';
    
    // Draw right arm skeleton
    const rightShoulder = results.poseLandmarks[12];
    const rightElbow = results.poseLandmarks[14];
    const rightWrist = results.poseLandmarks[16];
    
    // Draw shoulder to elbow
    if (rightShoulder && rightElbow) {
        drawLine(rightShoulder, rightElbow, videoWidth, videoHeight, '#4CC9F0', 4);
    }
    
    // Draw elbow to wrist
    if (rightElbow && rightWrist) {
        drawLine(rightElbow, rightWrist, videoWidth, videoHeight, '#FF6B6B', 4);
    }
    
    // Draw angle arc at elbow
    if (rightShoulder && rightElbow && rightWrist) {
        drawAngleArc(rightShoulder, rightElbow, rightWrist, videoWidth, videoHeight);
    }
    
    // Draw landmarks (joints)
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    [rightShoulder, rightElbow, rightWrist].forEach(landmark => {
        if (landmark) {
            const x = landmark.x * videoWidth;
            const y = landmark.y * videoHeight;
            
            // Draw outer circle
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 8, 0, 2 * Math.PI);
            canvasCtx.fillStyle = 'rgba(0, 219, 222, 0.3)';
            canvasCtx.fill();
            
            // Draw inner circle
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = landmark === rightElbow ? '#FF6B6B' : '#4CC9F0';
            canvasCtx.fill();
        }
    });
    
    // Draw motion trail if enabled
    if (showMotionTrail && motionTrail.wrist.length > 1) {
        drawMotionTrail(videoWidth, videoHeight);
    }
}

function drawLine(start, end, width, height, color, lineWidth) {
    const startX = start.x * width;
    const startY = start.y * height;
    const endX = end.x * width;
    const endY = end.y * height;
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    canvasCtx.lineTo(endX, endY);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = lineWidth;
    canvasCtx.stroke();
    
    // Add glow effect
    canvasCtx.shadowColor = color;
    canvasCtx.shadowBlur = 10;
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
}

function drawAngleArc(shoulder, elbow, wrist, width, height) {
    const elbowX = elbow.x * width;
    const elbowY = elbow.y * height;
    
    // Calculate angle
    const angle = calculateAngleBrowser(shoulder, elbow, wrist);
    const radius = 40;
    
    // Draw arc background
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, 0, 2 * Math.PI);
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    canvasCtx.lineWidth = 3;
    canvasCtx.stroke();
    
    // Draw angle arc
    const startAngle = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
    const endAngle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x);
    
    canvasCtx.beginPath();
    canvasCtx.arc(elbowX, elbowY, radius, startAngle, endAngle);
    canvasCtx.strokeStyle = angle < 90 ? '#FF6B6B' : '#4CC9F0';
    canvasCtx.lineWidth = 4;
    canvasCtx.stroke();
    
    // Draw angle text
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 16px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(`${Math.round(angle)}°`, elbowX, elbowY - radius - 10);
}

function drawMotionTrail(width, height) {
    // Draw wrist trail
    drawTrailPath(motionTrail.wrist, width, height, motionTrail.colors[0]);
    
    // Draw elbow trail
    drawTrailPath(motionTrail.elbow, width, height, motionTrail.colors[1]);
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
        const alpha = (i / points.length) * 0.8;
        canvasCtx.strokeStyle = color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        canvasCtx.lineWidth = 3 * (i / points.length);
        
        canvasCtx.lineTo(x, y);
        canvasCtx.stroke();
        canvasCtx.beginPath();
        canvasCtx.moveTo(x, y);
    }
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

function clearOverlayCanvas() {
    canvasCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// ==================== BROWSER-ONLY PROCESSING ====================

function processLandmarksLocally() {
    if (!landmarks) return;
    
    try {
        // Get right arm landmarks
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];
        
        if (!rightShoulder || !rightElbow || !rightWrist) {
            updateAPIStatus('Arm not detected', 'warning');
            return;
        }
        
        // Calculate angle in browser
        currentAngle = calculateAngleBrowser(rightShoulder, rightElbow, rightWrist);
        
        // Update UI
        updateAngleDisplay(currentAngle);
        updateStageIndicator(currentAngle);
        
        // Curl counter logic
        if (currentAngle > 160) {
            stage = "down";
            updateStageUI("DOWN", "#4cc9f0");
            updateStageProgress(1);
        }
        
        if (currentAngle < 40 && stage === "down") {
            stage = "up";
            counter++;
            updateCounter();
            updateStageUI("UP", "#ff6b6b");
            updateStageProgress(0);
            animateRep();
            triggerVibration();
        }
        
        updateAPIStatus('Browser Processing ✓', 'success');
        
    } catch (error) {
        console.error('Local processing error:', error);
        updateAPIStatus('Processing Error', 'error');
    }
}

function calculateAngleBrowser(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - 
                   Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    
    return angle;
}

// ==================== PYTHON API PROCESSING ====================

async function sendLandmarksToAPI() {
    if (!landmarks) return;
    
    try {
        const startTime = performance.now();
        
        // Get right arm landmarks
        const rightShoulder = landmarks[12];
        const rightElbow = landmarks[14];
        const rightWrist = landmarks[16];
        
        if (!rightShoulder || !rightElbow || !rightWrist) {
            updateAPIStatus('Arm not detected', 'warning');
            return;
        }
        
        // Prepare data for API
        const requestData = {
            shoulder: [rightShoulder.x, rightShoulder.y],
            elbow: [rightElbow.x, rightElbow.y],
            wrist: [rightWrist.x, rightWrist.y],
            counter: counter,
            stage: stage
        };
        
        updateAPIStatus('Sending to API...', 'warning');
        
        // Send to Python API
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const latency = performance.now() - startTime;
        updateLatency(latency);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update with API response
            currentAngle = data.angle || 0;
            counter = data.counter || counter;
            stage = data.stage || stage;
            
            // Update UI
            updateAngleDisplay(currentAngle);
            updateStageIndicator(currentAngle);
            updateCounter();
            
            if (stage === "up") {
                updateStageUI("UP", "#ff6b6b");
                updateStageProgress(0);
                animateRep();
                triggerVibration();
            } else if (stage === "down") {
                updateStageUI("DOWN", "#4cc9f0");
                updateStageProgress(1);
            } else {
                updateStageUI("Waiting...", "#a0a0c0");
                updateStageProgress(0.5);
            }
            
            updateAPIStatus('API Processing ✓', 'success');
        } else {
            updateAPIStatus('API Error', 'error');
            // Fallback to browser processing
            processLandmarksLocally();
        }
        
    } catch (error) {
        console.error('API error:', error);
        updateAPIStatus('API Failed', 'error');
        // Fallback to browser processing
        processLandmarksLocally();
    }
}

// ==================== CAMERA MANAGEMENT ====================

async function startCamera() {
    try {
        updateCameraStatus('Starting camera...', 'warning');
        
        // Initialize MediaPipe first
        const mediapipeReady = await initializeMediaPipe();
        if (!mediapipeReady) {
            throw new Error('MediaPipe failed to initialize');
        }
        
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
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = resolve;
        });
        
        // Set canvas dimensions to match video
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        
        // Start camera with MediaPipe
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (isCameraOn && pose) {
                    await pose.send({ image: videoElement });
                }
            },
            width: videoElement.videoWidth,
            height: videoElement.videoHeight
        });
        
        await camera.start();
        
        updateCameraStatus('Active ✓', 'success');
        updateProcessingMode();
        isCameraOn = true;
        
        // Start FPS counter
        startFPSCounter();
        
        return true;
        
    } catch (error) {
        console.error('Camera error:', error);
        updateCameraStatus('Error: Camera access denied', 'error');
        
        // Show error instructions
        showCameraError();
        return false;
    }
}

function toggleCamera() {
    if (isCameraOn) {
        // Stop camera
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (camera) {
            camera.stop();
        }
        videoElement.srcObject = null;
        
        isCameraOn = false;
        updateCameraStatus('Paused', 'warning');
        cameraBtn.querySelector('.btn-text').textContent = 'Start Camera';
        cameraBtn.querySelector('.btn-icon').textContent = '▶️';
        
        // Clear displays
        angleValueElement.textContent = '--°';
        angleDisplayElement.textContent = 'Angle: --°';
        updateStageUI('Paused', '#a0a0c0');
        clearOverlayCanvas();
        
    } else {
        // Start camera
        startCamera();
        cameraBtn.querySelector('.btn-text').textContent = 'Stop Camera';
        cameraBtn.querySelector('.btn-icon').textContent = '📷';
    }
}

// ==================== UI UPDATES ====================

function updateAngleDisplay(angle) {
    const roundedAngle = Math.round(angle);
    angleValueElement.textContent = `${roundedAngle}°`;
    angleDisplayElement.textContent = `Angle: ${roundedAngle}°`;
    
    // Update angle bar
    const anglePercentage = (angle / 180) * 100;
    angleFillElement.style.width = `${Math.min(anglePercentage, 100)}%`;
    
    // Update angle circle
    const circlePercentage = (angle / 180) * 360;
    angleCircleFillElement.style.background = 
        `conic-gradient(from 0deg, #00dbde 0%, #00dbde ${circlePercentage}deg, transparent ${circlePercentage}deg, transparent 360deg)`;
}

function updateStageIndicator(angle) {
    const stageIndicator = document.querySelector('.stage-indicator');
    if (!stageIndicator) return;
    
    if (angle > 160) {
        stageIndicator.style.background = 'rgba(76, 201, 240, 0.2)';
        stageIndicator.style.borderColor = '#4cc9f0';
    } else if (angle < 40) {
        stageIndicator.style.background = 'rgba(255, 107, 107, 0.2)';
        stageIndicator.style.borderColor = '#ff6b6b';
    } else {
        stageIndicator.style.background = 'rgba(255, 255, 255, 0.1)';
        stageIndicator.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }
}

function updateStageProgress(progress) {
    stageProgressElement.style.width = `${progress * 100}%`;
}

function updateCounter() {
    counterElement.textContent = counter;
    counterElement.classList.add('rep-animation');
    
    // Update rep badge
    const repBadge = document.getElementById('repBadge');
    if (repBadge) {
        repBadge.textContent = counter === 1 ? '1 REP' : `${counter} REPS`;
    }
}

function updateStageUI(text, color) {
    if (stageTextElement) {
        stageTextElement.textContent = text;
        stageTextElement.style.color = color;
    }
}

function animateRep() {
    counterElement.classList.add('glow-animation');
    setTimeout(() => {
        counterElement.classList.remove('glow-animation');
    }, 1000);
}

function updateCameraStatus(message, type = '') {
    if (cameraStatusElement) {
        cameraStatusElement.textContent = message;
        cameraStatusElement.className = 'status-value';
        if (type === 'error') cameraStatusElement.style.color = '#f44336';
        else if (type === 'warning') cameraStatusElement.style.color = '#FF9800';
        else if (type === 'success') cameraStatusElement.style.color = '#4CAF50';
        else cameraStatusElement.style.color = '#00dbde';
    }
}

function updateAPIStatus(message, type = '') {
    if (apiStatusElement) {
        apiStatusElement.textContent = `API: ${message}`;
        apiStatusElement.className = 'api-status';
        if (type === 'error') {
            apiStatusElement.style.background = 'rgba(244, 67, 54, 0.2)';
            apiStatusElement.style.color = '#f44336';
        } else if (type === 'warning') {
            apiStatusElement.style.background = 'rgba(255, 152, 0, 0.2)';
            apiStatusElement.style.color = '#FF9800';
        } else if (type === 'success') {
            apiStatusElement.style.background = 'rgba(76, 175, 80, 0.2)';
            apiStatusElement.style.color = '#4CAF50';
        } else {
            apiStatusElement.style.background = 'rgba(0, 219, 222, 0.2)';
            apiStatusElement.style.color = '#00dbde';
        }
    }
}

function updateLatency(latency) {
    if (apiLatencyElement) {
        const roundedLatency = Math.round(latency);
        apiLatencyElement.textContent = `${roundedLatency} ms`;
        
        // Color code based on latency
        if (roundedLatency > 200) {
            apiLatencyElement.style.color = '#f44336';
        } else if (roundedLatency > 100) {
            apiLatencyElement.style.color = '#FF9800';
        } else {
            apiLatencyElement.style.color = '#4CAF50';
        }
    }
}

function updateProcessingMode() {
    if (processingModeElement) {
        processingModeElement.textContent = useAPI ? 
            "Processing Mode: Python API" : 
            "Processing Mode: Browser Only";
    }
}

function toggleProcessingMode() {
    useAPI = !useAPI;
    
    if (useAPI) {
        updateAPIStatus('Using Python API', 'warning');
        apiToggleBtn.querySelector('.btn-text').textContent = 'Browser Mode';
        apiToggleBtn.querySelector('.btn-icon').textContent = '💻';
    } else {
        updateAPIStatus('Using Browser Processing', 'warning');
        apiToggleBtn.querySelector('.btn-text').textContent = 'API Mode';
        apiToggleBtn.querySelector('.btn-icon').textContent = '🌐';
    }
    
    updateProcessingMode();
}

function toggleSkeletonDrawing() {
    drawSkeleton = !drawSkeleton;
    
    if (drawSkeleton) {
        drawToggleBtn.querySelector('.btn-text').textContent = 'Hide Skeleton';
        drawToggleBtn.querySelector('.btn-icon').textContent = '👁️';
        updateAPIStatus('Skeleton visible', 'success');
    } else {
        drawToggleBtn.querySelector('.btn-text').textContent = 'Show Skeleton';
        drawToggleBtn.querySelector('.btn-icon').textContent = '🦴';
        clearOverlayCanvas();
        updateAPIStatus('Skeleton hidden', 'warning');
    }
}

// ==================== MOBILE FEATURES ====================

function triggerVibration() {
    if ('vibrate' in navigator && window.matchMedia('(max-width: 768px)').matches) {
        navigator.vibrate([50, 50, 50]);
        
        // Visual feedback
        const vibrationFeedback = document.getElementById('vibrationFeedback');
        vibrationFeedback.style.background = 'rgba(255, 107, 107, 0.3)';
        vibrationFeedback.style.opacity = '1';
        
        setTimeout(() => {
            vibrationFeedback.style.opacity = '0';
        }, 300);
    }
}

function setupBatteryMonitoring() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then(batt => {
            battery = batt;
            updateBatteryStatus();
            
            batt.addEventListener('levelchange', updateBatteryStatus);
            batt.addEventListener('chargingchange', updateBatteryStatus);
        });
    }
}

function updateBatteryStatus() {
    if (battery && batteryStatusElement) {
        const percentage = Math.round(battery.level * 100);
        const isCharging = battery.charging;
        
        batteryStatusElement.textContent = `${percentage}%${isCharging ? ' ⚡' : ''}`;
        
        // Color code based on battery level
        if (percentage <= 20) {
            batteryStatusElement.style.color = '#f44336';
        } else if (percentage <= 50) {
            batteryStatusElement.style.color = '#FF9800';
        } else {
            batteryStatusElement.style.color = '#4CAF50';
        }
    }
}

// ==================== FPS COUNTER ====================

function startFPSCounter() {
    setInterval(() => {
        fps = frameCount;
        frameCount = 0;
        if (fpsCounterElement) {
            fpsCounterElement.textContent = fps;
            
            // Color code based on FPS
            if (fps < 15) {
                fpsCounterElement.style.color = '#f44336';
            } else if (fps < 25) {
                fpsCounterElement.style.color = '#FF9800';
            } else {
                fpsCounterElement.style.color = '#4CAF50';
            }
        }
    }, 1000);
}

// ==================== FULLSCREEN SUPPORT ====================

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
        fullscreenBtn.textContent = '⛶';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            fullscreenBtn.textContent = '⛶';
        }
    }
}

// ==================== RESET FUNCTION ====================

function resetCounter() {
    counter = 0;
    stage = null;
    motionTrail.wrist = [];
    motionTrail.elbow = [];
    updateCounter();
    updateStageUI('Waiting...', '#a0a0c0');
    updateStageProgress(0.5);
    
    // Visual feedback
    counterElement.style.color = '#ff6b6b';
    counterElement.classList.add('rep-animation');
    setTimeout(() => {
        counterElement.style.color = '#00dbde';
        counterElement.classList.remove('rep-animation');
    }, 300);
    
    // Clear trail
    clearOverlayCanvas();
    
    // Vibration feedback on mobile
    if ('vibrate' in navigator) {
        navigator.vibrate([100]);
    }
}

// ==================== ERROR HANDLING ====================

function showCameraError() {
    const instructions = document.querySelector('.instructions');
    if (instructions) {
        instructions.innerHTML += `
            <div class="error-message">
                <h4>⚠️ Camera Access Required</h4>
                <p>To use this app, please:</p>
                <ol>
                    <li>Click the camera/lock icon in your browser's address bar</li>
                    <li>Allow camera access for this site</li>
                    <li>Refresh the page</li>
                </ol>
                <p>If problems persist, try:</p>
                <ul>
                    <li>Using Chrome or Edge browser</li>
                    <li>Checking if another app is using your camera</li>
                    <li>Ensuring camera permissions are enabled in system settings</li>
                </ul>
            </div>
        `;
    }
}

// ==================== TEST API CONNECTION ====================

async function testAPI() {
    try {
        updateAPIStatus('Testing API...', 'warning');
        const response = await fetch('/api/process', { method: 'GET' });
        
        if (response.ok) {
            const data = await response.json();
            console.log('API Test Response:', data);
            updateAPIStatus('API Connected ✓', 'success');
            return true;
        } else {
            updateAPIStatus('API Not Responding', 'error');
            return false;
        }
    } catch (error) {
        console.error('API test failed:', error);
        updateAPIStatus('API Connection Failed', 'error');
        return false;
    }
}

// ==================== EVENT LISTENERS ====================

resetBtn.addEventListener('click', resetCounter);
cameraBtn.addEventListener('click', toggleCamera);
apiToggleBtn.addEventListener('click', toggleProcessingMode);
drawToggleBtn.addEventListener('click', toggleSkeletonDrawing);
fullscreenBtn.addEventListener('click', toggleFullscreen);
trailToggle.addEventListener('change', (e) => {
    showMotionTrail = e.target.checked;
    if (!showMotionTrail) {
        motionTrail.wrist = [];
        motionTrail.elbow = [];
        clearOverlayCanvas();
    }
});

// Mobile quick actions
if (quickResetBtn) quickResetBtn.addEventListener('click', resetCounter);
if (quickCameraBtn) quickCameraBtn.addEventListener('click', toggleCamera);
if (quickModeBtn) quickModeBtn.addEventListener('click', toggleProcessingMode);

// Counter tap to reset (mobile)
counterElement.addEventListener('click', resetCounter);
counterElement.addEventListener('touchstart', (e) => {
    e.preventDefault();
    resetCounter();
});

// Double tap to toggle camera (mobile)
let lastTap = 0;
videoElement.addEventListener('touchend', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
        toggleCamera();
        e.preventDefault();
    }
    lastTap = currentTime;
});

// Pinch to zoom (mobile)
let initialPinchDistance = 0;
videoElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
    }
});

videoElement.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const zoomLevel = currentDistance / initialPinchDistance;
        videoElement.style.transform = `scaleX(-1) scale(${Math.min(Math.max(zoomLevel, 1), 3)})`;
    }
});

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing AI Pose Estimation...');
    
    // Setup battery monitoring
    setupBatteryMonitoring();
    
    // Test API connection first
    await testAPI();
    
    // Start camera
    await startCamera();
    
    // Update UI
    updateProcessingMode();
    
    // Setup motion trail toggle
    trailToggle.checked = showMotionTrail;
    
    console.log('Initialization complete');
    
    // Add mobile class for styling
    if (window.matchMedia('(max-width: 768px)').matches) {
        document.body.classList.add('mobile');
    }
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, pause processing
        if (camera && isCameraOn) {
            camera.stop();
        }
        updateCameraStatus('Tab Inactive', 'warning');
    } else if (isCameraOn && camera) {
        // Page is visible again, resume
        camera.start();
        updateCameraStatus('Active ✓', 'success');
    }
});

// Handle orientation change
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (overlayCanvas && videoElement) {
            overlayCanvas.width = videoElement.videoWidth;
            overlayCanvas.height = videoElement.videoHeight;
        }
    }, 300);
});

// Cleanup
window.addEventListener('beforeunload', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (camera) {
        camera.stop();
    }
    if (battery) {
        battery.removeEventListener('levelchange', updateBatteryStatus);
        battery.removeEventListener('chargingchange', updateBatteryStatus);
    }
});

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button
    if (window.matchMedia('(display-mode: browser)').matches) {
        showInstallPrompt();
    }
});

function showInstallPrompt() {
    const installBtn = document.createElement('button');
    installBtn.className = 'btn btn-api';
    installBtn.innerHTML = '<span class="btn-icon">📱</span><span class="btn-text">Install App</span>';
    installBtn.style.marginTop = '10px';
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            installBtn.remove();
        }
    });
    
    const controlsCard = document.querySelector('.controls-card .controls');
    if (controlsCard) {
        controlsCard.appendChild(installBtn);
    }
}