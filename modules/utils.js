/**
 * 实用工具模块 - 退货拆包记录系统（修复增强版）
 * 提供通用工具函数
 * 版本: 1.3.0
 * 修复问题：
 * 1. 增强与主系统的集成兼容性
 * 2. 改进错误处理和数据验证
 * 3. 添加更多实用函数
 * 4. 优化性能
 */

class UtilsModule {
    constructor(config = {}) {
        this.version = '1.3.0';
        this.name = '退货拆包工具模块';
        
        // 默认配置
        this.defaultConfig = {
            dateFormat: 'yyyy-MM-dd HH:mm:ss',
            fileSizeFormat: true,
            debugMode: false,
            logLevel: 'info',
            maxFileSize: 50 * 1024 * 1024
        };
        
        // 合并配置
        this.config = { ...this.defaultConfig, ...config };

        // 状态管理
        this.state = {
            isInitialized: false,
            lastOperation: null
        };

        console.log(`✅ ${this.name} v${this.version} 初始化`);
    }
    
    /**
     * 初始化工具模块
     * @param {Object} options 配置选项
     * @returns {Object} 初始化结果
     */
    async init(options = {}) {
        try {
            if (this.state.isInitialized) {
                console.log('🔄 工具模块已经初始化');
                return { success: true, version: this.version };
            }
            
            // 合并配置
            if (options) {
                this.config = { ...this.config, ...options };
            }
            
            // 添加通知样式
            this._addNotificationStyles();
            
            this.state.isInitialized = true;
            
            console.log('✅ 工具模块初始化完成');
            return { 
                success: true, 
                version: this.version,
                features: this.getFeatures()
            };
            
        } catch (error) {
            console.error('❌ 工具模块初始化失败:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    /**
     * 获取模块功能列表
     */
    getFeatures() {
        return [
            '日期时间格式化',
            '文件大小格式化',
            '运单号/订单号提取',
            '数据验证（邮箱、手机、身份证）',
            '文件读写工具',
            '字符串处理',
            '数组操作',
            '对象操作',
            'DOM操作工具',
            '通知系统'
        ];
    }
    
    /**
     * 检查浏览器是否支持 IndexedDB
     * @returns {boolean}
     */
    isIndexedDBSupported() {
        return 'indexedDB' in window;
    }
    
    /**
     * 生成唯一ID
     * @param {string} prefix 前缀
     * @returns {string} 唯一ID
     */
    generateId(prefix = 'id_') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}${timestamp}_${random}`;
    }
    
    /**
     * 格式化日期（增强版）
     * @param {Date|string|number} date 日期对象或字符串
     * @param {string} format 格式字符串
     * @returns {string} 格式化后的日期
     */
    formatDate(date, format = 'yyyy-MM-dd HH:mm:ss') {
        if (!date) return '';
        
        let dateObj;
        try {
            if (typeof date === 'string') {
                // 尝试解析字符串
                dateObj = new Date(date);
                // 如果无法解析，尝试常见格式
                if (isNaN(dateObj.getTime())) {
                    dateObj = new Date(date.replace(/-/g, '/').replace(/\./g, '/'));
                }
            } else if (typeof date === 'number') {
                dateObj = new Date(date);
            } else if (date instanceof Date) {
                dateObj = date;
            } else {
                return '';
            }
            
            if (isNaN(dateObj.getTime())) {
                return '';
            }
            
            const pad = (num) => num.toString().padStart(2, '0');
            const pad3 = (num) => num.toString().padStart(3, '0');
            
            const replacements = {
                'yyyy': dateObj.getFullYear(),
                'yy': dateObj.getFullYear().toString().slice(-2),
                'MM': pad(dateObj.getMonth() + 1),
                'M': dateObj.getMonth() + 1,
                'dd': pad(dateObj.getDate()),
                'd': dateObj.getDate(),
                'HH': pad(dateObj.getHours()),
                'H': dateObj.getHours(),
                'hh': pad(dateObj.getHours() % 12 || 12),
                'h': dateObj.getHours() % 12 || 12,
                'mm': pad(dateObj.getMinutes()),
                'm': dateObj.getMinutes(),
                'ss': pad(dateObj.getSeconds()),
                's': dateObj.getSeconds(),
                'SSS': pad3(dateObj.getMilliseconds()),
                'S': dateObj.getMilliseconds(),
                'a': dateObj.getHours() < 12 ? '上午' : '下午',
                'A': dateObj.getHours() < 12 ? 'AM' : 'PM'
            };
            
            return format.replace(/yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|S|a|A/g, 
                match => replacements[match] || match);
                
        } catch (error) {
            console.error('日期格式化失败:', error);
            return '';
        }
    }
    
    /**
     * 格式化文件大小（增强版）
     * @param {number} bytes 字节数
     * @param {number} decimals 小数位数
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(bytes, decimals = 2) {
        if (bytes === 0 || bytes === null || bytes === undefined) return '0 Bytes';
        
        try {
            bytes = Number(bytes);
            if (isNaN(bytes)) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            if (i < 0) return '0 Bytes';
            if (i >= sizes.length) return '超大文件';
            
            const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
            return value + ' ' + sizes[i];
        } catch (error) {
            console.error('文件大小格式化失败:', error);
            return bytes + ' Bytes';
        }
    }
    
    /**
     * 格式化时长（增强版）
     * @param {number} seconds 秒数
     * @returns {string} 格式化后的时长
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0 || isNaN(seconds)) return '00:00';
        
        try {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error('时长格式化失败:', error);
            return '00:00';
        }
    }
    
    /**
     * 读取文件内容（增强版）
     * @param {File} file 文件对象
     * @param {string} encoding 编码格式
     * @returns {Promise<string>} 文件内容
     */
    readFile(file, encoding = 'UTF-8') {
        return new Promise((resolve, reject) => {
            if (!file || !(file instanceof File)) {
                reject(new Error('无效的文件对象'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`文件读取失败: ${e.target.error?.message || '未知错误'}`));
            
            try {
                reader.readAsText(file, encoding);
            } catch (error) {
                reject(new Error(`文件读取异常: ${error.message}`));
            }
        });
    }
    
    /**
     * 读取文件为ArrayBuffer
     * @param {File} file 文件对象
     * @returns {Promise<ArrayBuffer>} ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            if (!file || !(file instanceof File)) {
                reject(new Error('无效的文件对象'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`文件读取失败: ${e.target.error?.message || '未知错误'}`));
            
            try {
                reader.readAsArrayBuffer(file);
            } catch (error) {
                reject(new Error(`文件读取异常: ${error.message}`));
            }
        });
    }
    
    /**
     * 下载文件（增强版）
     * @param {Blob|ArrayBuffer|string} data 文件数据
     * @param {string} filename 文件名
     * @param {string} mimeType MIME类型
     * @returns {boolean} 是否成功
     */
    downloadFile(data, filename, mimeType = 'application/octet-stream') {
        try {
            let blob;
            
            if (data instanceof Blob) {
                blob = data;
            } else if (data instanceof ArrayBuffer) {
                blob = new Blob([data], { type: mimeType });
            } else if (typeof data === 'string') {
                blob = new Blob([data], { type: mimeType });
            } else {
                throw new Error('不支持的数据类型');
            }
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            return true;
        } catch (error) {
            console.error('文件下载失败:', error);
            throw error;
        }
    }
    
    /**
     * 从文本中提取运单号（增强版）
     * @param {string} text 文本内容
     * @returns {string} 提取的运单号
     */
    extractTrackingNumber(text) {
        if (!text) return '';
        
        try {
            const cleanText = text.toString().trim();
            if (!cleanText) return '';
            
            // 常见快递单号模式（优先级排序）
            const patterns = [
                // 顺丰 SF
                /SF\d{11,13}/i,
                // 圆通 YT
                /YT\d{11,13}/i,
                // 申通 STO
                /STO\d{11,13}/i,
                // 中通 ZTO
                /ZTO\d{11,13}/i,
                // 韵达 YD
                /YD\d{11,13}/i,
                // 京东 JD
                /JD[0-9A-Z]{11,13}/i,
                // 百世快递 HTKY
                /HTKY\d{11,13}/i,
                // 天天快递 TTKD
                /TTKD\d{11,13}/i,
                // EMS
                /\bE[A-Z]{2}\d{9}[A-Z]{2}\b/i,
                // 邮政
                /\b\d{11,13}\b/,
                // 通用数字单号
                /\b\d{10,20}\b/,
                // 字母+数字组合
                /\b[A-Z]{2}\d{9,12}[A-Z]?\b/i
            ];
            
            for (const pattern of patterns) {
                const match = cleanText.match(pattern);
                if (match) {
                    return match[0].toUpperCase();
                }
            }
            
            // 如果没有匹配到，返回清理后的文本
            return cleanText;
        } catch (error) {
            console.error('提取运单号失败:', error);
            return text ? text.toString().trim() : '';
        }
    }
    
    /**
     * 提取订单号（增强版）
     * @param {string} text 文本内容
     * @returns {string} 提取的订单号
     */
    extractOrderNumber(text) {
        if (!text) return '';
        
        try {
            const cleanText = text.toString().trim();
            if (!cleanText) return '';
            
            // 常见订单号模式（优先级排序）
            const patterns = [
                // TH开头订单号
                /TH\d{10,15}/i,
                // 包含订单关键词
                /\b(?:订单|单号|order|Order|No\.?)[:\-\s]*([A-Z0-9]{8,20})\b/i,
                // 纯数字订单号
                /\b\d{10,20}\b/,
                // 字母数字混合
                /\b[A-Z]{2,}\d{6,12}\b/i,
                // 通用格式
                /\b[A-Z0-9]{8,20}\b/i
            ];
            
            for (const pattern of patterns) {
                const match = cleanText.match(pattern);
                if (match) {
                    // 如果有分组，取第一个分组
                    const extracted = match[1] || match[0];
                    return extracted.toUpperCase();
                }
            }
            
            // 尝试提取快递单号
            const trackingNumber = this.extractTrackingNumber(cleanText);
            if (trackingNumber && trackingNumber.length >= 10) {
                return trackingNumber;
            }
            
            return cleanText;
        } catch (error) {
            console.error('提取订单号失败:', error);
            return text ? text.toString().trim() : '';
        }
    }
    
    /**
     * 验证运单号（增强版）
     * @param {string} trackingNumber 运单号
     * @returns {boolean} 是否有效
     */
    validateTrackingNumber(trackingNumber) {
        if (!trackingNumber) return false;
        
        try {
            const num = trackingNumber.toString().trim();
            
            // 基本验证
            if (num.length < 8 || num.length > 30) {
                return false;
            }
            
            // 至少包含数字
            if (!/\d/.test(num)) {
                return false;
            }
            
            // 常见快递公司校验
            const carriers = {
                'SF': /^SF\d{11,13}$/i,      // 顺丰
                'YT': /^YT\d{11,13}$/i,      // 圆通
                'STO': /^STO\d{11,13}$/i,    // 申通
                'ZTO': /^ZTO\d{11,13}$/i,    // 中通
                'YD': /^YD\d{11,13}$/i,      // 韵达
                'JD': /^JD[0-9A-Z]{11,13}$/i, // 京东
                'EMS': /^E[A-Z]{2}\d{9}[A-Z]{2}$/i, // EMS
                'HTKY': /^HTKY\d{11,13}$/i,  // 百世
                'TTKD': /^TTKD\d{11,13}$/i   // 天天
            };
            
            // 检查是否为已知快递
            for (const [carrier, pattern] of Object.entries(carriers)) {
                if (pattern.test(num)) {
                    return true;
                }
            }
            
            // 通用数字验证
            if (/^\d{10,20}$/.test(num)) {
                return true;
            }
            
            // 通用字母数字验证
            if (/^[A-Z0-9]{10,20}$/i.test(num)) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('验证运单号失败:', error);
            return false;
        }
    }
    
    /**
     * 验证订单号（增强版）
     * @param {string} orderNumber 订单号
     * @returns {boolean} 是否有效
     */
    validateOrderNumber(orderNumber) {
        if (!orderNumber) return false;
        
        try {
            const num = orderNumber.toString().trim();
            
            // 基本长度验证
            if (num.length < 8 || num.length > 30) {
                return false;
            }
            
            // 常见格式验证
            const patterns = [
                /^TH\d{10,15}$/i,          // TH订单
                /^\d{10,20}$/,             // 纯数字
                /^[A-Z]{2,}\d{6,12}$/i,    // 字母+数字
                /^[A-Z0-9]{8,20}$/i        // 通用格式
            ];
            
            return patterns.some(pattern => pattern.test(num));
        } catch (error) {
            console.error('验证订单号失败:', error);
            return false;
        }
    }
    
    /**
     * 深拷贝对象（增强版）
     * @param {*} obj 要拷贝的对象
     * @returns {*} 深拷贝后的对象
     */
    deepClone(obj) {
        // 处理基本类型
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        // 处理Date对象
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        // 处理Array对象
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        // 处理普通对象
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
        
        // 其他情况（如函数、RegExp等）直接返回
        return obj;
    }
    
    /**
     * 防抖函数
     * @param {Function} func 要执行的函数
     * @param {number} wait 等待时间
     * @param {boolean} immediate 是否立即执行
     * @returns {Function} 防抖函数
     */
    debounce(func, wait = 300, immediate = false) {
        let timeout;
        return function(...args) {
            const context = this;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
    
    /**
     * 节流函数
     * @param {Function} func 要执行的函数
     * @param {number} limit 时间限制
     * @returns {Function} 节流函数
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 生成随机颜色
     * @returns {string} 十六进制颜色
     */
    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    
    /**
     * 生成指定范围的随机数
     * @param {number} min 最小值
     * @param {number} max 最大值
     * @returns {number} 随机数
     */
    getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    /**
     * 延迟执行
     * @param {number} ms 毫秒数
     * @returns {Promise} Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 检查对象是否为空
     * @param {Object} obj 对象
     * @returns {boolean} 是否为空
     */
    isEmpty(obj) {
        if (obj === null || obj === undefined) return true;
        if (typeof obj !== 'object') return false;
        return Object.keys(obj).length === 0;
    }
    
    /**
     * 安全获取嵌套对象属性
     * @param {Object} obj 对象
     * @param {string} path 路径
     * @param {any} defaultValue 默认值
     * @returns {any} 属性值
     */
    get(obj, path, defaultValue = undefined) {
        if (!obj || typeof obj !== 'object') return defaultValue;
        
        try {
            const keys = path.split('.');
            let result = obj;
            
            for (const key of keys) {
                if (result === null || result === undefined) {
                    return defaultValue;
                }
                result = result[key];
            }
            
            return result === undefined ? defaultValue : result;
        } catch (error) {
            console.error('获取嵌套属性失败:', error);
            return defaultValue;
        }
    }
    
    /**
     * 数组去重
     * @param {Array} array 数组
     * @returns {Array} 去重后的数组
     */
    unique(array) {
        if (!Array.isArray(array)) return [];
        return [...new Set(array)];
    }
    
    /**
     * 数组按字段去重
     * @param {Array} array 数组
     * @param {string} key 字段名
     * @returns {Array} 去重后的数组
     */
    uniqueBy(array, key) {
        if (!Array.isArray(array)) return [];
        
        const seen = new Set();
        return array.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }
    
    /**
     * 数组排序
     * @param {Array} array 数组
     * @param {string} key 排序字段
     * @param {boolean} ascending 是否升序
     * @returns {Array} 排序后的数组
     */
    sortBy(array, key, ascending = true) {
        if (!Array.isArray(array)) return [];
        
        return [...array].sort((a, b) => {
            const aValue = this.get(a, key);
            const bValue = this.get(b, key);
            
            if (aValue === bValue) return 0;
            
            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (aValue instanceof Date && bValue instanceof Date) {
                comparison = aValue.getTime() - bValue.getTime();
            } else {
                comparison = (aValue || 0) - (bValue || 0);
            }
            
            return ascending ? comparison : -comparison;
        });
    }
    
    /**
     * 格式化数字（千分位，增强版）
     * @param {number} num 数字
     * @param {number} decimals 小数位数
     * @returns {string} 格式化后的数字
     */
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        
        try {
            const fixedNum = Number(num).toFixed(decimals);
            const parts = fixedNum.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            
            return parts.join('.');
        } catch (error) {
            console.error('数字格式化失败:', error);
            return num.toString();
        }
    }
    
    /**
     * 计算百分比
     * @param {number} part 部分值
     * @param {number} total 总值
     * @param {number} decimals 小数位数
     * @returns {string} 百分比字符串
     */
    calculatePercentage(part, total, decimals = 1) {
        if (total === 0) return '0%';
        
        try {
            const percentage = (part / total) * 100;
            return percentage.toFixed(decimals) + '%';
        } catch (error) {
            console.error('计算百分比失败:', error);
            return '0%';
        }
    }
    
    /**
     * 字符串截断
     * @param {string} str 字符串
     * @param {number} length 最大长度
     * @param {string} suffix 后缀
     * @returns {string} 截断后的字符串
     */
    truncate(str, length = 50, suffix = '...') {
        if (!str || str.length <= length) return str || '';
        return str.substring(0, length) + suffix;
    }
    
    /**
     * 生成CSV内容（增强版）
     * @param {Array} data 数据数组
     * @param {Array} headers 表头数组
     * @returns {string} CSV内容
     */
    generateCSV(data, headers = null) {
        if (!data || !Array.isArray(data) || data.length === 0) return '';
        
        try {
            // 如果没有提供headers，从第一条数据中提取
            const actualHeaders = headers || Object.keys(data[0] || {});
            
            // 生成CSV行
            const rows = data.map(row => {
                return actualHeaders.map(header => {
                    let value = row[header];
                    
                    // 处理特殊值
                    if (value === null || value === undefined) {
                        value = '';
                    } else if (typeof value === 'object') {
                        value = JSON.stringify(value);
                    } else if (typeof value === 'boolean') {
                        value = value ? '是' : '否';
                    }
                    
                    // CSV转义
                    const stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
                        return '"' + stringValue.replace(/"/g, '""') + '"';
                    }
                    
                    return stringValue;
                });
            });
            
            // 添加表头
            const csvRows = [actualHeaders.join(','), ...rows.map(row => row.join(','))];
            
            return csvRows.join('\n');
        } catch (error) {
            console.error('生成CSV失败:', error);
            return '';
        }
    }
    
    /**
     * 解析查询字符串
     * @param {string} queryString 查询字符串
     * @returns {Object} 解析后的对象
     */
    parseQueryString(queryString) {
        if (!queryString) return {};
        
        try {
            const params = {};
            const query = queryString.startsWith('?') ? queryString.substring(1) : queryString;
            
            query.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) {
                    params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                }
            });
            
            return params;
        } catch (error) {
            console.error('解析查询字符串失败:', error);
            return {};
        }
    }
    
    /**
     * 构建查询字符串
     * @param {Object} params 参数对象
     * @returns {string} 查询字符串
     */
    buildQueryString(params) {
        if (!params || typeof params !== 'object') return '';
        
        try {
            const pairs = [];
            Object.entries(params).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                }
            });
            
            return pairs.join('&');
        } catch (error) {
            console.error('构建查询字符串失败:', error);
            return '';
        }
    }
    
    /**
     * 获取URL参数
     * @param {string} name 参数名
     * @returns {string|null} 参数值
     */
    getUrlParam(name) {
        try {
            const params = this.parseQueryString(window.location.search);
            return params[name] || null;
        } catch (error) {
            console.error('获取URL参数失败:', error);
            return null;
        }
    }
    
    /**
     * 复制文本到剪贴板（增强版）
     * @param {string} text 要复制的文本
     * @returns {Promise<boolean>} 是否成功
     */
    async copyToClipboard(text) {
        try {
            if (!text) {
                throw new Error('复制内容为空');
            }
            
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                return successful;
            }
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            return false;
        }
    }
    
    /**
     * 日志记录（增强版）
     * @param {string} message 消息
     * @param {string} level 日志级别
     * @param {string} module 模块名称
     */
    log(message, level = 'info', module = 'utils') {
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        const levels = {
            debug: { icon: '🔍', color: '#666' },
            info: { icon: 'ℹ️', color: '#1890ff' },
            success: { icon: '✅', color: '#52c41a' },
            warn: { icon: '⚠️', color: '#faad14' },
            error: { icon: '❌', color: '#ff4d4f' }
        };
        
        const levelInfo = levels[level] || levels.info;
        const logMessage = `${levelInfo.icon} [${module}] [${timestamp}] ${message}`;
        
        if (this.config.debugMode || level === 'error' || level === 'warn') {
            console.log(`%c${logMessage}`, `color: ${levelInfo.color}`);
        }
    }
    
    /**
     * 显示通知（增强版）
     * @param {string} message 消息
     * @param {string} type 类型
     * @param {number} duration 持续时间(毫秒)
     */
    showNotification(message, type = 'info', duration = 3000) {
        try {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `utils-notification notification-${type}`;
            notification.innerHTML = `
                <i class="fas fa-${this._getNotificationIcon(type)}"></i>
                <span>${message}</span>
            `;
            
            // 添加到页面
            document.body.appendChild(notification);
            
            // 显示动画
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            // 自动移除
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, duration);
        } catch (error) {
            console.error('显示通知失败:', error);
        }
    }
    
    /**
     * 获取通知图标
     * @private
     */
    _getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    /**
     * 添加通知样式
     * @private
     */
    _addNotificationStyles() {
        if (document.querySelector('#utils-notification-styles')) return;
        
        try {
            const style = document.createElement('style');
            style.id = 'utils-notification-styles';
            style.textContent = `
                .utils-notification {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 9999;
                    transform: translateX(100%);
                    opacity: 0;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 300px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    font-family: 'Noto Sans SC', sans-serif;
                }
                
                .utils-notification.show {
                    transform: translateX(0);
                    opacity: 1;
                }
                
                .notification-success {
                    background-color: #28a745;
                }
                
                .notification-error {
                    background-color: #dc3545;
                }
                
                .notification-warning {
                    background-color: #ffc107;
                    color: #212529;
                }
                
                .notification-info {
                    background-color: #17a2b8;
                }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.error('添加通知样式失败:', error);
        }
    }
    
    /**
     * 验证电子邮件
     * @param {string} email 电子邮件地址
     * @returns {boolean} 是否有效
     */
    validateEmail(email) {
        if (!email) return false;
        try {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        } catch (error) {
            console.error('验证邮箱失败:', error);
            return false;
        }
    }
    
    /**
     * 验证手机号码
     * @param {string} phone 手机号码
     * @returns {boolean} 是否有效
     */
    validatePhone(phone) {
        if (!phone) return false;
        try {
            const re = /^1[3-9]\d{9}$/;
            return re.test(phone);
        } catch (error) {
            console.error('验证手机号失败:', error);
            return false;
        }
    }
    
    /**
     * 验证身份证号码（增强版）
     * @param {string} idCard 身份证号码
     * @returns {boolean} 是否有效
     */
    validateIdCard(idCard) {
        if (!idCard) return false;
        
        try {
            // 简单格式验证
            if (!/^\d{17}[\dXx]$/.test(idCard)) {
                return false;
            }
            
            // 校验码验证
            const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
            const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
            
            let sum = 0;
            for (let i = 0; i < 17; i++) {
                sum += parseInt(idCard.charAt(i)) * weights[i];
            }
            
            const checkCode = checks[sum % 11];
            return checkCode === idCard.charAt(17).toUpperCase();
        } catch (error) {
            console.error('验证身份证失败:', error);
            return false;
        }
    }
    
    /**
     * 获取当前时间戳
     * @returns {number} 时间戳
     */
    getTimestamp() {
        return Date.now();
    }
    
    /**
     * 获取模块信息
     * @returns {Object} 模块信息
     */
    getInfo() {
        return {
            version: this.version,
            name: this.name,
            isInitialized: this.state.isInitialized,
            lastOperation: this.state.lastOperation,
            features: this.getFeatures(),
            config: { ...this.config }
        };
    }
}

// ======================= 全局导出 =======================
(function() {
    // 创建模块实例
    const utilsModule = new UtilsModule();
    
    // 全局导出
    if (typeof window !== 'undefined') {
        window.utilsModule = utilsModule;
        window.UtilsModule = UtilsModule;
        
        // 创建全局Utils别名（兼容旧代码）
        window.Utils = utilsModule;
        
        // 集成到主系统
        if (window.ReturnUnpackSystem) {
            window.ReturnUnpackSystem.modules = window.ReturnUnpackSystem.modules || {};
            window.ReturnUnpackSystem.modules.utils = utilsModule;
            
            // 提供便捷方法
            window.ReturnUnpackSystem.formatDate = utilsModule.formatDate.bind(utilsModule);
            window.ReturnUnpackSystem.formatFileSize = utilsModule.formatFileSize.bind(utilsModule);
            window.ReturnUnpackSystem.showNotification = utilsModule.showNotification.bind(utilsModule);
            
            console.log('✅ UtilsModule (v1.3.0) 已集成到 ReturnUnpackSystem');
        }
        
        console.log('✅ UtilsModule v1.3.0 已全局导出');
        
        // 自动初始化
        setTimeout(() => {
            utilsModule.init().then(result => {
                if (result.success) {
                    console.log('✅ UtilsModule 自动初始化成功');
                }
            });
        }, 500);
    }
    
    // 模块导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = UtilsModule;
    }
})();
