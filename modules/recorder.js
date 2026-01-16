/**
 * 退货拆包系统 - 视频录制模块（修复版 3.0.0）
 * 修复问题：录制时长自定义、视频质量、录制框正方形
 * 使用 WebRTC 和 MediaRecorder API
 */

// 🛠️ 全局防重复变量
let isProcessingVideo = false; // 防止重复处理视频
let downloadTriggered = false; // 防止重复下载

class VideoRecorder {
    constructor(config = {}) {
        // 默认配置
        this.defaultConfig = {
            duration: 30, // 🛠️ 修复：默认30秒，但会从主应用获取实际值
            quality: 'medium',
            autoStart: true,
            showPreview: true,
            saveLocation: '退货拆包视频/',
            namingPattern: 'order-shop-only',
            fileFormat: 'webm',
            autoSave: false, // 🛠️ 修复：改为false，由主应用控制下载
            maxDuration: 600 // 🛠️ 修复：最大录制时长增加到600秒（10分钟）
        };

        // 合并配置
        this.config = { ...this.defaultConfig, ...config };

        // 🛠️ 修复：当前录制时长（从主应用动态获取）
        this.currentRecordingDuration = this.config.duration;

        // 状态管理
        this.state = {
            isInitialized: false,
            isRecording: false,
            isPaused: false,
            hasCameraAccess: false,
            stream: null,
            mediaRecorder: null,
            recordedChunks: [],
            recordingStartTime: null,
            recordingTimer: null,
            recordingDuration: 0,
            currentOrderNumber: null,
            currentFileName: null,
            currentShopName: null,
            cameraDevices: [],
            autoStopTimer: null,
            playbackHintShown: false,
            manualPlayAttempted: false,
            timerInterval: null,
            recordingId: null,
            metadata: {} // 🛠️ 修复：存储录制元数据
        };

        // DOM元素引用
        this.elements = {
            videoContainer: null,
            videoElement: null,
            recordButton: null,
            pauseButton: null,
            stopButton: null,
            timerDisplay: null,
            statusDisplay: null,
            cameraSelect: null
        };

        // 事件回调
        this.callbacks = {
            onRecordingStart: null,
            onRecordingPause: null,
            onRecordingResume: null,
            onRecordingStop: null,
            onRecordingComplete: null,
            onError: null,
            onStatusChange: null,
            onFileSaved: null,
            onTimerUpdate: null // 🛠️ 修复：新增计时器更新回调
        };

        // 🛠️ 修复：增强视频质量设置（添加最高质量）
        this.qualitySettings = {
            low: { 
                videoBitsPerSecond: 500000,
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15 }
            },
            medium: { 
                videoBitsPerSecond: 1000000,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            high: { 
                videoBitsPerSecond: 2500000,
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            max: { // 🛠️ 新增：最高质量配置
                videoBitsPerSecond: 8000000,
                width: { ideal: 3840 },
                height: { ideal: 2160 },
                frameRate: { ideal: 30 }
            }
        };

        // 🛠️ 修复：摄像头约束配置（支持正方形比例）
        this.cameraConstraints = {
            low: {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 640 }, // 🛠️ 正方形
                    aspectRatio: { ideal: 1 }, // 🛠️ 强制1:1比例
                    frameRate: { ideal: 15 },
                    facingMode: 'environment'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            },
            medium: {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 1280 }, // 🛠️ 正方形
                    aspectRatio: { ideal: 1 },
                    frameRate: { ideal: 30 },
                    facingMode: 'environment'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            },
            high: {
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1920 }, // 🛠️ 正方形
                    aspectRatio: { ideal: 1 },
                    frameRate: { ideal: 30 },
                    facingMode: 'environment'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            },
            max: {
                video: {
                    width: { ideal: 3840 },
                    height: { ideal: 3840 }, // 🛠️ 正方形
                    aspectRatio: { ideal: 1 },
                    frameRate: { ideal: 30 },
                    facingMode: 'environment'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            }
        };

        // 添加摄像头样式
        this._addCameraStyles();
        
        console.log('✅ VideoRecorder 初始化完成，配置:', this.config);
    }

    /**
     * 🛠️ 修复：添加摄像头相关样式 - 改为正方形
     */
    _addCameraStyles() {
        if (document.getElementById('video-recorder-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'video-recorder-styles';
        style.textContent = `
            /* 🛠️ 修复：视频预览区域改为正方形 */
            .video-preview {
                position: relative;
                width: 400px;
                height: 400px;
                background: #000;
                border-radius: 8px;
                overflow: hidden;
                border: 2px solid #e1e5eb;
                transition: border-color 0.3s;
                margin: 0 auto; /* 居中显示 */
            }
            
            /* 🛠️ 修复：移动端适配 */
            @media (max-width: 768px) {
                .video-preview {
                    width: 300px;
                    height: 300px;
                }
            }
            
            .video-preview:hover {
                border-color: #4a6ee0;
            }
            
            .video-preview video {
                width: 100%;
                height: 100%;
                object-fit: cover; /* 🛠️ 保持正方形填充 */
                transform: scaleX(1);
                background: #000;
            }
            
            .camera-loading {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: #1a1a1a;
                color: white;
                z-index: 10;
            }
            
            .camera-loading i {
                font-size: 48px;
                margin-bottom: 15px;
                color: #3498db;
                animation: spin 2s linear infinite;
            }
            
            .camera-loading p {
                font-size: 16px;
                margin-bottom: 20px;
                text-align: center;
                max-width: 80%;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .camera-error {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                z-index: 20;
                padding: 20px;
            }
            
            .camera-error i {
                font-size: 48px;
                margin-bottom: 15px;
                color: #e74c3c;
            }
            
            .camera-error h4 {
                font-size: 20px;
                margin-bottom: 10px;
            }
            
            .camera-error p {
                font-size: 14px;
                margin-bottom: 20px;
                text-align: center;
                max-width: 300px;
                line-height: 1.5;
            }
            
            .playback-hint {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                z-index: 30;
            }
            
            .playback-hint-content {
                text-align: center;
                padding: 30px;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 10px;
                max-width: 300px;
            }
            
            .playback-hint i {
                font-size: 48px;
                margin-bottom: 15px;
                color: #2ecc71;
            }
            
            .playback-hint p {
                font-size: 14px;
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .video-playing {
                border-color: #2ecc71 !important;
            }
            
            .video-error {
                border-color: #e74c3c !important;
            }
            
            .video-recording {
                border-color: #e74c3c !important;
                animation: recording-border 1s infinite;
            }
            
            @keyframes recording-border {
                0%, 100% { border-color: #e74c3c; }
                50% { border-color: #ff6b6b; }
            }
            
            .recording-indicator {
                position: absolute;
                top: 15px;
                right: 15px;
                width: 12px;
                height: 12px;
                background: #e74c3c;
                border-radius: 50%;
                animation: pulse 1s infinite;
                z-index: 5;
                box-shadow: 0 0 10px rgba(231, 76, 60, 0.8);
            }
            
            @keyframes pulse {
                0% { 
                    transform: scale(1); 
                    opacity: 1;
                    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7);
                }
                50% { 
                    transform: scale(1.2); 
                    opacity: 0.7;
                }
                100% { 
                    transform: scale(1); 
                    opacity: 1;
                    box-shadow: 0 0 0 10px rgba(231, 76, 60, 0);
                }
            }
            
            .btn-camera-retry {
                background: #3498db;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            
            .btn-camera-retry:hover {
                background: #2980b9;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .btn-camera-retry:active {
                transform: translateY(0);
            }
            
            .recording-status {
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                text-align: center;
                transition: all 0.3s;
            }
            
            .status-ready {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .status-recording {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
                animation: blink 1s infinite;
            }
            
            .status-paused {
                background: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
            }
            
            .status-success {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }
            
            .status-error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 初始化录制模块
     */
    async init(elements = {}, callbacks = {}) {
        try {
            console.log('🔄 正在初始化视频录制模块...');

            this.callbacks = { ...this.callbacks, ...callbacks };
            await this._setupElementReferences(elements);

            if (!this._checkBrowserSupport()) {
                throw new Error('您的浏览器不支持视频录制功能，请使用 Chrome 或 Edge 浏览器');
            }

            this._showCameraLoading();
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this._initializeCamera();

            this.state.isInitialized = true;
            this._updateStatus('摄像头已就绪', 'ready');

            console.log('✅ 视频录制模块初始化完成');
            return { success: true };

        } catch (error) {
            console.error('❌ 录制模块初始化失败:', error);
            this._showCameraError(error.message);
            this._handleError(error, '初始化');
            return { success: false, error: error.message };
        }
    }

    /**
     * 设置元素引用
     */
    async _setupElementReferences(elements) {
        this.elements = { ...this.elements, ...elements };
        
        if (elements.videoContainer) {
            this.elements.videoContainer = elements.videoContainer;
        } else if (elements.videoPreview) {
            this.elements.videoContainer = elements.videoPreview;
        }
        
        await this._ensureVideoElement();
    }

    /**
     * 确保视频元素存在
     */
    async _ensureVideoElement() {
        if (!this.elements.videoContainer) {
            console.error('❌ 视频容器不存在');
            return false;
        }
        
        let videoElement = this.elements.videoContainer.querySelector('video');
        
        if (!videoElement) {
            console.log('📹 创建新的视频元素');
            videoElement = document.createElement('video');
            videoElement.id = 'cameraFeed';
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElement.style.transform = 'scaleX(1)';
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover'; // 🛠️ 确保正方形填充
            
            this.elements.videoContainer.appendChild(videoElement);
        }
        
        this.elements.videoElement = videoElement;
        console.log('✅ 视频元素引用已设置:', videoElement.id || 'unnamed-video');
        
        return true;
    }

    /**
     * 显示摄像头加载状态
     */
    _showCameraLoading() {
        const videoContainer = this.elements.videoContainer;
        if (!videoContainer) return;

        const existing = videoContainer.querySelector('.camera-loading, .camera-error, .playback-hint');
        if (existing) existing.remove();

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'camera-loading';
        loadingDiv.innerHTML = `
            <i class="fas fa-spinner"></i>
            <p>正在连接摄像头...</p>
            <p>请确保摄像头已连接并授予访问权限</p>
        `;

        videoContainer.appendChild(loadingDiv);
    }

    /**
     * 显示摄像头错误
     */
    _showCameraError(message) {
        const videoContainer = this.elements.videoContainer;
        if (!videoContainer) return;

        const existing = videoContainer.querySelector('.camera-loading, .camera-error, .playback-hint');
        if (existing) existing.remove();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'camera-error';
        errorDiv.innerHTML = `
            <i class="fas fa-video-slash"></i>
            <h4>摄像头连接失败</h4>
            <p>${message}</p>
            <button class="btn-camera-retry">
                <i class="fas fa-redo"></i> 重新连接
            </button>
        `;

        errorDiv.querySelector('.btn-camera-retry').addEventListener('click', () => {
            this._initializeCamera();
        });

        videoContainer.appendChild(errorDiv);
        videoContainer.classList.add('video-error');
        videoContainer.classList.remove('video-playing', 'video-recording');
    }

    /**
     * 显示播放提示
     */
    _showPlaybackHint() {
        if (this.state.playbackHintShown) {
            console.log('播放提示已显示过，跳过重复显示');
            return;
        }

        const videoContainer = this.elements.videoContainer;
        if (!videoContainer) return;

        const existingHint = videoContainer.querySelector('.playback-hint');
        if (existingHint) {
            console.log('播放提示已存在，跳过重复创建');
            return;
        }

        const existing = videoContainer.querySelector('.camera-loading, .camera-error');
        if (existing) existing.remove();

        const hintDiv = document.createElement('div');
        hintDiv.className = 'playback-hint';
        hintDiv.innerHTML = `
            <div class="playback-hint-content">
                <i class="fas fa-play-circle"></i>
                <p>摄像头需要手动启动预览</p>
                <p style="font-size: 12px; opacity: 0.9;">点击下方按钮开始摄像头预览</p>
                <button class="btn-camera-retry" id="manualPlayButton">
                    <i class="fas fa-play"></i> 开始预览
                </button>
            </div>
        `;

        const playButton = hintDiv.querySelector('#manualPlayButton');
        const handleManualPlay = async () => {
            try {
                console.log('用户点击手动播放按钮');
                
                hintDiv.remove();
                this.state.playbackHintShown = true;
                this.state.manualPlayAttempted = true;
                
                if (this.elements.videoElement) {
                    if (!this.elements.videoElement.srcObject) {
                        console.error('视频流未设置');
                        this._showCameraError('视频流异常，请重新连接');
                        return;
                    }
                    
                    await this.elements.videoElement.play();
                    console.log('手动播放成功');
                    
                    videoContainer.classList.add('video-playing');
                    videoContainer.classList.remove('video-error');
                    this._updateStatus('摄像头预览已启动', 'success');
                    
                    playButton.removeEventListener('click', handleManualPlay);
                } else {
                    console.error('视频元素不存在');
                    this._showCameraError('视频元素异常，请刷新页面');
                }
            } catch (error) {
                console.error('手动播放失败:', error);
                this._showCameraError('播放失败，请刷新页面重试');
                this._handleError(error, '手动播放');
                
                playButton.removeEventListener('click', handleManualPlay);
            }
        };

        playButton.addEventListener('click', handleManualPlay, { once: true });
        videoContainer.appendChild(hintDiv);
        this.state.playbackHintShown = true;
        console.log('显示播放提示');
    }

    /**
     * 检查浏览器支持
     */
    _checkBrowserSupport() {
        const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const hasMediaRecorder = !!window.MediaRecorder;
        
        if (!hasMediaDevices) {
            this._showCameraError('浏览器不支持摄像头访问，请使用 Chrome、Edge 或 Firefox 浏览器');
            return false;
        }
        
        if (!hasMediaRecorder) {
            this._showCameraError('浏览器不支持视频录制功能，请使用 Chrome 浏览器');
            return false;
        }
        
        return true;
    }

    /**
     * 🛠️ 修复：初始化摄像头 - 应用质量配置和正方形比例
     */
    async _initializeCamera() {
        try {
            console.log('📹 正在初始化摄像头...');
            this._showCameraLoading();

            if (this.state.stream) {
                this._stopStream();
            }

            this.state.playbackHintShown = false;
            this.state.manualPlayAttempted = false;

            if (!this.elements.videoElement) {
                await this._ensureVideoElement();
            }

            // 🛠️ 修复：获取当前质量配置
            const quality = this.config.quality || 'medium';
            const constraints = this.cameraConstraints[quality] || this.cameraConstraints.medium;
            
            console.log(`📹 摄像头质量设置: ${quality}`, constraints);

            this.state.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.state.hasCameraAccess = true;
            
            console.log('✅ 摄像头权限获取成功，视频流已连接');

            if (this.elements.videoElement && this.elements.videoContainer) {
                const videoContainer = this.elements.videoContainer;
                
                const loading = videoContainer.querySelector('.camera-loading');
                if (loading) loading.remove();

                this.elements.videoElement.srcObject = this.state.stream;
                
                await new Promise((resolve) => {
                    const onLoaded = () => {
                        console.log('视频元数据加载完成');
                        this.elements.videoElement.onloadedmetadata = null;
                        resolve();
                    };
                    
                    this.elements.videoElement.onloadedmetadata = onLoaded;
                    
                    setTimeout(() => {
                        console.log('视频加载超时，强制继续');
                        resolve();
                    }, 3000);
                });

                try {
                    await this.elements.videoElement.play();
                    console.log('✅ 视频自动播放成功');
                    
                    videoContainer.classList.add('video-playing');
                    videoContainer.classList.remove('video-error');
                    
                    this._updateStatus('摄像头已连接', 'success');
                    this._updateUIState();
                    return true;
                    
                } catch (playError) {
                    console.warn('⚠️ 视频自动播放被阻止:', playError);
                    
                    if (this.state.manualPlayAttempted) {
                        console.log('已尝试过手动播放，显示错误');
                        this._showCameraError('播放失败，请刷新页面或检查浏览器设置');
                        return false;
                    }
                    
                    if (!this.state.playbackHintShown) {
                        this._showPlaybackHint();
                    }
                    
                    return true;
                }
            } else {
                console.error('❌ 视频元素或容器不存在');
                this._showCameraError('视频元素未正确初始化');
                return false;
            }

        } catch (error) {
            console.error('❌ 摄像头初始化失败:', error);
            
            let errorMessage = '摄像头连接失败';
            if (error.name === 'NotAllowedError') {
                errorMessage = '摄像头访问被拒绝，请在浏览器设置中允许摄像头权限';
            } else if (error.name === 'NotFoundError') {
                errorMessage = '未找到摄像头设备，请确保摄像头已连接';
            } else if (error.name === 'NotReadableError') {
                errorMessage = '摄像头被其他程序占用，请关闭其他使用摄像头的程序';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage = '无法满足摄像头配置要求，尝试降低质量设置';
            } else if (error.name === 'TypeError') {
                errorMessage = '摄像头初始化错误，请刷新页面重试';
            }
            
            this._showCameraError(errorMessage);
            this.state.hasCameraAccess = false;
            return false;
        }
    }

    /**
     * 🛠️ 修复：开始录制 - 接收并应用时长配置
     */
    startRecording(orderNumber = null, metadata = {}) {
        if (!this.state.hasCameraAccess || !this.state.stream) {
            console.error('❌ 摄像头未就绪，无法开始录制');
            this._updateStatus('摄像头未就绪', 'error');
            return false;
        }

        if (this.state.isRecording) {
            console.warn('⚠️ 已经开始录制，不能重复开始');
            return false;
        }

        try {
            // 🛠️ 修复：从metadata获取录制时长，默认为配置值
            this.currentRecordingDuration = metadata.duration || this.config.duration;
            console.log(`⏱️ 设置录制时长: ${this.currentRecordingDuration}秒`);
            
            this.state.currentOrderNumber = orderNumber || this._generateOrderNumber();
            this.state.currentShopName = metadata.shopName || '未知店铺';
            this.state.currentFileName = this._generateFileName();
            this.state.recordingStartTime = new Date();
            this.state.recordingDuration = 0;
            this.state.recordingId = Date.now();
            this.state.metadata = metadata; // 🛠️ 保存元数据

            const videoTrack = this.state.stream.getVideoTracks()[0];
            const videoSettings = videoTrack ? videoTrack.getSettings() : {};

            // 🛠️ 修复：视频格式选择，优先选择MP4
            const mimeTypes = [
                'video/mp4;codecs=h264,aac', // 优先MP4格式
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm;codecs=h264,opus',
                'video/webm',
                'video/mp4'
            ];
            
            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }
            
            if (!selectedMimeType) {
                throw new Error('浏览器不支持任何视频格式');
            }

            // 🛠️ 修复：应用质量设置
            const quality = metadata.quality || this.config.quality || 'medium';
            const qualityConfig = this.qualitySettings[quality] || this.qualitySettings.medium;
            const options = {
                mimeType: selectedMimeType,
                videoBitsPerSecond: qualityConfig.videoBitsPerSecond,
                audioBitsPerSecond: 128000
            };

            console.log('🎥 创建MediaRecorder，选项:', options);
            this.state.mediaRecorder = new MediaRecorder(this.state.stream, options);
            this.state.recordedChunks = [];

            this.state.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.state.recordedChunks.push(event.data);
                    console.log(`📦 收到视频数据块: ${event.data.size} bytes`);
                }
            };

            this.state.mediaRecorder.onstop = () => {
                console.log('🛑 MediaRecorder onstop 事件触发，准备保存录制');
                setTimeout(() => {
                    this._saveRecording();
                }, 100);
            };
            
            this.state.mediaRecorder.onerror = (event) => {
                console.error('❌ MediaRecorder 错误:', event.error);
                this._handleError(event.error, 'MediaRecorder');
            };

            this.state.mediaRecorder.start(1000);
            this.state.isRecording = true;
            this.state.isPaused = false;

            console.log('✅ MediaRecorder开始录制，状态:', this.state.mediaRecorder.state);

            this._startRecordingTimer();
            this._startAutoStopTimer();
            this._addRecordingIndicator();
            
            const videoContainer = this.elements.videoContainer;
            if (videoContainer) {
                videoContainer.classList.add('video-recording');
                videoContainer.classList.remove('video-playing');
            }

            this._updateUIState();

            if (this.callbacks.onRecordingStart) {
                this.callbacks.onRecordingStart({
                    orderNumber: this.state.currentOrderNumber,
                    shopName: this.state.currentShopName,
                    fileName: this.state.currentFileName,
                    startTime: this.state.recordingStartTime,
                    metadata: {
                        ...metadata,
                        videoSettings: videoSettings,
                        quality: quality,
                        duration: this.currentRecordingDuration, // 🛠️ 传递时长
                        mimeType: selectedMimeType
                    }
                });
            }

            this._updateStatus(`录制中: ${this.state.currentFileName} (${this.currentRecordingDuration}秒)`, 'recording');
            console.log(`🎬 开始录制: ${this.state.currentFileName}, 格式: ${selectedMimeType}, 时长: ${this.currentRecordingDuration}秒`);

            return true;

        } catch (error) {
            console.error('❌ 开始录制失败:', error);
            this._handleError(error, '开始录制');
            return false;
        }
    }

    /**
     * 🛠️ 修复：启动自动停止计时器 - 使用动态时长
     */
    _startAutoStopTimer() {
        if (this.state.autoStopTimer) {
            clearTimeout(this.state.autoStopTimer);
        }
        
        // 🛠️ 修复：使用动态录制时长
        const duration = this.currentRecordingDuration || this.config.duration;
        console.log(`⏰ 设置自动停止计时器: ${duration}秒后停止`);
        
        if (duration > 0) {
            this.state.autoStopTimer = setTimeout(() => {
                if (this.state.isRecording) {
                    console.log('⏰ 录制时长达到上限，自动停止');
                    this.stopRecording();
                }
            }, duration * 1000);
        }
    }

    /**
     * 添加录制指示器
     */
    _addRecordingIndicator() {
        const videoContainer = this.elements.videoContainer;
        if (!videoContainer) return;

        const existing = videoContainer.querySelector('.recording-indicator');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.className = 'recording-indicator';
        indicator.title = '正在录制...';
        videoContainer.appendChild(indicator);
    }

    /**
     * 启动录制计时器
     */
    _startRecordingTimer() {
        console.log('⏱️ 启动录制计时器');
        
        this._stopRecordingTimer();
        
        this.state.recordingDuration = 0;
        this._updateTimerDisplay();
        
        this.state.timerInterval = setInterval(() => {
            if (this.state.isRecording && !this.state.isPaused) {
                this.state.recordingDuration++;
                console.log(`⏱️ 计时器更新: ${this.state.recordingDuration}秒`);
                this._updateTimerDisplay();
                
                // 🛠️ 修复：通知主应用计时器更新
                if (this.callbacks.onTimerUpdate) {
                    this.callbacks.onTimerUpdate(this.state.recordingDuration);
                }
                
                if (this.state.recordingDuration >= this.config.maxDuration) {
                    console.log('⏰ 达到最大录制时长，自动停止');
                    this.stopRecording();
                }
            }
        }, 1000);

        console.log('✅ 录制计时器已启动，interval ID:', this.state.timerInterval);
    }

    /**
     * 停止录制计时器
     */
    _stopRecordingTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
            console.log('⏱️ 录制计时器已停止');
        }
        
        if (this.state.autoStopTimer) {
            clearTimeout(this.state.autoStopTimer);
            this.state.autoStopTimer = null;
        }
        
        if (this.elements.timerDisplay) {
            this.elements.timerDisplay.textContent = '00:00';
        }
    }

    /**
     * 更新计时器显示
     */
    _updateTimerDisplay() {
        if (!this.elements.timerDisplay) {
            console.warn('⚠️ 未找到计时器显示元素');
            return;
        }

        const minutes = Math.floor(this.state.recordingDuration / 60);
        const seconds = this.state.recordingDuration % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (this.elements.timerDisplay.textContent !== timeString) {
            this.elements.timerDisplay.textContent = timeString;
            console.log('⏱️ 更新计时器显示:', timeString);
        }
    }

    /**
     * 生成订单号
     */
    _generateOrderNumber() {
        const timestamp = new Date();
        const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = timestamp.toTimeString().slice(0, 8).replace(/:/g, '');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `RETURN_${dateStr}_${timeStr}_${random}`;
    }

    /**
     * 生成文件名
     */
    _generateFileName() {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .slice(0, 19);
        
        const orderNum = this.state.currentOrderNumber || 'UNKNOWN';
        const shopName = this.state.currentShopName || '未知店铺';
        
        const cleanShopName = (name) => {
            if (!name) return '未知店铺';
            return name
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '_')
                .replace(/[^\w\u4e00-\u9fa5_-]/g, '')
                .trim()
                .substring(0, 50);
        };
        
        const cleanName = cleanShopName(shopName);
        
        let fileName;
        if (this.config.namingPattern === 'order-shop-only') {
            fileName = `${orderNum}_${cleanName}.mp4`; // 🛠️ 固定为MP4格式
        } else {
            fileName = `${orderNum}_${cleanName}_${timestamp}.mp4`;
        }
        
        if (this.config.saveLocation) {
            const result = `${this.config.saveLocation}${fileName}`;
            console.log('📄 生成的视频文件名:', result);
            return result;
        }
        
        console.log('📄 生成的视频文件名:', fileName);
        return fileName;
    }

    /**
     * 暂停/继续录制
     */
    togglePause() {
        if (!this.state.isRecording || !this.state.mediaRecorder) {
            console.warn('⚠️ 没有正在进行的录制');
            return;
        }

        try {
            if (this.state.isPaused) {
                this.state.mediaRecorder.resume();
                this.state.isPaused = false;
                
                if (!this.state.timerInterval) {
                    this._startRecordingTimer();
                }
                
                this._updateStatus('录制已继续', 'recording');
                
                if (this.callbacks.onRecordingResume) {
                    this.callbacks.onRecordingResume({
                        orderNumber: this.state.currentOrderNumber,
                        duration: this.state.recordingDuration
                    });
                }
            } else {
                this.state.mediaRecorder.pause();
                this.state.isPaused = true;
                
                this._stopRecordingTimer();
                
                this._updateStatus('录制已暂停', 'paused');
                
                if (this.callbacks.onRecordingPause) {
                    this.callbacks.onRecordingPause({
                        orderNumber: this.state.currentOrderNumber,
                        duration: this.state.recordingDuration
                    });
                }
            }

            this._updateUIState();

        } catch (error) {
            console.error('❌ 暂停/继续录制失败:', error);
            this._handleError(error, '暂停/继续录制');
        }
    }

    /**
     * 停止录制
     */
    stopRecording() {
        if (!this.state.isRecording || !this.state.mediaRecorder) {
            console.warn('⚠️ 没有正在进行的录制，无法停止');
            return null;
        }

        try {
            console.log('🛑 正在停止录制...');
            
            this._stopRecordingTimer();
            
            if (this.state.mediaRecorder.state !== 'inactive') {
                this.state.mediaRecorder.stop();
                console.log('✅ MediaRecorder已发送停止信号，状态:', this.state.mediaRecorder.state);
            }
            
            this.state.isRecording = false;
            this.state.isPaused = false;

            this._updateUIState();

            const videoContainer = this.elements.videoContainer;
            if (videoContainer) {
                const indicator = videoContainer.querySelector('.recording-indicator');
                if (indicator) indicator.remove();
                videoContainer.classList.remove('video-recording');
                videoContainer.classList.add('video-playing');
            }

            const recordingInfo = {
                orderNumber: this.state.currentOrderNumber,
                shopName: this.state.currentShopName,
                fileName: this.state.currentFileName,
                startTime: this.state.recordingStartTime,
                endTime: new Date(),
                duration: this.state.recordingDuration,
                status: 'completed',
                recordingId: this.state.recordingId,
                metadata: this.state.metadata // 🛠️ 包含元数据
            };

            if (this.callbacks.onRecordingStop) {
                this.callbacks.onRecordingStop(recordingInfo);
            }

            this._updateStatus(`录制完成: ${this.state.currentFileName} (${this.state.recordingDuration}秒)`, 'success');
            console.log('✅ 录制停止:', recordingInfo);

            return recordingInfo;

        } catch (error) {
            console.error('❌ 停止录制失败:', error);
            this._handleError(error, '停止录制');
            return null;
        }
    }

    /**
     * 🛠️ 修复：保存录制视频 - 移除了自动下载，由主应用控制
     */
    _saveRecording() {
        console.log('💾 开始保存录制视频，数据块数量:', this.state.recordedChunks.length);
        
        // 🛠️ 防重复检查
        if (isProcessingVideo) {
            console.log('⚠️ 已有视频处理中，跳过重复保存');
            return null;
        }
        
        isProcessingVideo = true;
        
        try {
            if (this.state.recordedChunks.length === 0) {
                console.warn('⚠️ 没有录制数据可保存');
                this._updateStatus('录制数据为空', 'error');
                return null;
            }

            const mimeType = this.state.mediaRecorder?.mimeType || 'video/mp4';
            console.log('💾 保存录制，MIME类型:', mimeType);
            
            const blob = new Blob(this.state.recordedChunks, { type: mimeType });
            
            if (blob.size === 0) {
                console.warn('⚠️ 录制的视频文件为空');
                this._updateStatus('视频文件为空，未保存', 'error');
                return null;
            }
            
            console.log('✅ 视频Blob创建成功，大小:', blob.size, 'bytes');
            
            const formatFileSize = window.ReturnUnpackSystem?.modules?.utils?.formatFileSize || 
                                 function(bytes) {
                                     if (bytes === 0) return '0 B';
                                     const k = 1024;
                                     const sizes = ['B', 'KB', 'MB', 'GB'];
                                     const i = Math.floor(Math.log(bytes) / Math.log(k));
                                     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                 };
            
            const fileName = this.state.currentFileName || `${this.state.currentOrderNumber}_${this.state.currentShopName || '未知店铺'}.mp4`;
            const cleanFileName = fileName.includes('/') ? fileName.split('/').pop() : fileName;
            
            let recordingInfo = {
                orderNumber: this.state.currentOrderNumber,
                shopName: this.state.currentShopName,
                fileName: cleanFileName,
                fileSize: blob.size,
                fileSizeFormatted: formatFileSize(blob.size),
                duration: this.state.recordingDuration,
                recordedAt: new Date(),
                mimeType: mimeType,
                blob: blob,
                recordingId: this.state.recordingId,
                metadata: this.state.metadata // 🛠️ 包含元数据
            };
            
            // 🛠️ 修复：移除了自动下载逻辑，由主应用控制
            console.log('💾 视频数据准备完成，等待主应用保存');
            this._updateStatus('视频录制完成', 'success');
            
            if (this.callbacks.onRecordingComplete) {
                this.callbacks.onRecordingComplete(recordingInfo);
            }
            
            // 🛠️ 修复：通知主应用视频录制完成
            if (window.ReturnUnpackSystem && window.ReturnUnpackSystem.handleVideoRecorded) {
                window.ReturnUnpackSystem.handleVideoRecorded(recordingInfo);
            } else {
                console.warn('⚠️ 主应用未定义 handleVideoRecorded 函数');
            }
            
            // 重置录制数据
            this.state.recordedChunks = [];
            this.state.currentOrderNumber = null;
            this.state.currentShopName = null;
            this.state.currentFileName = null;
            this.state.recordingDuration = 0;
            this.state.recordingStartTime = null;
            this.state.recordingId = null;
            this.state.metadata = {};
            
            console.log('✅ 视频保存处理完成:', recordingInfo);
            return recordingInfo;
            
        } catch (error) {
            console.error('❌ 保存视频失败:', error);
            this._handleError(error, '保存视频');
            return null;
        } finally {
            // 重置处理标志
            setTimeout(() => {
                isProcessingVideo = false;
                downloadTriggered = false;
            }, 1000);
        }
    }

    /**
     * 保存视频信息到数据库
     */
    async _saveVideoToDatabase(videoInfo) {
        try {
            if (!window.ReturnUnpackSystem || !window.ReturnUnpackSystem.database) {
                console.warn('⚠️ 数据库模块未找到，跳过视频信息保存');
                return false;
            }
            
            if (!videoInfo.orderNumber) {
                console.warn('⚠️ 没有订单号，无法保存视频信息');
                return false;
            }
            
            const updateData = {
                videoFileName: videoInfo.cleanFileName || videoInfo.fileName,
                videoRecorded: true,
                videoRecordedAt: videoInfo.recordedAt.toISOString(),
                videoDuration: videoInfo.duration,
                videoSize: videoInfo.fileSize,
                videoMimeType: videoInfo.mimeType,
                lastUpdated: new Date().toISOString()
            };
            
            console.log('💾 正在保存视频信息到数据库:', updateData);
            
            const success = await window.ReturnUnpackSystem.database.updateOrder(
                videoInfo.orderNumber,
                updateData
            );
            
            if (success) {
                console.log('✅ 视频信息已成功保存到数据库');
                return true;
            } else {
                console.warn('⚠️ 数据库更新返回失败');
                return false;
            }
            
        } catch (dbError) {
            console.error('❌ 保存视频信息到数据库失败:', dbError);
            return false;
        }
    }

    /**
     * 拍照功能
     */
    capturePhoto() {
        if (!this.state.hasCameraAccess || !this.state.stream) {
            console.error('❌ 摄像头未就绪，无法拍照');
            return null;
        }

        try {
            const canvas = document.createElement('canvas');
            const video = this.elements.videoElement;
            const context = canvas.getContext('2d');
            
            // 🛠️ 修复：保持正方形比例
            const size = Math.min(video.videoWidth || 1280, video.videoHeight || 720);
            canvas.width = size;
            canvas.height = size;
            
            // 居中裁剪为正方形
            const offsetX = ((video.videoWidth || 1280) - size) / 2;
            const offsetY = ((video.videoHeight || 720) - size) / 2;
            context.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);
            
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .replace('T', '_')
                .slice(0, 19);
            
            const fileName = `photo_${timestamp}.png`;
            const dataUrl = canvas.toDataURL('image/png');
            
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            a.click();
            
            const photoInfo = {
                fileName: fileName,
                timestamp: new Date(),
                width: canvas.width,
                height: canvas.height,
                dataUrl: dataUrl
            };
            
            console.log('📸 拍照完成（正方形）:', photoInfo);
            this._updateStatus(`拍照完成: ${fileName}`, 'success');
            
            return photoInfo;
            
        } catch (error) {
            console.error('❌ 拍照失败:', error);
            this._handleError(error, '拍照');
            return null;
        }
    }

    /**
     * 更新UI状态
     */
    _updateUIState() {
        if (this.elements.recordButton) {
            if (this.state.isRecording) {
                if (this.state.isPaused) {
                    this.elements.recordButton.innerHTML = '<i class="fas fa-play"></i> 继续录制';
                    this.elements.recordButton.classList.remove('btn-warning');
                    this.elements.recordButton.classList.add('btn-success');
                } else {
                    this.elements.recordButton.innerHTML = '<i class="fas fa-pause"></i> 暂停录制';
                    this.elements.recordButton.classList.remove('btn-success');
                    this.elements.recordButton.classList.add('btn-warning');
                }
                this.elements.recordButton.disabled = false;
            } else {
                this.elements.recordButton.innerHTML = '<i class="fas fa-circle"></i> 开始录制';
                this.elements.recordButton.disabled = !this.state.hasCameraAccess;
                this.elements.recordButton.classList.remove('btn-warning', 'btn-success');
                this.elements.recordButton.classList.add('btn-primary');
            }
        }

        if (this.elements.pauseButton) {
            this.elements.pauseButton.disabled = !this.state.isRecording;
            if (this.state.isRecording) {
                this.elements.pauseButton.innerHTML = this.state.isPaused ? 
                    '<i class="fas fa-play"></i> 继续' : 
                    '<i class="fas fa-pause"></i> 暂停';
            }
        }

        if (this.elements.stopButton) {
            this.elements.stopButton.disabled = !this.state.isRecording;
        }
    }

    /**
     * 更新状态显示
     */
    _updateStatus(message, type = 'info') {
        if (this.elements.statusDisplay) {
            this.elements.statusDisplay.textContent = message;
            
            const statusClass = `status-${type}`;
            this.elements.statusDisplay.className = `recording-status ${statusClass}`;
        }

        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange({ message, type, timestamp: new Date() });
        }
    }

    /**
     * 处理错误
     */
    _handleError(error, context = '') {
        console.error(`❌ 录制模块错误 [${context}]:`, error);
        
        let errorMessage = error.message;
        if (error.name === 'NotReadableError') {
            errorMessage = '摄像头被占用，请关闭其他使用摄像头的程序';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = '摄像头配置不支持，请尝试降低视频质量';
        }
        
        this._updateStatus(`错误: ${errorMessage}`, 'error');
        
        if (this.callbacks.onError) {
            this.callbacks.onError({ 
                error: error, 
                context: context,
                message: errorMessage,
                timestamp: new Date()
            });
        }
    }

    /**
     * 停止视频流
     */
    _stopStream() {
        if (this.state.stream) {
            this.state.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.state.stream = null;
            this.state.hasCameraAccess = false;
            
            this.state.playbackHintShown = false;
            this.state.manualPlayAttempted = false;
            
            if (this.elements.videoElement) {
                this.elements.videoElement.srcObject = null;
            }
        }
    }

    /**
     * 🛠️ 修复：切换摄像头 - 应用正方形比例
     */
    async switchCamera(deviceId) {
        try {
            this._updateStatus('正在切换摄像头...', 'info');
            
            const quality = this.config.quality || 'medium';
            const constraintsTemplate = this.cameraConstraints[quality] || this.cameraConstraints.medium;
            
            // 🛠️ 修复：应用设备ID和正方形比例
            const constraints = {
                video: {
                    ...constraintsTemplate.video,
                    deviceId: { exact: deviceId }
                },
                audio: constraintsTemplate.audio
            };
            
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this._stopStream();
            
            this.state.stream = newStream;
            this.state.hasCameraAccess = true;
            
            if (this.elements.videoElement) {
                this.elements.videoElement.srcObject = newStream;
                await this.elements.videoElement.play();
                
                const videoContainer = this.elements.videoContainer;
                if (videoContainer) {
                    videoContainer.classList.add('video-playing');
                    videoContainer.classList.remove('video-error');
                }
            }
            
            this._updateStatus('摄像头切换成功', 'success');
            this._updateUIState();
            
            return true;
            
        } catch (error) {
            console.error('❌ 切换摄像头失败:', error);
            this._handleError(error, '切换摄像头');
            return false;
        }
    }

    /**
     * 获取摄像头设备列表
     */
    async getCameraDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            this.state.cameraDevices = videoDevices.map(device => ({
                deviceId: device.deviceId,
                label: device.label || `摄像头 ${this.state.cameraDevices.length + 1}`,
                groupId: device.groupId
            }));
            
            return this.state.cameraDevices;
            
        } catch (error) {
            console.error('❌ 获取摄像头设备列表失败:', error);
            return [];
        }
    }

    /**
     * 🛠️ 修复：更新配置 - 支持动态更新录制时长
     */
    updateConfig(newConfig) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        
        // 🛠️ 修复：如果录制时长发生变化，更新当前录制时长
        if (newConfig.duration && newConfig.duration !== oldConfig.duration) {
            this.currentRecordingDuration = newConfig.duration;
            console.log(`⏱️ 录制时长配置已更新: ${oldConfig.duration}秒 -> ${newConfig.duration}秒`);
            
            // 如果正在录制，重新设置自动停止计时器
            if (this.state.isRecording && this.state.autoStopTimer) {
                clearTimeout(this.state.autoStopTimer);
                this._startAutoStopTimer();
            }
        }
        
        // 🛠️ 修复：如果质量设置发生变化，重新初始化摄像头
        if (newConfig.quality && newConfig.quality !== oldConfig.quality) {
            console.log(`🎥 视频质量配置已更新: ${oldConfig.quality} -> ${newConfig.quality}`);
            // 延迟重新初始化摄像头，避免打断用户操作
            setTimeout(() => {
                if (this.state.hasCameraAccess && !this.state.isRecording) {
                    this._initializeCamera();
                }
            }, 1000);
        }
        
        console.log('⚙️ 录制配置已更新:', this.config);
    }

    /**
     * 🛠️ 修复：获取当前状态 - 包含录制时长信息
     */
    getStatus() {
        return {
            isRecording: this.state.isRecording,
            isPaused: this.state.isPaused,
            hasCameraAccess: this.state.hasCameraAccess,
            recordingDuration: this.state.recordingDuration,
            configuredDuration: this.currentRecordingDuration, // 🛠️ 添加配置的时长
            currentOrder: this.state.currentOrderNumber,
            currentShop: this.state.currentShopName,
            currentFile: this.state.currentFileName,
            streamActive: !!this.state.stream,
            playbackHintShown: this.state.playbackHintShown,
            manualPlayAttempted: this.state.manualPlayAttempted,
            config: { ...this.config }
        };
    }

    /**
     * 🛠️ 新增：设置视频流（供主应用调用）
     */
    setVideoStream(stream) {
        if (stream && this.elements.videoElement) {
            this.state.stream = stream;
            this.state.hasCameraAccess = true;
            this.elements.videoElement.srcObject = stream;
            console.log('✅ 视频流已设置');
            return true;
        }
        return false;
    }

    /**
     * 🛠️ 新增：设置录制时长（供主应用调用）
     */
    setRecordingDuration(duration) {
        if (duration > 0 && duration <= this.config.maxDuration) {
            this.currentRecordingDuration = duration;
            console.log(`⏱️ 录制时长已设置为: ${duration}秒`);
            
            // 如果正在录制，重新设置自动停止计时器
            if (this.state.isRecording && this.state.autoStopTimer) {
                clearTimeout(this.state.autoStopTimer);
                this._startAutoStopTimer();
            }
            
            return true;
        } else {
            console.warn(`⚠️ 无效的录制时长: ${duration}秒，必须在1-${this.config.maxDuration}秒之间`);
            return false;
        }
    }

    /**
     * 销毁录制器
     */
    destroy() {
        if (this.state.isRecording) {
            this.stopRecording();
        }

        this._stopStream();
        this._stopRecordingTimer();
        
        const videoContainer = this.elements.videoContainer;
        if (videoContainer) {
            const elementsToRemove = videoContainer.querySelectorAll(
                '.camera-loading, .camera-error, .playback-hint, .recording-indicator'
            );
            elementsToRemove.forEach(el => el.remove());
            videoContainer.className = 'video-preview';
        }
        
        this.state.playbackHintShown = false;
        this.state.manualPlayAttempted = false;
        this.elements = {};
        this.callbacks = {};
        
        console.log('🗑️ 录制模块已销毁');
    }
}

// 🛠️ 修复：优化导出和集成
(function() {
    const videoRecorder = new VideoRecorder({
        namingPattern: 'order-shop-only',
        autoSave: false, // 🛠️ 关键修复：关闭自动下载
        fileFormat: 'mp4' // 🛠️ 修复：使用MP4格式
    });
    
    if (typeof window !== 'undefined') {
        window.videoRecorder = videoRecorder;
        window.VideoRecorder = VideoRecorder;
        
        if (window.ReturnUnpackSystem) {
            window.ReturnUnpackSystem.modules = window.ReturnUnpackSystem.modules || {};
            window.ReturnUnpackSystem.modules.recorder = videoRecorder;
            
            // 🛠️ 修复：添加视频录制完成处理函数
            window.ReturnUnpackSystem.handleVideoRecorded = async function(videoInfo) {
                console.log('📬 收到录制的视频数据:', videoInfo);
                
                if (videoInfo && videoInfo.orderNumber && videoInfo.blob) {
                    // 调用主应用的保存函数
                    if (window.saveVideoToOrder) {
                        console.log('🔄 调用主应用保存视频');
                        await window.saveVideoToOrder(videoInfo.orderNumber, videoInfo.blob, videoInfo);
                    } else {
                        console.error('❌ saveVideoToOrder 函数未定义');
                    }
                }
            };
            
            // 🛠️ 修复：增强集成到主系统的方法
            window.ReturnUnpackSystem.startRecording = function(orderNumber, metadata) {
                if (!orderNumber) {
                    const currentOrder = window.ReturnUnpackSystem.currentOrder;
                    if (currentOrder) {
                        orderNumber = currentOrder.orderNumber;
                        metadata = { 
                            shopName: currentOrder.shopName,
                            // 🛠️ 修复：传递录制时长
                            duration: window.ReturnUnpackSystem.recordingConfig?.duration || 30,
                            // 🛠️ 修复：传递视频质量
                            quality: window.ReturnUnpackSystem.recordingConfig?.quality || 'medium'
                        };
                    }
                }
                return videoRecorder.startRecording(orderNumber, metadata);
            };
            
            window.ReturnUnpackSystem.stopRecording = function() {
                return videoRecorder.stopRecording();
            };
            
            window.ReturnUnpackSystem.getRecordingStatus = function() {
                return videoRecorder.getStatus();
            };
            
            window.ReturnUnpackSystem.capturePhoto = function() {
                return videoRecorder.capturePhoto();
            };
            
            // 🛠️ 新增：设置录制时长
            window.ReturnUnpackSystem.setRecordingDuration = function(duration) {
                return videoRecorder.setRecordingDuration(duration);
            };
            
            // 🛠️ 新增：设置视频流
            window.ReturnUnpackSystem.setVideoStream = function(stream) {
                return videoRecorder.setVideoStream(stream);
            };
            
            // 🛠️ 新增：更新录制配置
            window.ReturnUnpackSystem.updateRecordingConfig = function(config) {
                return videoRecorder.updateConfig(config);
            };
        }
        
        // 🛠️ 修复：自动初始化函数
        function setupRecorder() {
            console.log('🔄 设置视频录制器...');
            
            const videoContainer = document.getElementById('videoPreview');
            const recordButton = document.getElementById('recordButton') || document.getElementById('startRecordingBtn');
            const stopButton = document.getElementById('stopButton') || document.getElementById('stopRecordingBtn');
            const pauseButton = document.getElementById('pauseButton');
            const timerDisplay = document.getElementById('recordingTimer');
            const statusDisplay = document.getElementById('recordingStatus');
            const cameraSelect = document.getElementById('cameraSelect');
            
            if (videoContainer) {
                console.log('✅ 找到视频容器');
                
                const elements = {
                    videoContainer: videoContainer,
                    videoElement: null,
                    recordButton: recordButton,
                    pauseButton: pauseButton,
                    stopButton: stopButton,
                    timerDisplay: timerDisplay,
                    statusDisplay: statusDisplay,
                    cameraSelect: cameraSelect
                };
                
                console.log('🔄 开始初始化录制器...');
                
                // 🛠️ 修复：设置事件回调
                const callbacks = {
                    onRecordingStart: function(data) {
                        console.log('🎬 录制开始:', data);
                        if (window.ReturnUnpackSystem.events && window.ReturnUnpackSystem.events.onRecordingStarted) {
                            window.ReturnUnpackSystem.events.onRecordingStarted(data);
                        }
                    },
                    onRecordingStop: function(data) {
                        console.log('⏹️ 录制停止:', data);
                        if (window.ReturnUnpackSystem.events && window.ReturnUnpackSystem.events.onRecordingStopped) {
                            window.ReturnUnpackSystem.events.onRecordingStopped(data);
                        }
                    },
                    onRecordingComplete: function(data) {
                        console.log('✅ 录制完成:', data);
                    },
                    onError: function(error) {
                        console.error('❌ 录制错误:', error);
                    },
                    onStatusChange: function(status) {
                        console.log('📊 状态更新:', status);
                    },
                    onTimerUpdate: function(seconds) {
                        console.log('⏱️ 计时器更新:', seconds);
                        if (window.ReturnUnpackSystem.events && window.ReturnUnpackSystem.events.onTimerUpdate) {
                            window.ReturnUnpackSystem.events.onTimerUpdate(seconds);
                        }
                    }
                };
                
                // 初始化录制器
                videoRecorder.init(elements, callbacks).then(result => {
                    if (result.success) {
                        console.log('✅ 录制器初始化成功');
                        if (recordButton) {
                            recordButton.disabled = false;
                        }
                    } else {
                        console.error('❌ 录制器初始化失败:', result.error);
                        if (recordButton) {
                            recordButton.disabled = true;
                        }
                    }
                });
            } else {
                console.warn('⚠️ 未找到视频容器，跳过自动初始化');
            }
        }
        
        // 🛠️ 修复：延迟初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('📄 DOM已加载，准备初始化录制器');
                setTimeout(setupRecorder, 1000);
            });
        } else {
            console.log('📄 DOM已就绪，准备初始化录制器');
            setTimeout(setupRecorder, 1000);
        }
    }
    
    // 模块导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = VideoRecorder;
    }
})();