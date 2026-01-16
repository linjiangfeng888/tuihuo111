/**
 * 扫码模块 - 退货拆包记录系统（修复增强版）
 * 处理条码扫描、订单查询、数据验证等功能
 * 版本: 1.3.0
 * 修复问题：
 * 1. 增强与主系统的集成兼容性
 * 2. 改进错误处理和用户反馈
 * 3. 优化扫码输入体验
 * 4. 添加配置管理
 */

class ScannerModule {
    constructor(config = {}) {
        this.version = '1.3.0';
        this.name = '退货拆包扫码模块';
        
        // 默认配置
        this.defaultConfig = {
            autoFocus: true,
            beepEnabled: true,
            soundEnabled: true,
            autoSearch: true,
            searchDelay: 300,
            validation: {
                minLength: 8,
                maxLength: 50,
                patterns: {
                    express: /^[A-Za-z0-9]{10,20}$/i,  // 快递单号
                    order: /^TH\d{10,15}$/i,           // TH订单号
                    numeric: /^\d{10,20}$/,            // 纯数字单号
                    mixed: /^[A-Za-z]{2,}\d+$/i        // 字母+数字
                }
            },
            timeout: 5000,
            debug: false
        };
        
        // 合并配置
        this.config = { ...this.defaultConfig, ...config };

        // 状态管理
        this.state = {
            isInitialized: false,
            isProcessing: false,
            lastScanTime: null,
            scanHistory: [],
            currentScan: null,
            inputElement: null,
            dependencies: {
                utils: false,
                database: false
            }
        };

        // 依赖模块
        this.dependencies = {
            utils: null,
            database: null
        };

        // 事件回调
        this.callbacks = {
            onScanStart: null,
            onScanComplete: null,
            onScanError: null,
            onOrderFound: null,
            onOrderNotFound: null,
            onLog: null
        };

        console.log(`✅ ${this.name} v${this.version} 初始化完成`);
    }
    
    /**
     * 初始化扫码模块（增强版）
     * @param {Object} options 配置选项
     * @param {Object} dependencies 依赖模块
     * @param {Object} callbacks 回调函数
     */
    async init(options = {}, dependencies = {}, callbacks = {}) {
        try {
            if (this.state.isInitialized) {
                console.log('🔄 扫码模块已经初始化');
                return { success: true, version: this.version };
            }
            
            console.log('🔄 开始初始化扫码模块...');
            
            // 合并配置
            if (options) {
                this.config = { ...this.config, ...options };
            }
            
            // 设置回调
            if (callbacks) {
                this.callbacks = { ...this.callbacks, ...callbacks };
            }
            
            // 设置依赖
            await this._setupDependencies(dependencies);
            
            // 获取输入框元素
            this.state.inputElement = document.getElementById('orderInput') || 
                                     document.querySelector('input[type="text"]') ||
                                     document.querySelector('input');
            
            if (!this.state.inputElement) {
                console.warn('⚠️ 未找到扫码输入框，将在DOM加载后重试');
                // 延迟重试
                setTimeout(() => {
                    this.state.inputElement = document.getElementById('orderInput');
                    if (this.state.inputElement) {
                        this.setupEventListeners();
                    }
                }, 1000);
            } else {
                this.setupEventListeners();
            }
            
            // 设置扫描按钮
            this._setupScanButton();
            
            this.state.isInitialized = true;
            
            this._log('✅ 扫码模块初始化完成', 'success');
            
            // 触发初始化完成事件
            this._triggerCallback('onLog', {
                message: '扫码模块初始化完成',
                level: 'success',
                timestamp: new Date(),
                module: 'scanner'
            });
            
            return { 
                success: true, 
                version: this.version,
                dependencies: this.state.dependencies
            };

        } catch (error) {
            this._log(`❌ 扫码模块初始化失败: ${error.message}`, 'error');
            
            this._triggerCallback('onLog', {
                message: `扫码模块初始化失败: ${error.message}`,
                level: 'error',
                timestamp: new Date(),
                module: 'scanner'
            });
            
            return { 
                success: false, 
                error: error.message,
                warning: '部分功能可能受限'
            };
        }
    }
    
    /**
     * 设置依赖模块
     */
    async _setupDependencies(dependencies = {}) {
        this._log('🔧 设置扫码模块依赖...', 'info');
        
        let depCheck = { utils: false, database: false };

        // 1. Utils 依赖
        const utilsSources = [
            dependencies.utils,
            window.ReturnUnpackSystem?.modules?.utils,
            window.utilsModule,
            window.Utils
        ];
        
        for (const source of utilsSources) {
            if (source && typeof source === 'object') {
                this.dependencies.utils = source;
                depCheck.utils = true;
                this._log('✅ Utils模块已注入', 'success');
                break;
            }
        }
        
        if (!depCheck.utils) {
            // 创建降级版Utils
            this.dependencies.utils = this._createFallbackUtils();
            depCheck.utils = false;
            this._log('⚠️ 使用降级版Utils，部分功能可能受限', 'warn');
        }

        // 2. Database 依赖
        const databaseSources = [
            dependencies.database,
            window.ReturnUnpackSystem?.modules?.database,
            window.databaseModule,
            window.ReturnUnpackSystem?.Database
        ];
        
        for (const source of databaseSources) {
            if (source && typeof source === 'object') {
                this.dependencies.database = source;
                depCheck.database = true;
                this._log('✅ Database模块已注入', 'success');
                break;
            }
        }
        
        if (!depCheck.database) {
            this._log('⚠️ Database模块未找到，扫码查询功能将受限', 'warn');
        }
        
        // 更新状态
        this.state.dependencies.utils = depCheck.utils;
        this.state.dependencies.database = depCheck.database;

        this._log(`🔧 依赖设置完成: ${JSON.stringify(depCheck)}`, 'info');
        return depCheck;
    }
    
    /**
     * 创建降级版Utils
     */
    _createFallbackUtils() {
        return {
            formatDate: (date, format = 'yyyy-MM-dd HH:mm:ss') => {
                if (!date) return '';
                try {
                    const d = new Date(date);
                    if (isNaN(d.getTime())) return '';
                    
                    const pad = (num) => num.toString().padStart(2, '0');
                    
                    const replacements = {
                        'yyyy': d.getFullYear(),
                        'MM': pad(d.getMonth() + 1),
                        'dd': pad(d.getDate()),
                        'HH': pad(d.getHours()),
                        'mm': pad(d.getMinutes()),
                        'ss': pad(d.getSeconds())
                    };
                    
                    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, match => replacements[match] || match);
                } catch (error) {
                    console.error('日期格式化失败:', error);
                    return '';
                }
            },
            
            extractTrackingNumber: (text) => {
                if (!text) return '';
                
                const patterns = [
                    /SF\d{11,13}/i,
                    /YT\d{11,13}/i,
                    /STO\d{11,13}/i,
                    /ZTO\d{11,13}/i,
                    /YD\d{11,13}/i,
                    /JD[0-9A-Z]{11,13}/i,
                    /\b\d{10,20}\b/
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) {
                        return match[0].toUpperCase().trim();
                    }
                }
                
                return text.toString().trim();
            },
            
            extractOrderNumber: (text) => {
                if (!text) return '';
                
                const patterns = [
                    /TH\d{10,15}/i,
                    /\b\d{10,20}\b/,
                    /\b[A-Z]{2,}\d{6,12}\b/i
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) {
                        return match[0].toUpperCase().trim();
                    }
                }
                
                return this.extractTrackingNumber(text);
            },
            
            validateTrackingNumber: (num) => {
                if (!num) return false;
                const str = num.toString().trim();
                return str.length >= 8 && str.length <= 30 && /\d/.test(str);
            },
            
            validateOrderNumber: (num) => {
                if (!num) return false;
                const str = num.toString().trim();
                return str.length >= 8 && str.length <= 30;
            },
            
            log: (message, level = 'info') => {
                const timestamp = new Date().toLocaleTimeString('zh-CN');
                const levels = { 
                    debug: '🔍', info: 'ℹ️', success: '✅', 
                    warn: '⚠️', error: '❌' 
                };
                const icon = levels[level] || levels.info;
                console.log(`${icon} [Scanner] [${timestamp}] ${message}`);
            }
        };
    }
    
    /**
     * 设置事件监听器（增强版）
     */
    setupEventListeners() {
        if (!this.state.inputElement) {
            this._log('无法设置事件监听器：输入框不存在', 'warn');
            return;
        }
        
        // 清除现有事件监听器（避免重复绑定）
        const newInput = this.state.inputElement.cloneNode(true);
        this.state.inputElement.parentNode.replaceChild(newInput, this.state.inputElement);
        this.state.inputElement = newInput;
        
        // 防抖定时器
        let debounceTimer;
        
        // 输入事件监听
        this.state.inputElement.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            
            const value = e.target.value.trim();
            
            if (this.config.autoSearch && value.length >= 2) {
                debounceTimer = setTimeout(() => {
                    this._handleInputChange(value);
                }, this.config.searchDelay);
            }
        });
        
        // 回车键确认
        this.state.inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = this.state.inputElement.value.trim();
                if (value) {
                    this.processScan(value);
                }
            }
        });
        
        // 获得焦点时清除内容
        this.state.inputElement.addEventListener('focus', () => {
            if (this.config.autoFocus) {
                this.state.inputElement.select();
            }
        });
        
        this._log('✅ 扫码事件监听器设置完成', 'success');
    }
    
    /**
     * 设置扫描按钮
     */
    _setupScanButton() {
        const scanButton = document.getElementById('scanButton');
        if (scanButton) {
            scanButton.addEventListener('click', () => {
                this.triggerScan();
            });
        }
        
        const manualButton = document.getElementById('manualButton');
        if (manualButton) {
            manualButton.addEventListener('click', () => {
                this.openManualInput();
            });
        }
    }
    
    /**
     * 处理输入变化
     */
    _handleInputChange(value) {
        if (value.length < 2) return;
        
        // 如果看起来像条码，直接处理
        if (this.isLikelyBarcode(value)) {
            this.processScan(value);
        }
    }
    
    /**
     * 判断是否为条码扫描输入
     */
    isLikelyBarcode(input) {
        if (!input) return false;
        
        const length = input.length;
        if (length < this.config.validation.minLength || 
            length > this.config.validation.maxLength) {
            return false;
        }
        
        const patterns = this.config.validation.patterns;
        return Object.values(patterns).some(pattern => pattern.test(input));
    }
    
    /**
     * 处理扫码输入（增强版）
     */
    async processScan(code) {
        if (this.state.isProcessing) {
            this._log('正在处理上一个扫描，请稍候', 'warn');
            return { 
                success: false, 
                message: '正在处理中，请稍候' 
            };
        }
        
        this.state.isProcessing = true;
        this.state.lastScanTime = new Date();
        this.state.currentScan = code;
        
        try {
            this._log(`处理扫码输入: ${code}`, 'info');
            
            // 触发扫描开始事件
            this._triggerCallback('onScanStart', {
                code: code,
                timestamp: this.state.lastScanTime
            });
            
            // 验证条码格式
            const validation = this.validateBarcode(code);
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // 播放提示音
            if (this.config.soundEnabled) {
                this.playBeep();
            }
            
            // 添加到历史记录
            this.addToHistory(code, 'scan');
            
            // 清空输入框
            if (this.state.inputElement) {
                this.state.inputElement.value = '';
            }
            
            // 显示处理状态
            this.showScanStatus('处理中...', 'info');
            
            // 根据条码类型处理
            const result = await this.handleBarcodeByType(code, validation.type);
            
            // 触发订单找到事件
            if (result.orderNumber) {
                this._triggerCallback('onOrderFound', {
                    order: result,
                    scanCode: code,
                    timestamp: new Date()
                });
            }
            
            // 触发扫描完成事件
            this._triggerCallback('onScanComplete', {
                code: code,
                result: result,
                timestamp: new Date(),
                type: validation.type
            });
            
            // 成功反馈
            this.showScanStatus(`已扫描: ${code}`, 'success');
            
            return {
                success: true,
                data: result,
                timestamp: this.state.lastScanTime,
                type: validation.type
            };
            
        } catch (error) {
            this._log(`❌ 扫码处理失败: ${error.message}`, 'error');
            
            // 错误反馈
            this.showScanStatus(`扫描失败: ${error.message}`, 'error');
            
            // 触发扫描错误事件
            this._triggerCallback('onScanError', {
                code: code,
                error: error.message,
                timestamp: new Date()
            });
            
            return {
                success: false,
                error: error.message,
                timestamp: this.state.lastScanTime
            };
            
        } finally {
            // 恢复处理状态
            setTimeout(() => {
                this.state.isProcessing = false;
                this.state.currentScan = null;
            }, 500);
        }
    }
    
    /**
     * 验证条码格式（增强版）
     */
    validateBarcode(barcode) {
        if (!barcode || typeof barcode !== 'string') {
            return { valid: false, message: '无效的条码' };
        }
        
        const trimmed = barcode.trim();
        const length = trimmed.length;
        
        // 检查长度
        if (length < this.config.validation.minLength) {
            return { 
                valid: false, 
                message: `条码过短 (${length} < ${this.config.validation.minLength})` 
            };
        }
        
        if (length > this.config.validation.maxLength) {
            return { 
                valid: false, 
                message: `条码过长 (${length} > ${this.config.validation.maxLength})` 
            };
        }
        
        // 识别条码类型
        let type = 'unknown';
        const patterns = this.config.validation.patterns;
        
        if (patterns.express.test(trimmed)) {
            type = 'express';
        } else if (patterns.order.test(trimmed)) {
            type = 'order';
        } else if (patterns.numeric.test(trimmed)) {
            type = 'numeric';
        } else if (patterns.mixed.test(trimmed)) {
            type = 'mixed';
        }
        
        return {
            valid: true,
            type: type,
            barcode: trimmed,
            length: length
        };
    }
    
    /**
     * 根据条码类型处理（增强版）
     */
    async handleBarcodeByType(barcode, type) {
        this._log(`处理 ${type} 类型条码: ${barcode}`, 'info');
        
        const timestamp = new Date();
        const baseData = {
            barcode: barcode,
            type: type,
            scanTime: timestamp.toISOString(),
            scanTimeDisplay: timestamp.toLocaleString('zh-CN'),
            status: '待处理',
            damage: '完好',
            damageType: '完好',
            notes: ''
        };
        
        // 提取订单号
        let orderNumber = barcode;
        if (this.dependencies.utils && this.dependencies.utils.extractOrderNumber) {
            orderNumber = this.dependencies.utils.extractOrderNumber(barcode);
        }
        
        // 尝试查询数据库
        let orderInfo = null;
        if (this.dependencies.database) {
            try {
                const dbResult = await this.dependencies.database.getOrder(orderNumber);
                if (dbResult && dbResult.success && dbResult.data) {
                    orderInfo = dbResult.data;
                    this._log(`从数据库找到订单: ${orderNumber}`, 'success');
                }
            } catch (error) {
                this._log(`数据库查询失败: ${error.message}`, 'warn');
            }
        }
        
        if (orderInfo) {
            // 合并数据库中的数据
            return {
                ...baseData,
                ...orderInfo,
                originalType: type,
                orderNumber: orderInfo.orderNumber || orderNumber,
                foundInDatabase: true
            };
        }
        
        // 根据类型生成模拟数据
        switch (type) {
            case 'express':
                return {
                    ...baseData,
                    expressNumber: barcode,
                    orderNumber: orderNumber,
                    shopName: '待确认店铺',
                    originalType: 'express',
                    notes: '快递单号扫描录入'
                };
                
            case 'order':
                return {
                    ...baseData,
                    orderNumber: orderNumber,
                    shopName: '订单客户',
                    originalType: 'order',
                    notes: '订单号扫描录入'
                };
                
            default:
                return {
                    ...baseData,
                    orderNumber: orderNumber,
                    shopName: '扫描录入',
                    originalType: type,
                    notes: `自动录入的${type}类型条码`
                };
        }
    }
    
    /**
     * 触发扫码
     */
    triggerScan() {
        if (!this.state.inputElement) {
            this.state.inputElement = document.getElementById('orderInput');
        }
        
        if (this.state.inputElement) {
            this.state.inputElement.focus();
            this.showScanStatus('请扫描条码或手动输入', 'info');
        } else {
            this.showScanStatus('未找到输入框，请刷新页面', 'error');
        }
    }
    
    /**
     * 打开手动输入对话框
     */
    openManualInput() {
        const input = prompt('请输入订单号或快递单号:', '');
        if (input && input.trim()) {
            this.processScan(input.trim());
        }
    }
    
    /**
     * 显示扫码状态
     */
    showScanStatus(message, type = 'info') {
        this._log(`${type}: ${message}`);
        
        // 更新页面状态显示
        const statusElement = document.getElementById('scanStatus');
        if (statusElement) {
            statusElement.textContent = message;
            
            // 设置样式
            statusElement.className = 'scan-status';
            if (type === 'success') {
                statusElement.classList.add('success');
            } else if (type === 'error') {
                statusElement.classList.add('error');
            } else if (type === 'info') {
                statusElement.classList.add('info');
            }
        }
        
        // 显示临时通知
        this.showNotification(message, type);
    }
    
    /**
     * 显示通知
     */
    showNotification(message, type) {
        try {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `scan-notification ${type}`;
            notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            `;
            
            // 添加到页面
            document.body.appendChild(notification);
            
            // 显示动画
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            // 3秒后移除
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        } catch (error) {
            console.error('显示通知失败:', error);
        }
    }
    
    /**
     * 播放提示音
     */
    playBeep() {
        if (!this.config.beepEnabled) return;
        
        try {
            // 创建音频上下文
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
        } catch (error) {
            // 静默失败
        }
    }
    
    /**
     * 添加到历史记录
     */
    addToHistory(code, type) {
        const record = {
            code: code,
            type: type,
            timestamp: new Date().toISOString(),
            timestampDisplay: new Date().toLocaleString('zh-CN')
        };
        
        this.state.scanHistory.unshift(record);
        
        // 保持历史记录不超过100条
        if (this.state.scanHistory.length > 100) {
            this.state.scanHistory = this.state.scanHistory.slice(0, 100);
        }
        
        // 更新历史显示
        this.updateHistoryDisplay();
    }
    
    /**
     * 更新历史记录显示
     */
    updateHistoryDisplay() {
        const historyContainer = document.getElementById('scanHistory');
        if (!historyContainer) return;
        
        const historyHtml = this.state.scanHistory.slice(0, 10).map((record, index) => `
            <div class="history-item">
                <span class="history-time">${record.timestampDisplay}</span>
                <span class="history-code">${record.code}</span>
                <span class="history-type">${record.type === 'scan' ? '扫码' : '手动'}</span>
            </div>
        `).join('');
        
        historyContainer.innerHTML = historyHtml || '<div class="empty-history">暂无扫描记录</div>';
    }
    
    /**
     * 触发回调函数
     */
    _triggerCallback(callbackName, ...args) {
        if (this.callbacks[callbackName] && typeof this.callbacks[callbackName] === 'function') {
            try {
                this.callbacks[callbackName](...args);
            } catch (error) {
                console.error(`回调函数 ${callbackName} 执行失败:`, error);
            }
        }
    }
    
    _log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        const prefix = `[ScannerModule]`;
        
        const levels = {
            debug: { icon: '🔍', color: '#888', console: 'debug' },
            info: { icon: 'ℹ️', color: '#3498db', console: 'info' },
            success: { icon: '✅', color: '#2ecc71', console: 'info' },
            warn: { icon: '⚠️', color: '#f39c12', console: 'warn' },
            error: { icon: '❌', color: '#e74c3c', console: 'error' }
        };
        
        const levelConfig = levels[level] || levels.info;
        
        if (this.config.debug || level === 'error' || level === 'warn') {
            console[levelConfig.console](`%c${levelConfig.icon} ${prefix} ${message}`, `color: ${levelConfig.color}`);
        }
        
        this._triggerCallback('onLog', { 
            message, 
            level, 
            timestamp: new Date(),
            module: 'scanner'
        });
    }
    
    /**
     * 设置扫描回调
     */
    onScan(callback) {
        this.callbacks.onScanComplete = callback;
    }
    
    /**
     * 获取扫描历史
     */
    getHistory() {
        return [...this.state.scanHistory];
    }
    
    /**
     * 清空历史记录
     */
    clearHistory() {
        this.state.scanHistory = [];
        this.updateHistoryDisplay();
    }
    
    /**
     * 获取模块信息
     */
    getInfo() {
        return {
            version: this.version,
            name: this.name,
            lastScan: this.state.lastScanTime,
            historyCount: this.state.scanHistory.length,
            isProcessing: this.state.isProcessing,
            isInitialized: this.state.isInitialized,
            dependencies: this.state.dependencies,
            config: { ...this.config }
        };
    }
}

// ======================= 全局导出 =======================
(function() {
    // 创建模块实例
    const scannerModule = new ScannerModule();
    
    // 全局导出
    if (typeof window !== 'undefined') {
        window.scannerModule = scannerModule;
        window.ScannerModule = ScannerModule;
        
        // 集成到主系统
        if (window.ReturnUnpackSystem) {
            window.ReturnUnpackSystem.modules = window.ReturnUnpackSystem.modules || {};
            window.ReturnUnpackSystem.modules.scanner = scannerModule;
            
            // 提供便捷方法
            window.ReturnUnpackSystem.scanOrder = function(code) {
                return scannerModule.processScan(code);
            };
            
            console.log('✅ ScannerModule (v1.3.0) 已集成到 ReturnUnpackSystem');
        }
        
        console.log('✅ ScannerModule v1.3.0 已全局导出');
        
        // 延迟初始化，等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    scannerModule.init().then(result => {
                        if (result.success) {
                            console.log('✅ ScannerModule 自动初始化成功');
                        }
                    });
                }, 1000);
            });
        } else {
            setTimeout(() => {
                scannerModule.init().then(result => {
                    if (result.success) {
                        console.log('✅ ScannerModule 自动初始化成功');
                    }
                });
            }, 1000);
        }
    }
    
    // 模块导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ScannerModule;
    }
})();