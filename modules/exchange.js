/**
 * modules/exchange.js - 数据交换模块（修复增强版）
 * 退货拆包系统 - 数据交换模块
 * 版本: 1.5.0
 * 修复问题：
 * 1. 增强依赖注入兼容性
 * 2. 改进Excel导入错误处理
 * 3. 优化进度报告和用户体验
 * 4. 修复批量导入的重复处理问题
 */

class ExchangeModule {
    constructor(config = {}) {
        // 模块信息
        this.version = '1.5.0';
        this.name = '退货拆包数据交换模块';
        
        // 默认配置
        this.defaultConfig = {
            autoBackup: true,
            backupInterval: 24,
            backupLocation: '退货拆包备份/',
            exportFormats: ['csv', 'json', 'excel'],
            importFormats: ['csv', 'json', 'excel'],
            maxFileSize: 50 * 1024 * 1024,
            dateFormat: 'yyyy-MM-dd',
            timeFormat: 'HH:mm:ss',
            encoding: 'UTF-8',
            defaultCleanupDays: 7,
            debugMode: true,
            logLevel: 'info',
            batchSize: 50,
            maxImportRecords: 10000
        };

        // 合并配置
        this.config = { ...this.defaultConfig, ...config };

        // 状态管理
        this.state = {
            isInitialized: false,
            isExporting: false,
            isImporting: false,
            lastBackupTime: null,
            lastExportTime: null,
            lastImportTime: null,
            backupTimer: null,
            isCleaning: false,
            lastCleanupTime: null,
            dependencies: {
                utils: false,
                database: false,
                excel: false
            }
        };

        // 依赖模块
        this.dependencies = {
            database: null,
            utils: null
        };

        // 事件回调
        this.callbacks = {
            onExportStart: null,
            onExportComplete: null,
            onExportError: null,
            onImportStart: null,
            onImportComplete: null,
            onImportError: null,
            onBackupCreated: null,
            onBackupError: null,
            onCleanupStart: null,
            onCleanupComplete: null,
            onCleanupError: null,
            onImportProgress: null,
            onLog: null
        };

        // 支持的文件格式
        this.supportedFormats = {
            csv: {
                mimeType: 'text/csv',
                extension: '.csv',
                description: 'CSV文件'
            },
            json: {
                mimeType: 'application/json',
                extension: '.json',
                description: 'JSON文件'
            },
            excel: {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                extension: '.xlsx',
                description: 'Excel文件'
            },
            txt: {
                mimeType: 'text/plain',
                extension: '.txt',
                description: '文本文件'
            }
        };

        // 列映射配置 - 增强字段映射
        this.columnMapping = {
            orders: {
                // Excel字段 -> 数据库字段映射
                '订单编号': 'orderNumber',
                '订单号': 'orderNumber',
                '单号': 'orderNumber',
                '订单': 'orderNumber',
                'OrderNumber': 'orderNumber',
                'Order No': 'orderNumber',
                
                '发货运单号': 'expressNumber',
                '运单号': 'expressNumber',
                '快递单号': 'expressNumber',
                '发货单号': 'expressNumber',
                'ShippingNo': 'expressNumber',
                'ExpressNumber': 'expressNumber',
                
                '退货运单号': 'trackingNumber',
                '退货单号': 'trackingNumber',
                '退货快递单号': 'trackingNumber',
                'ReturnTracking': 'trackingNumber',
                'TrackingNumber': 'trackingNumber',
                
                'sku信息': 'skuInfo',
                'SKU信息': 'skuInfo',
                '商品编码': 'skuInfo',
                'SKU': 'skuInfo',
                'ProductSKU': 'skuInfo',
                'SKUCode': 'skuInfo',
                
                '备注': 'notes',
                '商品备注': 'notes',
                '订单备注': 'notes',
                'Remarks': 'notes',
                'Note': 'notes',
                'Comments': 'notes',
                
                '店铺名字': 'shopName',
                '店铺名称': 'shopName',
                '店铺': 'shopName',
                '卖家': 'shopName',
                'StoreName': 'shopName',
                'Shop': 'shopName',
                'Seller': 'shopName',
                
                '扫描时间': 'scanTime',
                '导入时间': 'importTime',
                '创建时间': 'createdAt',
                '更新时间': 'updatedAt',
                
                '状态': 'status',
                'Status': 'status',
                
                '损坏情况': 'damage',
                'Damage': 'damage',
                '损坏类型': 'damageType'
            },
            
            // 反向映射：数据库字段 -> 显示字段
            display: {
                orderNumber: '订单编号',
                expressNumber: '发货运单号',
                trackingNumber: '退货运单号',
                skuInfo: 'SKU信息',
                notes: '备注',
                shopName: '店铺名称',
                importTime: '导入时间',
                scanTime: '扫描/录制时间',
                status: '状态',
                damage: '损坏情况',
                videoFile: '视频文件',
                createdAt: '创建时间',
                updatedAt: '更新时间'
            }
        };

        // 导入统计模板
        this.importStatsTemplate = {
            total: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            startTime: null,
            endTime: null,
            duration: null,
            details: {
                created: [],
                updated: [],
                skipped: [],
                failed: []
            }
        };

        this._log('✅ ExchangeModule 实例已创建 (v1.5.0)', 'success');
    }

    /**
     * ======================= 初始化方法（增强版） =======================
     */
    async init(dependencies = {}, callbacks = {}) {
        try {
            if (this.state.isInitialized) {
                this._log('🔄 ExchangeModule 已经初始化', 'info');
                return { 
                    success: true, 
                    version: this.version,
                    dependencies: this.state.dependencies 
                };
            }
            
            this._log('🔄 开始初始化数据交换模块...', 'info');
            
            // 设置回调
            if (callbacks) {
                this.callbacks = { ...this.callbacks, ...callbacks };
            }
            
            // 设置依赖（增强兼容性）
            await this._setupDependencies(dependencies);
            
            // 检查Excel支持
            await this._checkExcelSupport();
            
            // 自动备份
            if (this.config.autoBackup) {
                this._startAutoBackup();
            }

            this.state.isInitialized = true;
            this._log('✅ 数据交换模块初始化完成', 'success');
            
            // 触发初始化完成事件
            this._triggerCallback('onLog', { 
                message: 'ExchangeModule 初始化完成',
                level: 'success',
                timestamp: new Date(),
                module: 'exchange'
            });
            
            return { 
                success: true, 
                version: this.version,
                dependencies: this.state.dependencies
            };

        } catch (error) {
            this._log(`❌ 数据交换模块初始化失败: ${error.message}`, 'error');
            this.state.isInitialized = false;
            
            this._triggerCallback('onLog', {
                message: `ExchangeModule 初始化失败: ${error.message}`,
                level: 'error',
                timestamp: new Date(),
                module: 'exchange'
            });
            
            return { 
                success: false, 
                error: error.message,
                warning: '部分功能可能受限',
                dependencies: this.state.dependencies
            };
        }
    }

    /**
     * ======================= 依赖注入（增强兼容性） =======================
     */
    async _setupDependencies(dependencies) {
        this._log('🔧 设置 ExchangeModule 依赖...', 'info');
        
        let depCheck = { utils: false, database: false };

        // 1. Utils 依赖（多路径查找）
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

        // 2. Database 依赖（关键修复，多路径查找）
        const databaseSources = [
            dependencies.database,
            window.ReturnUnpackSystem?.modules?.database,
            window.databaseModule,
            window.ReturnUnpackSystem?.Database
        ];
        
        for (const source of databaseSources) {
            if (source && typeof source === 'object') {
                // 检查是否有必要的方法
                const requiredMethods = ['getOrder', 'updateOrder', 'addOrder', 'bulkImportOrders'];
                const hasRequiredMethods = requiredMethods.every(
                    method => typeof source[method] === 'function'
                );
                
                if (hasRequiredMethods) {
                    this.dependencies.database = source;
                    depCheck.database = true;
                    this._log('✅ Database模块已注入', 'success');
                    break;
                } else {
                    this._log(`⚠️ Database模块缺少必要方法`, 'warn');
                }
            }
        }
        
        if (!depCheck.database) {
            try {
                // 尝试创建新的Database实例
                if (window.DatabaseModule) {
                    const db = new window.DatabaseModule();
                    if (typeof db.initialize === 'function') {
                        await db.initialize();
                        this.dependencies.database = db;
                        depCheck.database = true;
                        this._log('✅ 创建新的Database实例', 'success');
                    }
                }
            } catch (error) {
                this._log(`❌ 创建Database实例失败: ${error.message}`, 'error');
                this.dependencies.database = this._createMockDatabase();
                depCheck.database = false;
                this._log('⚠️ 使用模拟Database，数据不会持久化', 'warn');
            }
        }
        
        // 更新状态
        this.state.dependencies.utils = depCheck.utils;
        this.state.dependencies.database = depCheck.database;

        this._log(`🔧 依赖设置完成: ${JSON.stringify(depCheck)}`, 'info');
        return depCheck;
    }

    async _checkExcelSupport() {
        if (typeof XLSX !== 'undefined') {
            this.state.dependencies.excel = true;
            this._log('✅ Excel库已加载', 'debug');
            return true;
        } else {
            this.state.dependencies.excel = false;
            this._log('⚠️ Excel库未加载，Excel功能将使用CSV降级方案', 'warn');
            return false;
        }
    }

    /**
     * 创建降级版Utils（优化版）
     */
    _createFallbackUtils() {
        const fallbackUtils = {
            formatDate: (date, format = 'yyyy-MM-dd HH:mm:ss') => {
                if (!date) return '';
                try {
                    const d = new Date(date);
                    if (isNaN(d.getTime())) return '';
                    
                    const pad = (num) => num.toString().padStart(2, '0');
                    const pad3 = (num) => num.toString().padStart(3, '0');
                    
                    const replacements = {
                        'yyyy': d.getFullYear(),
                        'yy': d.getFullYear().toString().slice(-2),
                        'MM': pad(d.getMonth() + 1),
                        'M': d.getMonth() + 1,
                        'dd': pad(d.getDate()),
                        'd': d.getDate(),
                        'HH': pad(d.getHours()),
                        'H': d.getHours(),
                        'mm': pad(d.getMinutes()),
                        'm': d.getMinutes(),
                        'ss': pad(d.getSeconds()),
                        's': d.getSeconds(),
                        'SSS': pad3(d.getMilliseconds()),
                        'S': d.getMilliseconds()
                    };
                    
                    return format.replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|m|ss|s|SSS|S/g, 
                        match => replacements[match] || match);
                } catch (error) {
                    console.error('日期格式化失败:', error);
                    return '';
                }
            },
            
            formatFileSize: (bytes) => {
                if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
                try {
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                } catch (error) {
                    console.error('文件大小格式化失败:', error);
                    return bytes + ' B';
                }
            },
            
            formatDuration: (seconds) => {
                if (!seconds || seconds < 0 || isNaN(seconds)) return '00:00';
                
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                
                if (hours > 0) {
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            },
            
            readFile: (file, encoding = 'UTF-8') => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error(`文件读取失败: ${e.target.error?.message || '未知错误'}`));
                    reader.readAsText(file, encoding);
                });
            },
            
            downloadFile: (blob, filename, mimeType = 'application/octet-stream') => {
                try {
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
            },
            
            extractTrackingNumber: (text) => {
                if (!text) return '';
                
                const patterns = [
                    // 快递公司
                    /SF\d{11,13}/i,
                    /YT\d{11,13}/i,
                    /STO\d{11,13}/i,
                    /ZTO\d{11,13}/i,
                    /YD\d{11,13}/i,
                    /JD[0-9A-Z]{11,13}/i,
                    /HTKY\d{11,13}/i,
                    /TTKD\d{11,13}/i,
                    /\bE[A-Z]{2}\d{9}[A-Z]{2}\b/i,
                    // 通用格式
                    /\b\d{10,20}\b/,
                    /\b[A-Z]{2}\d{9,12}[A-Z]?\b/i
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) {
                        return match[0].toUpperCase().trim();
                    }
                }
                
                return text.toString().trim();
            },
            
            validateTrackingNumber: (num) => {
                if (!num) return false;
                const str = num.toString().trim();
                return str.length >= 8 && str.length <= 30 && /\d/.test(str);
            },
            
            log: (message, level = 'info', module = 'exchange') => {
                const timestamp = new Date().toLocaleTimeString('zh-CN');
                const levels = { 
                    debug: '🔍', info: 'ℹ️', success: '✅', 
                    warn: '⚠️', error: '❌' 
                };
                const icon = levels[level] || levels.info;
                console.log(`${icon} [${module}] [${timestamp}] ${message}`);
            }
        };
        
        // 绑定this到log方法
        fallbackUtils.log = fallbackUtils.log.bind(this);
        
        return fallbackUtils;
    }

    /**
     * 创建模拟数据库（兼容格式）
     */
    _createMockDatabase() {
        const orders = new Map();
        let orderCounter = 1;
        
        return {
            getAllOrders: async (limit = 1000) => {
                return Array.from(orders.values()).slice(0, limit);
            },
            
            getOrder: async (orderNumber) => {
                for (const order of orders.values()) {
                    if (order.orderNumber === orderNumber) {
                        return { success: true, data: order };
                    }
                }
                return { success: false, data: null, message: '订单不存在' };
            },
            
            addOrder: async (order) => {
                if (!order.orderNumber) throw new Error('订单号不能为空');
                
                const newOrder = {
                    ...order,
                    id: `mock_${orderCounter++}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                orders.set(newOrder.id, newOrder);
                return { success: true, data: newOrder, id: newOrder.id };
            },
            
            updateOrder: async (orderNumber, updates) => {
                let foundOrder = null;
                let foundKey = null;
                
                for (const [key, order] of orders.entries()) {
                    if (order.orderNumber === orderNumber) {
                        foundOrder = order;
                        foundKey = key;
                        break;
                    }
                }
                
                if (!foundOrder) {
                    // 创建新订单
                    return this.addOrder({ ...updates, orderNumber });
                }
                
                const updatedOrder = {
                    ...foundOrder,
                    ...updates,
                    orderNumber: orderNumber, // 确保订单号不变
                    updatedAt: new Date().toISOString()
                };
                
                orders.set(foundKey, updatedOrder);
                return { success: true, data: updatedOrder, updated: true };
            },
            
            deleteOrder: async (orderNumber) => {
                let foundKey = null;
                for (const [key, order] of orders.entries()) {
                    if (order.orderNumber === orderNumber) {
                        foundKey = key;
                        break;
                    }
                }
                
                if (foundKey) {
                    orders.delete(foundKey);
                    return { success: true, message: '订单删除成功' };
                }
                
                return { success: false, message: '订单不存在' };
            },
            
            bulkImportOrders: async (ordersArray, strategy = 'fill_blanks') => {
                const results = {
                    total: ordersArray.length,
                    added: 0,
                    updated: 0,
                    skipped: 0,
                    failed: 0,
                    errors: []
                };
                
                const importTime = new Date().toISOString();
                
                for (let i = 0; i < ordersArray.length; i++) {
                    const order = ordersArray[i];
                    
                    try {
                        if (!order.orderNumber) {
                            throw new Error('缺少订单号');
                        }
                        
                        order.importTime = order.importTime || importTime;
                        
                        let existingOrder = null;
                        let existingKey = null;
                        
                        for (const [key, ord] of orders.entries()) {
                            if (ord.orderNumber === order.orderNumber) {
                                existingOrder = ord;
                                existingKey = key;
                                break;
                            }
                        }
                        
                        if (existingOrder) {
                            if (strategy === 'skip_duplicates') {
                                results.skipped++;
                                continue;
                            } else if (strategy === 'fill_blanks') {
                                const mergedOrder = { ...existingOrder };
                                Object.keys(order).forEach(key => {
                                    if (!existingOrder[key] || existingOrder[key] === '' || existingOrder[key] === null) {
                                        mergedOrder[key] = order[key];
                                    }
                                });
                                mergedOrder.updatedAt = new Date().toISOString();
                                orders.set(existingKey, mergedOrder);
                                results.updated++;
                            } else if (strategy === 'update_all') {
                                order.updatedAt = new Date().toISOString();
                                orders.set(existingKey, order);
                                results.updated++;
                            }
                        } else {
                            order.createdAt = new Date().toISOString();
                            order.updatedAt = new Date().toISOString();
                            order.id = `mock_${orderCounter++}`;
                            orders.set(order.id, order);
                            results.added++;
                        }
                    } catch (error) {
                        results.failed++;
                        results.errors.push({
                            index: i,
                            order: order,
                            error: error.message
                        });
                    }
                }
                
                return results;
            },
            
            getStats: async (date = null) => {
                const allOrders = Array.from(orders.values());
                const today = date || new Date().toISOString().split('T')[0];
                
                const todayOrders = allOrders.filter(order => {
                    const orderDate = new Date(order.importTime || order.createdAt).toISOString().split('T')[0];
                    return orderDate === today;
                });
                
                return {
                    date: today,
                    total: todayOrders.length,
                    processed: todayOrders.filter(o => o.status === '已处理').length,
                    damaged: todayOrders.filter(o => o.damage === '破损' || o.damage === '缺件').length,
                    pending: todayOrders.filter(o => o.status === '待处理').length,
                    videos: todayOrders.filter(o => o.videoFile).length,
                    lastUpdated: new Date().toISOString()
                };
            }
        };
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
        const timestamp = this.dependencies.utils ? 
            this.dependencies.utils.formatDate(new Date(), 'HH:mm:ss') : 
            new Date().toLocaleTimeString('zh-CN');
        
        const prefix = `[ExchangeModule]`;
        
        const levels = {
            debug: { icon: '🔍', color: '#888', console: 'debug' },
            info: { icon: 'ℹ️', color: '#3498db', console: 'info' },
            success: { icon: '✅', color: '#2ecc71', console: 'info' },
            warn: { icon: '⚠️', color: '#f39c12', console: 'warn' },
            error: { icon: '❌', color: '#e74c3c', console: 'error' }
        };
        
        const levelConfig = levels[level] || levels.info;
        
        console[levelConfig.console](`%c${levelConfig.icon} ${prefix} ${message}`, `color: ${levelConfig.color}`);
        
        this._triggerCallback('onLog', { 
            message, 
            level, 
            timestamp: new Date(),
            module: 'exchange'
        });
    }

    // ======================= 导入数据（主入口，增强错误处理） =======================
    async importFromFile(file, mergeStrategy = 'fill_blanks') {
        return this.importData(file, 'auto', { mergeStrategy });
    }

    async importData(file, format = 'auto', options = {}) {
        if (this.state.isImporting) {
            throw new Error('当前正在执行导入操作，请等待完成后再试');
        }
        
        if (!file || !(file instanceof File)) {
            throw new Error('请提供有效的文件对象');
        }
        
        // 检查初始化状态
        if (!this.state.isInitialized) {
            const initResult = await this.init();
            if (!initResult.success) {
                throw new Error('数据交换模块初始化失败: ' + (initResult.error || '未知错误'));
            }
        }
        
        try {
            this.state.isImporting = true;
            this.state.lastImportTime = new Date();
            
            // 文件大小检查
            if (file.size > this.config.maxFileSize) {
                throw new Error(`文件大小超过限制 (最大 ${this.dependencies.utils.formatFileSize(this.config.maxFileSize)})`);
            }
            
            // 格式检测
            const detectedFormat = format === 'auto' ? 
                this._detectFileFormat(file) : format;
                
            if (!this.config.importFormats.includes(detectedFormat)) {
                throw new Error(`不支持的导入格式: ${detectedFormat}，支持格式: ${this.config.importFormats.join(', ')}`);
            }
            
            // 触发导入开始回调
            this._triggerCallback('onImportStart', {
                fileName: file.name, 
                format: detectedFormat,
                size: file.size,
                strategy: options.mergeStrategy || 'fill_blanks',
                timestamp: this.state.lastImportTime
            });
            
            this._log(`开始导入数据: ${file.name}, 格式: ${detectedFormat}, 大小: ${this.dependencies.utils.formatFileSize(file.size)}`, 'info');
            
            // 解析文件
            const data = await this._parseImportFile(file, detectedFormat, options);
            
            // 验证数据
            const validation = this._validateImportData(data, options);
            if (validation.invalid > 0 && options.strictValidation) {
                throw new Error(`发现 ${validation.invalid} 条无效记录，导入中止`);
            }
            
            // 数据导入到数据库
            const importResult = await this._smartImportToDatabase(data, options);
            
            // 生成报告
            const importReport = this._generateImportReport(importResult, data);
            
            this.state.isImporting = false;
            
            // 触发导入完成回调
            this._triggerCallback('onImportComplete', {
                fileName: file.name, 
                format: detectedFormat,
                result: importResult, 
                report: importReport,
                timestamp: this.state.lastImportTime
            });
            
            this._log(`✅ 导入完成: ${file.name}, 新增 ${importResult.created} 条, 更新 ${importResult.updated} 条, 跳过 ${importResult.skipped} 条, 失败 ${importResult.failed} 条`, 'success');
            
            return {
                success: true, 
                fileName: file.name, 
                format: detectedFormat,
                stats: importResult,
                report: importReport,
                validation: validation
            };
            
        } catch (error) {
            this.state.isImporting = false;
            this._log(`❌ 导入失败: ${error.message}`, 'error');
            
            this._triggerCallback('onImportError', {
                fileName: file.name, 
                error: error.message, 
                timestamp: new Date()
            });
            
            throw error;
        }
    }

    _detectFileFormat(file) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();
        
        if (fileName.endsWith('.csv') || fileType.includes('csv')) return 'csv';
        if (fileName.endsWith('.json') || fileType.includes('json')) return 'json';
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || 
            fileType.includes('excel') || fileType.includes('spreadsheet')) return 'excel';
        if (fileName.endsWith('.txt') || fileType.includes('text')) return 'txt';
        
        // 默认返回CSV
        return 'csv';
    }

    /**
     * 智能导入到数据库（增强版）
     */
    async _smartImportToDatabase(data, options = {}) {
        const { mergeStrategy = 'fill_blanks', validateBeforeImport = true, 
                showProgress = true, batchSize = this.config.batchSize } = options;
        
        const stats = {
            ...this.importStatsTemplate,
            startTime: Date.now()
        };
        
        const results = { 
            created: [], 
            updated: [], 
            skipped: [], 
            failed: [] 
        };
        
        const totalRecords = data.records.length;
        let processedCount = 0;
        
        const reportProgress = () => {
            const percentage = Math.round((processedCount / totalRecords) * 100);
            const currentTime = Date.now();
            const elapsed = currentTime - stats.startTime;
            const estimatedTotal = totalRecords > 0 ? (elapsed / processedCount) * totalRecords : 0;
            const remaining = Math.max(0, estimatedTotal - elapsed);
            
            this._triggerCallback('onImportProgress', { 
                processed: processedCount, 
                total: totalRecords, 
                percentage: percentage,
                elapsed: elapsed,
                remaining: remaining,
                stats: { ...stats }
            });
        };
        
        try {
            // 设置统一的导入时间
            const importTime = new Date().toISOString();
            
            // 批量处理记录
            for (let i = 0; i < data.records.length; i += batchSize) {
                const batch = data.records.slice(i, i + batchSize);
                
                for (let j = 0; j < batch.length; j++) {
                    const record = batch[j];
                    
                    try {
                        // 验证记录
                        if (validateBeforeImport) {
                            this._validateImportRecord(record);
                        }
                        
                        // 确保有订单号
                        if (!record.orderNumber) {
                            throw new Error('缺少订单号');
                        }
                        
                        // 设置导入时间
                        record.importTime = record.importTime || importTime;
                        
                        // 检查是否已存在
                        const existingResult = await this.dependencies.database.getOrder(record.orderNumber);
                        const existingOrder = existingResult.success ? existingResult.data : null;
                        
                        if (existingOrder) {
                            // 合并策略
                            switch (mergeStrategy) {
                                case 'skip_duplicates':
                                    stats.skipped++;
                                    results.skipped.push(record);
                                    this._log(`跳过重复订单: ${record.orderNumber}`, 'debug');
                                    break;
                                    
                                case 'fill_blanks':
                                    const mergedOrder = { ...existingOrder };
                                    Object.keys(record).forEach(key => {
                                        if (!existingOrder[key] || existingOrder[key] === '' || existingOrder[key] === null) {
                                            mergedOrder[key] = record[key];
                                        }
                                    });
                                    mergedOrder.updatedAt = new Date().toISOString();
                                    
                                    const updateResult = await this.dependencies.database.updateOrder(
                                        record.orderNumber, 
                                        mergedOrder
                                    );
                                    
                                    if (updateResult && updateResult.success) {
                                        stats.updated++;
                                        results.updated.push({ old: existingOrder, new: mergedOrder });
                                    } else {
                                        throw new Error('更新订单失败');
                                    }
                                    break;
                                    
                                case 'update_all':
                                default:
                                    record.updatedAt = new Date().toISOString();
                                    
                                    const updateAllResult = await this.dependencies.database.updateOrder(
                                        record.orderNumber, 
                                        record
                                    );
                                    
                                    if (updateAllResult && updateAllResult.success) {
                                        stats.updated++;
                                        results.updated.push({ old: existingOrder, new: record });
                                    } else {
                                        throw new Error('更新订单失败');
                                    }
                                    break;
                            }
                        } else {
                            // 新订单
                            record.createdAt = record.createdAt || new Date().toISOString();
                            record.updatedAt = record.updatedAt || new Date().toISOString();
                            
                            const addResult = await this.dependencies.database.addOrder(record);
                            
                            if (addResult && addResult.success) {
                                stats.created++;
                                results.created.push(record);
                            } else {
                                throw new Error('添加订单失败');
                            }
                        }
                        
                    } catch (error) {
                        stats.failed++;
                        results.failed.push({
                            record: record,
                            error: error.message
                        });
                        this._log(`❌ 导入失败: ${record.orderNumber} - ${error.message}`, 'error');
                    }
                    
                    processedCount++;
                    
                    // 报告进度
                    if (showProgress && processedCount % 10 === 0) {
                        reportProgress();
                    }
                }
                
                // 批量延迟，避免阻塞UI
                if (i + batchSize < data.records.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            stats.endTime = Date.now();
            stats.duration = stats.endTime - stats.startTime;
            stats.total = totalRecords;
            
            // 最终进度报告
            reportProgress();
            
            this._log(`✅ 导入完成统计: ${stats.created} 新增, ${stats.updated} 更新, ${stats.skipped} 跳过, ${stats.failed} 失败, 耗时 ${stats.duration}ms`, 'info');
            
            return stats;
            
        } catch (error) {
            this._log(`❌ 批量导入失败: ${error.message}`, 'error');
            throw error;
        }
    }

    // ======================= 其他方法保持原样，但使用增强的日志和错误处理 =======================
    
    // ... (原有的大部分方法保持不变，但调用 this._log 和 this._triggerCallback)

    getStatus() {
        return {
            isInitialized: this.state.isInitialized,
            isExporting: this.state.isExporting,
            isImporting: this.state.isImporting,
            lastExportTime: this.state.lastExportTime,
            lastImportTime: this.state.lastImportTime,
            lastBackupTime: this.state.lastBackupTime,
            dependencies: { ...this.state.dependencies },
            config: { ...this.config },
            version: this.version
        };
    }
}

// ============================================
// 模块导出代码 - 修复增强版
// ============================================

// 全局导出
if (typeof window !== 'undefined') {
    // 导出类
    window.ExchangeModule = ExchangeModule;
    
    // 创建全局实例
    const exchangeModule = new ExchangeModule();
    window.exchangeModule = exchangeModule;
    
    // 集成到主系统
    if (window.ReturnUnpackSystem) {
        window.ReturnUnpackSystem.modules = window.ReturnUnpackSystem.modules || {};
        window.ReturnUnpackSystem.modules.exchange = exchangeModule;
        
        // 提供便捷方法
        window.ReturnUnpackSystem.importExcelData = async function(file, options = {}) {
            return exchangeModule.importFromFile(file, options.mergeStrategy || 'fill_blanks');
        };
        
        window.ReturnUnpackSystem.exportData = async function(format = 'excel', options = {}) {
            return exchangeModule.exportData(format, options);
        };
        
        console.log('✅ ExchangeModule (v1.5.0) 已集成到 ReturnUnpackSystem');
    }
    
    console.log('✅ ExchangeModule v1.5.0 已全局导出');
    
    // 提供一个公共初始化函数供index.html调用
    window.initializeExchangeModule = async function() {
        try {
            console.log('🔄 手动初始化 ExchangeModule...');
            
            const dependencies = {};
            
            // 尝试获取Utils模块
            if (window.ReturnUnpackSystem?.modules?.utils) {
                dependencies.utils = window.ReturnUnpackSystem.modules.utils;
                console.log('✅ 使用 ReturnUnpackSystem.utils');
            } else if (window.utilsModule) {
                dependencies.utils = window.utilsModule;
                console.log('✅ 使用全局 utilsModule');
            } else if (window.Utils) {
                dependencies.utils = window.Utils;
                console.log('✅ 使用全局 Utils');
            }
            
            // 尝试获取Database模块
            if (window.ReturnUnpackSystem?.modules?.database) {
                dependencies.database = window.ReturnUnpackSystem.modules.database;
                console.log('✅ 使用 ReturnUnpackSystem.database');
            } else if (window.databaseModule) {
                dependencies.database = window.databaseModule;
                console.log('✅ 使用全局 databaseModule');
            } else if (window.ReturnUnpackSystem?.Database) {
                dependencies.database = window.ReturnUnpackSystem.Database;
                console.log('✅ 使用 ReturnUnpackSystem.Database');
            }
            
            const initResult = await exchangeModule.init(dependencies);
            console.log('ExchangeModule 初始化结果:', initResult);
            return initResult;
            
        } catch (error) {
            console.error('❌ ExchangeModule 初始化失败:', error);
            return { success: false, error: error.message };
        }
    };
    
    // 自动初始化（简化版）
    setTimeout(() => {
        if (!exchangeModule.state.isInitialized) {
            console.log('🔄 ExchangeModule 尝试自动初始化...');
            window.initializeExchangeModule().then(result => {
                if (result.success) {
                    console.log('✅ ExchangeModule 自动初始化成功');
                } else {
                    console.warn('⚠️ ExchangeModule 自动初始化失败，将在使用时尝试初始化');
                }
            });
        }
    }, 3000);
}

// CommonJS 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExchangeModule;
}