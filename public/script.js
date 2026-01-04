// script.js - Complete working version
// Uses browser MediaPipe for pose detection + Python API for calculations

// DOM Elements
const videoElement = document.getElementById('webcam');
const counterElement = document.getElementById('counter');
const stageTextElement = document.getElementById('stageText');
const angleValueElement = document.getElementById('angleValue');
const angleDisplayElement = document.getElementById('angleDisplay');
const cameraStatusElement = document.getElementById('cameraStatus');
const processingModeElement = document.getElementById('processingMode');
const apiStatusElement = document.getElementById('apiStatus');
const apiLatencyElement = document.getElementById('apiLatency');
const fpsCounterElement = document.getElementById('fpsCounter');

const resetBtn = document.getElementById('resetBtn');
const cameraBtn = document.getElementById('cameraBtn');
const apiToggleBtn = document.getElementById('apiToggle');

// State variables
let counter = 0;
let stage = null;
let currentAngle = 0;
let isCameraOn = true;
let useAPI = true; // true = use Python API, false = browser-only
let pose = null;
let camera = null;
let mediaStream = null;
let processingInterval = null;
let frameCount = 0;
let fps = 0;
let landmarks = null;

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
            enableSegmentation: false
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
    if (results.poseLandmarks) {
        landmarks = results.poseLandmarks;
        
        if (useAPI) {
            // Send to Python API for processing
            sendLandmarksToAPI();
        } else {
            // Process locally in browser
            processLandmarksLocally();
        }
    } else {
        landmarks = null;
        updateAPIStatus('No person detected', 'warning');
    }
}

// ==================== BROWSER-ONLY PROCESSING ====================

function processLandmarksLocally() {
    if (!landmarks) return;
    
    try {
        // Get right arm landmarks
        const rightShoulder = landmarks[12]; // MediaPipe index for right shoulder
        const rightElbow = landmarks[14];    // MediaPipe index for right elbow
        const rightWrist = landmarks[16];    // MediaPipe index for right wrist
        
        // Calculate angle in browser
        currentAngle = calculateAngleBrowser(rightShoulder, rightElbow, rightWrist);
        
        // Update UI
        updateAngleDisplay(currentAngle);
        updateStageIndicator(currentAngle);
        
        // Curl counter logic
        if (currentAngle > 160) {
            stage = "down";
            updateStageUI("DOWN", "#4cc9f0");
        }
        
        if (currentAngle < 40 && stage === "down") {
            stage = "up";
            counter++;
            updateCounter();
            updateStageUI("UP", "#ff6b6b");
            animateRep();
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
                animateRep();
            } else if (stage === "down") {
                updateStageUI("DOWN", "#4cc9f0");
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
        
        // Start camera with MediaPipe
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (isCameraOn && pose) {
                    await pose.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
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
        cameraBtn.innerHTML = '<span class="btn-icon">▶️</span> Start Camera';
        
        // Clear displays
        angleValueElement.textContent = '--°';
        angleDisplayElement.textContent = 'Angle: --°';
        updateStageUI('Paused', '#a0a0c0');
        
    } else {
        // Start camera
        startCamera();
        cameraBtn.innerHTML = '<span class="btn-icon">📷</span> Stop Camera';
    }
}

// ==================== UI UPDATES ====================

function updateAngleDisplay(angle) {
    const roundedAngle = Math.round(angle);
    angleValueElement.textContent = `${roundedAngle}°`;
    angleDisplayElement.textContent = `Angle: ${roundedAngle}°`;
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

function updateCounter() {
    counterElement.textContent = counter;
}

function updateStageUI(text, color) {
    if (stageTextElement) {
        stageTextElement.textContent = text;
        stageTextElement.style.color = color;
    }
}

function animateRep() {
    counterElement.classList.add('rep-animation');
    setTimeout(() => {
        counterElement.classList.remove('rep-animation');
    }, 500);
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
        apiLatencyElement.textContent = `${Math.round(latency)} ms`;
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
        apiToggleBtn.innerHTML = '<span class="btn-icon">💻</span> Switch to Browser';
    } else {
        updateAPIStatus('Using Browser Processing', 'warning');
        apiToggleBtn.innerHTML = '<span class="btn-icon">🌐</span> Switch to API';
    }
    
    updateProcessingMode();
}

// ==================== FPS COUNTER ====================

function startFPSCounter() {
    setInterval(() => {
        fps = frameCount;
        frameCount = 0;
        if (fpsCounterElement) {
            fpsCounterElement.textContent = fps;
        }
    }, 1000);
}

// ==================== RESET FUNCTION ====================

function resetCounter() {
    counter = 0;
    stage = null;
    updateCounter();
    updateStageUI('Waiting...', '#a0a0c0');
    
    // Visual feedback
    counterElement.style.color = '#ff6b6b';
    setTimeout(() => {
        counterElement.style.color = '#00dbde';
    }, 300);
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

// ==================== INITIALIZATION ====================

window.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing AI Pose Estimation...');
    
    // Test API connection first
    await testAPI();
    
    // Start camera
    await startCamera();
    
    // Update UI
    updateProcessingMode();
    
    console.log('Initialization complete');
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, pause processing
        if (camera) {
            camera.stop();
        }
        updateCameraStatus('Tab Inactive', 'warning');
    } else if (isCameraOn && camera) {
        // Page is visible again, resume
        camera.start();
        updateCameraStatus('Active ✓', 'success');
    }
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