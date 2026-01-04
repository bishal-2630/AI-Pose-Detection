// DOM Elements
const videoElement = document.getElementById('webcam');
const counterElement = document.getElementById('counter');
const stageTextElement = document.getElementById('stageText');
const angleValueElement = document.getElementById('angleValue');
const angleDisplayElement = document.getElementById('angleDisplay');
const cameraStatusElement = document.getElementById('cameraStatus');
const apiStatusElement = document.getElementById('apiStatus');
const apiLatencyElement = document.getElementById('apiLatency');
const fpsCounterElement = document.getElementById('fpsCounter');
const processingModeElement = document.getElementById('processingMode');

const resetBtn = document.getElementById('resetBtn');
const cameraBtn = document.getElementById('cameraBtn');
const apiToggleBtn = document.getElementById('apiToggle');

// State variables
let counter = 0;
let stage = null;
let currentAngle = 0;
let isCameraOn = true;
let useAPI = true;
let mediaStream = null;
let processingInterval = null;
let frameCount = 0;
let fps = 0;
let lastFrameTime = 0;

// Initialize camera
async function initCamera() {
    try {
        updateCameraStatus('Requesting camera access...', 'warning');
        
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            }
        };
        
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = mediaStream;
        
        updateCameraStatus('Active ✓', 'success');
        updateAPIStatus('Ready', 'success');
        
        // Start processing frames
        startFrameProcessing();
        
        // Start FPS counter
        startFPSCounter();
        
    } catch (error) {
        console.error('Camera initialization error:', error);
        updateCameraStatus('Error: Camera access denied', 'error');
        showCameraError();
    }
}

// Start processing frames
function startFrameProcessing() {
    if (processingInterval) {
        clearInterval(processingInterval);
    }
    
    // Process frames at ~10 FPS for API mode
    const interval = useAPI ? 100 : 33; // 10 FPS for API, 30 FPS for local
    processingInterval = setInterval(processCurrentFrame, interval);
}

// Process current video frame
async function processCurrentFrame() {
    if (!isCameraOn || videoElement.readyState !== 4) return;
    
    const startTime = performance.now();
    frameCount++;
    
    try {
        if (useAPI) {
            // API Processing Mode
            await processFrameWithAPI();
        } else {
            // Local Processing Mode (if MediaPipe is available)
            await processFrameLocally();
        }
        
        // Calculate latency
        const latency = performance.now() - startTime;
        updateLatency(latency);
        
    } catch (error) {
        console.error('Frame processing error:', error);
        updateAPIStatus('Error', 'error');
    }
}

// Process frame using API
async function processFrameWithAPI() {
    try {
        // Capture frame from video
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw mirrored video frame
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 JPEG
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        
        // Prepare request data
        const requestData = {
            image: imageData,
            counter: counter,
            stage: stage
        };
        
        // Send to API
        updateAPIStatus('Processing...', 'warning');
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Update state with API response
            currentAngle = data.angle;
            counter = data.counter;
            stage = data.stage;
            
            // Update UI
            updateUI();
            updateAPIStatus('Success ✓', 'success');
        } else {
            updateAPIStatus('API Error', 'error');
        }
        
    } catch (error) {
        console.error('API processing error:', error);
        updateAPIStatus('Failed', 'error');
    }
}

// Local processing (fallback if MediaPipe is loaded)
async function processFrameLocally() {
    // This would use MediaPipe in the browser
    // For now, we'll just update the mode display
    processingModeElement.textContent = "Processing Mode: Local (Not implemented)";
}

// Update UI with current state
function updateUI() {
    // Update counter
    counterElement.textContent = counter;
    
    // Update angle display
    const roundedAngle = Math.round(currentAngle);
    angleValueElement.textContent = `${roundedAngle}°`;
    angleDisplayElement.textContent = `Angle: ${roundedAngle}°`;
    
    // Update stage
    if (stage) {
        stageTextElement.textContent = stage.toUpperCase();
        
        // Update stage indicator color
        const stageIndicator = document.querySelector('.stage-indicator');
        if (stage === 'up') {
            stageIndicator.style.background = 'rgba(255, 107, 107, 0.2)';
            stageIndicator.style.borderColor = '#ff6b6b';
            stageTextElement.style.color = '#ff6b6b';
        } else if (stage === 'down') {
            stageIndicator.style.background = 'rgba(0, 219, 222, 0.2)';
            stageIndicator.style.borderColor = '#00dbde';
            stageTextElement.style.color = '#00dbde';
        }
        
        // Animate rep counter when stage changes to 'up'
        if (stage === 'up') {
            counterElement.classList.add('rep-animation');
            setTimeout(() => {
                counterElement.classList.remove('rep-animation');
            }, 500);
        }
    } else {
        stageTextElement.textContent = 'Waiting...';
        stageTextElement.style.color = '#a0a0ff';
    }
}

// Update camera status display
function updateCameraStatus(message, type = '') {
    cameraStatusElement.textContent = message;
    cameraStatusElement.className = 'status-value';
    if (type) cameraStatusElement.classList.add(type);
}

// Update API status display
function updateAPIStatus(message, type = '') {
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
    }
}

// Update latency display
function updateLatency(latency) {
    apiLatencyElement.textContent = `${Math.round(latency)} ms`;
}

// FPS Counter
function startFPSCounter() {
    setInterval(() => {
        fps = frameCount;
        frameCount = 0;
        fpsCounterElement.textContent = fps;
    }, 1000);
}

// Toggle camera on/off
function toggleCamera() {
    isCameraOn = !isCameraOn;
    
    if (isCameraOn) {
        videoElement.play();
        updateCameraStatus('Active ✓', 'success');
        cameraBtn.innerHTML = '<span class="btn-icon">📷</span> Stop Camera';
        startFrameProcessing();
    } else {
        videoElement.pause();
        updateCameraStatus('Paused', 'warning');
        cameraBtn.innerHTML = '<span class="btn-icon">▶️</span> Start Camera';
        if (processingInterval) {
            clearInterval(processingInterval);
            processingInterval = null;
        }
    }
}

// Toggle between API and local processing
function toggleProcessingMode() {
    useAPI = !useAPI;
    
    if (useAPI) {
        processingModeElement.textContent = "Processing Mode: API";
        apiToggleBtn.innerHTML = '<span class="btn-icon">💻</span> Switch to Local';
    } else {
        processingModeElement.textContent = "Processing Mode: Local";
        apiToggleBtn.innerHTML = '<span class="btn-icon">🌐</span> Switch to API';
    }
    
    // Restart processing with new interval
    startFrameProcessing();
}

// Reset counter
function resetCounter() {
    counter = 0;
    stage = null;
    updateUI();
    
    // Visual feedback
    counterElement.style.color = '#ff6b6b';
    setTimeout(() => {
        counterElement.style.color = '#00dbde';
    }, 300);
}

// Show camera error instructions
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

// Event Listeners
resetBtn.addEventListener('click', resetCounter);
cameraBtn.addEventListener('click', toggleCamera);
apiToggleBtn.addEventListener('click', toggleProcessingMode);

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, pause processing
        if (processingInterval) {
            clearInterval(processingInterval);
            processingInterval = null;
        }
    } else if (isCameraOn) {
        // Page is visible again, resume processing
        startFrameProcessing();
    }
});

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Add animation classes to cards
    document.querySelectorAll('.stats-card, .controls-card, .info-card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('card-animation');
    });
    
    // Initialize camera
    initCamera();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (processingInterval) {
        clearInterval(processingInterval);
    }
});