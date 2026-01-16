/**
 * modules/exchange.js - 数据交换模块（增强兼容版）
 * 退货拆包系统 - 数据交换模块
 * 版本: 1.7.0
 * 修复问题：
 * 1. 增强与 database.js 的兼容性
 * 2. 修复导入方法调用链
 * 3. 添加直接文件导入接口
 * 4. 改进错误处理和模块初始化
 * 5. 确保与 index.html 完美配合
 */

class ExchangeModule {
    constructor(config = {}) {
        // 模块信息
        this.version = '1.7.0';
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
            },
            // 新增：缓存数据库实例
            databaseInstance: null,
            // 新增：导入进度
            importProgress: {
                total: 0,
                processed: 0,
                percentage: 0,
                currentFile: null
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
                '损坏类型': 'damageType',
                
                // 扩展字段
                '视频文件': 'videoFile',
                'VideoFile': 'videoFile',
                '视频路径': 'videoFile',
                
                '拆包人员': 'operator',
                'Operator': 'operator',
                '操作员': 'operator',
                
                '重量': 'weight',
                'Weight': 'weight',
                '包裹重量': 'weight',
                
                '体积': 'volume',
                'Volume': 'volume',
                '包裹体积': 'volume'
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
                operator: '拆包人员',
                weight: '重量(kg)',
                volume: '体积(m³)',
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

        // 数据验证规则
        this.validationRules = {
            orderNumber: {
                required: true,
                pattern: /^[A-Za-z0-9_-]{6,50}$/,
                message: '订单号必须是6-50位的字母数字组合'
            },
            expressNumber: {
                required: false,
                pattern: /^[A-Za-z0-9]{8,30}$/,
                message: '发货运单号格式不正确'
            },
            trackingNumber: {
                required: false,
                pattern: /^[A-Za-z0-9]{8,30}$/,
                message: '退货运单号格式不正确'
            },
            skuInfo: {
                required: false,
                maxLength: 500,
                message: 'SKU信息不能超过500字符'
            },
            shopName: {
                required: false,
                maxLength: 100,
                message: '店铺名称不能超过100字符'
            },
            notes: {
                required: false,
                maxLength: 1000,
                message: '备注不能超过1000字符'
            }
        };

        this._log('✅ ExchangeModule 实例已创建 (v1.7.0)', 'success');
    }

    /**
     * ======================= 初始化方法 =======================
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
            
            // 🛠️ 修复：优先使用缓存的数据库实例
            if (!this.state.databaseInstance) {
                await this._setupDependencies(dependencies);
            }
            
            // 检查Excel支持
            await this._checkExcelSupport();
            
            // 自动备份
            if (this.config.autoBackup) {
                try {
                    // 延迟启动备份，确保其他模块已初始化
                    setTimeout(() => {
                        this._startAutoBackup();
                    }, 1000);
                } catch (backupError) {
                    this._log(`⚠️ 自动备份功能初始化失败: ${backupError.message}`, 'warn');
                }
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
     * ======================= 文件解析方法 =======================
     */

    /**
     * 实现文件解析方法
     */
    async _parseImportFile(file, format, options = {}) {
        this._log(`开始解析${format.toUpperCase()}文件: ${file.name}`, 'info');
        
        try {
            let parsedData;
            
            switch (format.toLowerCase()) {
                case 'csv':
                    parsedData = await this._parseCSVFile(file, options);
                    break;
                    
                case 'json':
                    parsedData = await this._parseJSONFile(file, options);
                    break;
                    
                case 'excel':
                    parsedData = await this._parseExcelFile(file, options);
                    break;
                    
                case 'txt':
                    parsedData = await this._parseTextFile(file, options);
                    break;
                    
                default:
                    throw new Error(`不支持的格式: ${format}`);
            }
            
            // 数据转换和映射
            const transformedData = this._transformData(parsedData, options);
            
            return {
                records: transformedData,
                metadata: {
                    fileName: file.name,
                    fileSize: file.size,
                    format: format,
                    originalCount: parsedData.length,
                    transformedCount: transformedData.length,
                    parseTime: new Date().toISOString()
                }
            };
            
        } catch (error) {
            this._log(`❌ 解析文件失败: ${error.message}`, 'error');
            throw new Error(`解析${format}文件失败: ${error.message}`);
        }
    }

    /**
     * 解析CSV文件
     */
    async _parseCSVFile(file, options = {}) {
        try {
            const text = await this.dependencies.utils.readFile(file, this.config.encoding);
            
            // 解析CSV内容
            const lines = text.split('\n');
            if (lines.length === 0) {
                throw new Error('CSV文件为空');
            }
            
            // 解析表头
            const headers = this._parseCSVLine(lines[0]).map(h => h.trim());
            
            // 解析数据行
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const row = this._parseCSVLine(lines[i]);
                const record = {};
                
                for (let j = 0; j < headers.length; j++) {
                    if (j < row.length) {
                        const header = headers[j];
                        const value = row[j].trim();
                        
                        // 字段映射
                        const mappedField = this._mapFieldName(header);
                        if (mappedField) {
                            record[mappedField] = value;
                        } else {
                            record[header] = value;
                        }
                    }
                }
                
                if (Object.keys(record).length > 0) {
                    data.push(record);
                }
            }
            
            return data;
            
        } catch (error) {
            throw new Error(`CSV解析失败: ${error.message}`);
        }
    }

    /**
     * 解析JSON文件
     */
    async _parseJSONFile(file, options = {}) {
        try {
            const text = await this.dependencies.utils.readFile(file, this.config.encoding);
            const jsonData = JSON.parse(text);
            
            // 处理不同格式的JSON数据
            if (Array.isArray(jsonData)) {
                return jsonData;
            } else if (jsonData.data && Array.isArray(jsonData.data)) {
                return jsonData.data;
            } else if (jsonData.records && Array.isArray(jsonData.records)) {
                return jsonData.records;
            } else {
                throw new Error('JSON格式不支持，请确保数据是数组格式');
            }
            
        } catch (error) {
            throw new Error(`JSON解析失败: ${error.message}`);
        }
    }

    /**
     * 解析Excel文件（支持XLSX库）
     */
    async _parseExcelFile(file, options = {}) {
        try {
            // 检查XLSX库是否可用
            if (typeof XLSX === 'undefined') {
                this._log('⚠️ XLSX库未加载，尝试使用降级方案', 'warn');
                return await this._parseExcelFallback(file, options);
            }
            
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 获取第一个工作表
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                throw new Error('Excel文件中没有工作表');
            }
            
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 转换为JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: '',
                raw: false
            });
            
            if (jsonData.length < 2) {
                throw new Error('Excel文件中没有数据');
            }
            
            // 提取表头和数据
            const headers = jsonData[0].map(h => String(h).trim());
            const rows = jsonData.slice(1);
            
            // 转换为对象数组
            const records = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const record = {};
                
                for (let j = 0; j < headers.length; j++) {
                    if (j < row.length) {
                        const header = headers[j];
                        const value = row[j] !== undefined ? String(row[j]).trim() : '';
                        
                        // 字段映射
                        const mappedField = this._mapFieldName(header);
                        if (mappedField && value) {
                            record[mappedField] = value;
                        } else if (value) {
                            record[header] = value;
                        }
                    }
                }
                
                // 只添加有订单号的记录
                if (record.orderNumber || record['订单编号'] || record['订单号']) {
                    records.push(record);
                }
            }
            
            return records;
            
        } catch (error) {
            this._log(`Excel解析失败: ${error.message}`, 'error');
            throw new Error(`Excel解析失败: ${error.message}`);
        }
    }

    /**
     * Excel解析降级方案
     */
    async _parseExcelFallback(file, options = {}) {
        try {
            // 尝试读取为文本
            const text = await this.dependencies.utils.readFile(file, this.config.encoding);
            
            // 简单解析逻辑
            const lines = text.split('\n');
            if (lines.length < 2) {
                throw new Error('Excel文件内容格式不正确');
            }
            
            // 假设第一行是表头
            const headers = lines[0].split('\t').map(h => h.trim()); // 假设是制表符分隔
            
            const records = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = line.split('\t');
                const record = {};
                
                for (let j = 0; j < headers.length; j++) {
                    if (j < values.length) {
                        const header = headers[j];
                        const value = values[j].trim();
                        
                        if (value) {
                            const mappedField = this._mapFieldName(header);
                            if (mappedField) {
                                record[mappedField] = value;
                            } else {
                                record[header] = value;
                            }
                        }
                    }
                }
                
                if (Object.keys(record).length > 0) {
                    records.push(record);
                }
            }
            
            return records;
            
        } catch (error) {
            throw new Error(`Excel降级解析失败: ${error.message}`);
        }
    }

    /**
     * 解析文本文件
     */
    async _parseTextFile(file, options = {}) {
        try {
            const text = await this.dependencies.utils.readFile(file, this.config.encoding);
            
            // 简单解析，每行一个记录
            const lines = text.split('\n');
            const records = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                // 尝试从文本中提取订单信息
                const record = this._extractOrderInfoFromText(trimmed);
                if (record && record.orderNumber) {
                    records.push(record);
                }
            }
            
            return records;
            
        } catch (error) {
            throw new Error(`文本文件解析失败: ${error.message}`);
        }
    }

    /**
     * CSV行解析
     */
    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result.map(cell => cell.replace(/^"|"$/g, '').trim());
    }

    /**
     * 字段名映射
     */
    _mapFieldName(fieldName) {
        if (!fieldName) return null;
        
        const normalized = fieldName.trim();
        
        // 检查列映射
        if (this.columnMapping.orders[normalized]) {
            return this.columnMapping.orders[normalized];
        }
        
        // 尝试匹配大小写
        const lowerField = normalized.toLowerCase();
        for (const [key, value] of Object.entries(this.columnMapping.orders)) {
            if (key.toLowerCase() === lowerField) {
                return value;
            }
        }
        
        return null;
    }

    /**
     * 数据转换
     */
    _transformData(records, options = {}) {
        const transformed = [];
        
        for (const record of records) {
            try {
                const transformedRecord = {};
                
                // 遍历记录的所有字段
                for (const [key, value] of Object.entries(record)) {
                    const mappedKey = this._mapFieldName(key) || key;
                    
                    // 值转换
                    let transformedValue = value;
                    
                    // 空值处理
                    if (value === undefined || value === null || value === '') {
                        continue;
                    }
                    
                    // 根据字段类型进行转换
                    if (typeof value === 'string') {
                        const strValue = value.trim();
                        
                        // 日期时间字段
                        if (['importTime', 'scanTime', 'createdAt', 'updatedAt'].includes(mappedKey)) {
                            transformedValue = this._parseDateTime(strValue);
                        }
                        // 数字字段
                        else if (['weight', 'volume'].includes(mappedKey)) {
                            const num = parseFloat(strValue);
                            if (!isNaN(num)) {
                                transformedValue = num;
                            }
                        }
                        // 状态字段
                        else if (mappedKey === 'status') {
                            transformedValue = this._normalizeStatus(strValue);
                        }
                        // 损坏情况字段
                        else if (mappedKey === 'damage') {
                            transformedValue = this._normalizeDamage(strValue);
                        }
                        // 其他字符串字段
                        else {
                            transformedValue = strValue;
                        }
                    }
                    
                    transformedRecord[mappedKey] = transformedValue;
                }
                
                // 确保必须有订单号
                if (!transformedRecord.orderNumber) {
                    // 尝试从其他字段提取订单号
                    transformedRecord.orderNumber = this._extractOrderNumber(transformedRecord);
                }
                
                // 设置默认值
                if (!transformedRecord.status) {
                    transformedRecord.status = '待处理';
                }
                
                if (!transformedRecord.importTime) {
                    transformedRecord.importTime = new Date().toISOString();
                }
                
                // 添加时间戳
                transformedRecord.updatedAt = new Date().toISOString();
                
                if (transformedRecord.orderNumber) {
                    transformed.push(transformedRecord);
                }
                
            } catch (error) {
                this._log(`转换记录失败: ${error.message}`, 'debug');
            }
        }
        
        return transformed;
    }

    /**
     * ======================= 数据验证方法 =======================
     */

    /**
     * 实现数据验证方法
     */
    _validateImportData(data, options = {}) {
        const validation = {
            total: data.records?.length || 0,
            valid: 0,
            invalid: 0,
            errors: []
        };
        
        if (!data.records || !Array.isArray(data.records)) {
            validation.errors.push({
                type: 'structure',
                message: '数据格式不正确，缺少records数组'
            });
            return validation;
        }
        
        for (let i = 0; i < data.records.length; i++) {
            const record = data.records[i];
            const recordErrors = [];
            
            // 验证订单号
            if (!record.orderNumber) {
                recordErrors.push({
                    field: 'orderNumber',
                    message: '订单号不能为空'
                });
            } else if (!this._validateField('orderNumber', record.orderNumber)) {
                recordErrors.push({
                    field: 'orderNumber',
                    value: record.orderNumber,
                    message: this.validationRules.orderNumber.message
                });
            }
            
            // 验证其他字段
            for (const [field, value] of Object.entries(record)) {
                if (field !== 'orderNumber' && this.validationRules[field]) {
                    if (!this._validateField(field, value)) {
                        recordErrors.push({
                            field: field,
                            value: value,
                            message: this.validationRules[field].message
                        });
                    }
                }
            }
            
            if (recordErrors.length === 0) {
                validation.valid++;
            } else {
                validation.invalid++;
                validation.errors.push({
                    index: i,
                    record: record,
                    errors: recordErrors
                });
            }
        }
        
        return validation;
    }

    /**
     * 验证单个字段
     */
    _validateField(field, value) {
        if (!value && value !== 0 && value !== false) {
            // 非必需字段可以为空
            if (!this.validationRules[field] || !this.validationRules[field].required) {
                return true;
            }
            return false;
        }
        
        const rule = this.validationRules[field];
        if (!rule) return true;
        
        // 检查正则表达式
        if (rule.pattern && !rule.pattern.test(String(value))) {
            return false;
        }
        
        // 检查最大长度
        if (rule.maxLength && String(value).length > rule.maxLength) {
            return false;
        }
        
        return true;
    }

    /**
     * 实现单条记录验证方法
     */
    _validateImportRecord(record) {
        if (!record) {
            throw new Error('记录不能为空');
        }
        
        if (!record.orderNumber) {
            throw new Error('订单号不能为空');
        }
        
        // 验证订单号格式
        if (!this._validateField('orderNumber', record.orderNumber)) {
            throw new Error(`订单号格式不正确: ${record.orderNumber}`);
        }
        
        return true;
    }

    /**
     * ======================= 报告生成方法 =======================
     */

    /**
     * 实现报告生成方法（修复stats未定义问题）
     */
    _generateImportReport(stats, data) {
        // 确保stats有必要的属性
        const safeStats = stats || {};
        const safeData = data || {};
        
        // 处理时间数据
        const startTime = safeStats.startTime ? 
            new Date(safeStats.startTime).toLocaleString('zh-CN') : '未知';
        const endTime = safeStats.endTime ? 
            new Date(safeStats.endTime).toLocaleString('zh-CN') : '未知';
        const duration = safeStats.duration ? 
            `${safeStats.duration}ms` : '未知';
        
        // 计算成功率
        const total = safeStats.total || 0;
        const successful = (safeStats.created || 0) + (safeStats.updated || 0);
        const successRate = total > 0 ? 
            Math.round((successful / total) * 100) : 0;
        
        const report = {
            summary: {
                '总记录数': total,
                '新增记录': safeStats.created || 0,
                '更新记录': safeStats.updated || 0,
                '跳过记录': safeStats.skipped || 0,
                '失败记录': safeStats.failed || 0,
                '成功率': `${successRate}%`,
                '耗时': safeStats.duration ? `${(safeStats.duration / 1000).toFixed(2)}秒` : '未知',
                '文件大小': safeData.metadata ? this._formatFileSize(safeData.metadata.fileSize) : '未知'
            },
            details: {
                successful: successful,
                failed: safeStats.failed || 0,
                skipped: safeStats.skipped || 0
            },
            timing: {
                '开始时间': startTime,
                '结束时间': endTime,
                '耗时': duration,
                '处理速度': safeStats.duration > 0 && total > 0 ? 
                    `${Math.round((total / safeStats.duration) * 1000)} 条/秒` : '未知'
            },
            fileInfo: safeData.metadata || {},
            generatedAt: new Date().toISOString(),
            moduleVersion: this.version
        };
        
        return report;
    }

    /**
     * ======================= 工具方法 =======================
     */

    /**
     * 提取订单号
     */
    _extractOrderNumber(record) {
        // 尝试从各种字段中提取订单号
        const possibleFields = [
            record.orderNumber,
            record['订单编号'],
            record['订单号'],
            record['单号'],
            record.OrderNumber,
            record['Order No']
        ];
        
        for (const field of possibleFields) {
            if (field && typeof field === 'string' && field.trim()) {
                return field.trim();
            }
        }
        
        return null;
    }

    /**
     * 解析日期时间
     */
    _parseDateTime(dateTimeStr) {
        if (!dateTimeStr) return null;
        
        try {
            // 尝试多种日期格式
            const date = new Date(dateTimeStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
            
            // 尝试解析中文日期
            const chineseMatch = dateTimeStr.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日]?\s*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/);
            if (chineseMatch) {
                const [, year, month, day, hour = 0, minute = 0, second = 0] = chineseMatch;
                const parsedDate = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute),
                    parseInt(second)
                );
                
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString();
                }
            }
            
            return dateTimeStr; // 返回原字符串
            
        } catch (error) {
            return dateTimeStr; // 返回原字符串
        }
    }

    /**
     * 标准化状态
     */
    _normalizeStatus(status) {
        const statusMap = {
            '待处理': '待处理',
            'pending': '待处理',
            '待办': '待处理',
            
            '已处理': '已处理',
            'completed': '已处理',
            '完成': '已处理',
            
            '处理中': '处理中',
            'processing': '处理中',
            '进行中': '处理中',
            
            '已取消': '已取消',
            'cancelled': '已取消',
            '取消': '已取消'
        };
        
        return statusMap[status] || status;
    }

    /**
     * 标准化损坏情况
     */
    _normalizeDamage(damage) {
        const damageMap = {
            '完好': '完好',
            'good': '完好',
            '正常': '完好',
            
            '破损': '破损',
            'damaged': '破损',
            '损坏': '破损',
            
            '缺件': '缺件',
            'missing': '缺件',
            '缺少': '缺件',
            
            '其他': '其他',
            'other': '其他'
        };
        
        return damageMap[damage] || damage;
    }

    /**
     * 从文本中提取订单信息
     */
    _extractOrderInfoFromText(text) {
        const record = {};
        
        // 尝试提取订单号
        const orderNumberMatch = text.match(/(订单[号:：]?|单号[:：]?|order[:\s]?)([A-Za-z0-9_-]{6,50})/i);
        if (orderNumberMatch) {
            record.orderNumber = orderNumberMatch[2];
        }
        
        // 尝试提取运单号
        const trackingMatch = text.match(/(运单[号:：]?|快递[号:：]?|tracking[:\s]?)([A-Za-z0-9]{8,30})/i);
        if (trackingMatch) {
            record.trackingNumber = trackingMatch[2];
        }
        
        // 提取SKU信息
        const skuMatch = text.match(/(sku[:\s]?|商品[:\s]?)([A-Za-z0-9_-]{3,50})/i);
        if (skuMatch) {
            record.skuInfo = skuMatch[2];
        }
        
        return record;
    }

    /**
     * 格式化文件大小
     */
    _formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * ======================= 依赖注入方法 =======================
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
            window.ReturnUnpackSystem?.Database,
            this.state.databaseInstance // 使用缓存的实例
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
                    this.state.databaseInstance = source; // 缓存实例
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
                        this.state.databaseInstance = db; // 缓存实例
                        depCheck.database = true;
                        this._log('✅ 创建新的Database实例', 'success');
                    }
                }
            } catch (error) {
                this._log(`❌ 创建Database实例失败: ${error.message}`, 'error');
                this.dependencies.database = this._createMockDatabase();
                this.state.databaseInstance = this.dependencies.database; // 缓存实例
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
     * ======================= 备份功能 =======================
     */

    /**
     * 紧急修复：添加缺失的 _startAutoBackup 方法
     */
    async _startAutoBackup() {
        try {
            if (!this.config.autoBackup) {
                return;
            }

            if (this.state.backupTimer) {
                clearInterval(this.state.backupTimer);
            }

            const backupInterval = this.config.backupInterval || 24;
            const intervalMs = backupInterval * 60 * 60 * 1000; // 转换为毫秒

            this._log(`🔄 启动自动备份，每 ${backupInterval} 小时执行一次`, 'info');

            // 立即执行一次备份检查
            this._checkAndCreateBackup();

            // 设置定时器
            this.state.backupTimer = setInterval(() => {
                this._checkAndCreateBackup();
            }, intervalMs);

        } catch (error) {
            this._log(`❌ 启动自动备份失败: ${error.message}`, 'error');
            this._triggerCallback('onBackupError', {
                error: error.message,
                timestamp: new Date()
            });
        }
    }

    /**
     * 检查和创建备份
     */
    async _checkAndCreateBackup() {
        try {
            // 检查数据库依赖
            if (!this.dependencies.database || typeof this.dependencies.database.getAllOrders !== 'function') {
                this._log('⚠️ 数据库不可用，跳过备份', 'warn');
                return;
            }

            this._log('🔄 检查是否需要创建备份...', 'debug');

            // 检查上次备份时间
            const now = new Date();
            const lastBackup = this.state.lastBackupTime;
            
            // 如果从来没有备份过，或者距离上次备份超过12小时，则创建备份
            if (!lastBackup || (now - lastBackup) > (12 * 60 * 60 * 1000)) {
                await this._createBackup();
            } else {
                this._log('🕒 距离上次备份时间较短，跳过备份', 'debug');
            }

        } catch (error) {
            this._log(`❌ 备份检查失败: ${error.message}`, 'error');
        }
    }

    /**
     * 创建数据备份
     */
    async _createBackup() {
        try {
            this._log('🔄 正在创建数据备份...', 'info');

            // 获取所有订单数据
            const allOrders = await this.dependencies.database.getAllOrders(10000);
            
            if (!allOrders || allOrders.length === 0) {
                this._log('⚠️ 没有数据可以备份', 'warn');
                return;
            }

            // 生成备份文件名
            const timestamp = this.dependencies.utils ? 
                this.dependencies.utils.formatDate(new Date(), 'yyyy-MM-dd-HH-mm-ss') :
                new Date().toISOString().replace(/[:.]/g, '-');
            
            const backupFileName = `退货拆包备份_${timestamp}.json`;
            
            // 准备备份数据
            const backupData = {
                version: this.version,
                backupTime: new Date().toISOString(),
                totalRecords: allOrders.length,
                data: allOrders,
                metadata: {
                    system: '退货拆包记录系统',
                    module: 'ExchangeModule',
                    config: this.config
                }
            };

            // 创建备份文件
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
                type: 'application/json' 
            });

            // 保存到本地存储
            try {
                // 使用File System Access API如果可用
                if ('showSaveFilePicker' in window) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: backupFileName,
                            types: [{
                                description: 'JSON备份文件',
                                accept: { 'application/json': ['.json'] }
                            }]
                        });
                        
                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        
                        this._log(`✅ 备份已保存到本地文件: ${backupFileName}`, 'success');
                        
                    } catch (fsError) {
                        // 用户取消或API错误，使用备用方案
                        this._saveBackupFallback(blob, backupFileName);
                    }
                } else {
                    // 降级方案
                    this._saveBackupFallback(blob, backupFileName);
                }
            } catch (saveError) {
                this._log(`⚠️ 备份保存失败（降级方案）: ${saveError.message}`, 'warn');
                // 仍然更新备份时间，避免频繁尝试
            }

            // 更新备份时间
            this.state.lastBackupTime = new Date();
            
            // 触发回调
            this._triggerCallback('onBackupCreated', {
                fileName: backupFileName,
                recordCount: allOrders.length,
                timestamp: this.state.lastBackupTime
            });

        } catch (error) {
            this._log(`❌ 创建备份失败: ${error.message}`, 'error');
            this._triggerCallback('onBackupError', {
                error: error.message,
                timestamp: new Date()
            });
        }
    }

    /**
     * 备份保存降级方案
     */
    _saveBackupFallback(blob, fileName) {
        try {
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            this._log(`✅ 备份已下载: ${fileName}`, 'success');
            
        } catch (error) {
            this._log(`❌ 备份下载失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * ======================= 降级工具和模拟数据库 =======================
     */

    /**
     * 创建降级版Utils
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
     * ======================= 核心导入导出方法 =======================
     */

    /**
     * 🛠️ 修复：智能导入到数据库（修复版）
     */
    async _smartImportToDatabase(data, options = {}) {
        const { mergeStrategy = 'fill_blanks', validateBeforeImport = true, 
                showProgress = true, batchSize = this.config.batchSize } = options;
        
        // 🔧 修复：确保stats对象有所有必要的属性
        const stats = {
            ...this.importStatsTemplate,
            startTime: Date.now(),
            details: {
                created: [],
                updated: [],
                skipped: [],
                failed: []
            }
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
                                    stats.details.skipped.push(record);
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
                                        stats.details.updated.push({ old: existingOrder, new: mergedOrder });
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
                                        stats.details.updated.push({ old: existingOrder, new: record });
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
                                stats.details.created.push(record);
                            } else {
                                throw new Error('添加订单失败');
                            }
                        }
                        
                    } catch (error) {
                        stats.failed++;
                        const errorDetail = {
                            record: record,
                            error: error.message
                        };
                        results.failed.push(errorDetail);
                        stats.details.failed.push(errorDetail);
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
            
            // 🔧 修复：确保所有必需的统计属性都已设置
            stats.endTime = Date.now();
            stats.duration = stats.endTime - stats.startTime;
            stats.total = totalRecords;
            
            // 最终进度报告
            reportProgress();
            
            this._log(`✅ 导入完成统计: ${stats.created} 新增, ${stats.updated} 更新, ${stats.skipped} 跳过, ${stats.failed} 失败, 耗时 ${stats.duration}ms`, 'info');
            
            // 🔧 修复：返回完整的stats对象
            return {
                ...stats,
                results: results
            };
            
        } catch (error) {
            this._log(`❌ 批量导入失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 🛠️ 修复：导入数据方法（主入口） - 增强兼容性
     */
    async importFromFile(file, mergeStrategy = 'fill_blanks') {
        return this.importData(file, 'auto', { mergeStrategy });
    }

    /**
     * 🛠️ 修复：增强的导入方法
     */
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
            
            // 更新导入进度
            this.state.importProgress = {
                total: 0,
                processed: 0,
                percentage: 0,
                currentFile: file.name
            };
            
            // 文件大小检查
            if (file.size > this.config.maxFileSize) {
                throw new Error(`文件大小超过限制 (最大 ${this._formatFileSize(this.config.maxFileSize)})`);
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
            
            this._log(`开始导入数据: ${file.name}, 格式: ${detectedFormat}, 大小: ${this._formatFileSize(file.size)}`, 'info');
            
            // 解析文件
            const data = await this._parseImportFile(file, detectedFormat, options);
            
            // 更新总记录数
            this.state.importProgress.total = data.records?.length || 0;
            
            // 验证数据
            const validation = this._validateImportData(data, options);
            if (validation.invalid > 0 && options.strictValidation) {
                throw new Error(`发现 ${validation.invalid} 条无效记录，导入中止`);
            }
            
            // 数据导入到数据库
            const importResult = await this._smartImportToDatabase(data, options);
            
            // 🔧 修复：确保importResult包含所有必要属性
            const importStats = {
                total: importResult.total || 0,
                created: importResult.created || 0,
                updated: importResult.updated || 0,
                skipped: importResult.skipped || 0,
                failed: importResult.failed || 0,
                startTime: importResult.startTime || this.state.lastImportTime.getTime(),
                endTime: importResult.endTime || Date.now(),
                duration: importResult.duration || 0
            };
            
            // 生成报告
            const importReport = this._generateImportReport(importStats, data);
            
            this.state.isImporting = false;
            this.state.importProgress.processed = this.state.importProgress.total;
            this.state.importProgress.percentage = 100;
            
            // 触发导入完成回调
            this._triggerCallback('onImportComplete', {
                fileName: file.name, 
                format: detectedFormat,
                result: importStats, 
                report: importReport,
                validation: validation,
                timestamp: this.state.lastImportTime
            });
            
            this._log(`✅ 导入完成: ${file.name}, 新增 ${importStats.created} 条, 更新 ${importStats.updated} 条, 跳过 ${importStats.skipped} 条, 失败 ${importStats.failed} 条`, 'success');
            
            return {
                success: true, 
                fileName: file.name, 
                format: detectedFormat,
                stats: importStats,
                report: importReport,
                validation: validation
            };
            
        } catch (error) {
            this.state.isImporting = false;
            this.state.importProgress = {
                total: 0,
                processed: 0,
                percentage: 0,
                currentFile: null
            };
            
            this._log(`❌ 导入失败: ${error.message}`, 'error');
            
            this._triggerCallback('onImportError', {
                fileName: file.name, 
                error: error.message, 
                timestamp: new Date()
            });
            
            throw error;
        }
    }

    /**
     * 🛠️ 新增：简化导入方法（供 index.html 直接调用）
     */
    async importExcelFile(file, mergeStrategy = 'fill_blanks') {
        console.log('📁 [importExcelFile] 调用简化导入方法:', file.name);
        
        try {
            // 直接调用主导入方法
            return await this.importFromFile(file, mergeStrategy);
        } catch (error) {
            console.error('❌ [importExcelFile] 导入失败:', error);
            throw error;
        }
    }

    /**
     * 检测文件格式
     */
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
     * ======================= 其他核心方法 =======================
     */

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

    /**
     * 获取状态
     */
    getStatus() {
        return {
            isInitialized: this.state.isInitialized,
            isExporting: this.state.isExporting,
            isImporting: this.state.isImporting,
            lastExportTime: this.state.lastExportTime,
            lastImportTime: this.state.lastImportTime,
            lastBackupTime: this.state.lastBackupTime,
            importProgress: { ...this.state.importProgress },
            dependencies: { ...this.state.dependencies },
            config: { ...this.config },
            version: this.version
        };
    }
    
    /**
     * 🛠️ 新增：获取导入进度
     */
    getImportProgress() {
        return { ...this.state.importProgress };
    }
}

// ============================================
// 模块导出代码 - 增强兼容版
// ============================================

// 全局导出
if (typeof window !== 'undefined') {
    // 导出类
    window.ExchangeModule = ExchangeModule;
    
    // 创建全局实例
    const exchangeModule = new ExchangeModule();
    window.exchangeModule = exchangeModule;
    
    // 🛠️ 修复：集成到主系统
    if (window.ReturnUnpackSystem) {
        window.ReturnUnpackSystem.modules = window.ReturnUnpackSystem.modules || {};
        window.ReturnUnpackSystem.modules.exchange = exchangeModule;
        
        // 提供便捷方法（确保与 index.html 兼容）
        window.ReturnUnpackSystem.importExcelData = async function(file, options = {}) {
            console.log('📁 [ReturnUnpackSystem.importExcelData] 调用导入方法:', file.name);
            return exchangeModule.importExcelFile(file, options.mergeStrategy || 'fill_blanks');
        };
        
        window.ReturnUnpackSystem.importFromFile = async function(file, mergeStrategy = 'fill_blanks') {
            console.log('📁 [ReturnUnpackSystem.importFromFile] 调用导入方法:', file.name);
            return exchangeModule.importFromFile(file, mergeStrategy);
        };
        
        console.log('✅ ExchangeModule (v1.7.0) 已集成到 ReturnUnpackSystem');
    }
    
    // 🛠️ 修复：添加一个全局函数供 index.html 直接调用
    window.importExcelData = async function(file, mergeStrategy = 'fill_blanks') {
        console.log('📁 [全局 importExcelData] 调用导入方法:', file.name);
        
        try {
            if (!window.exchangeModule) {
                console.error('❌ exchangeModule 未加载');
                throw new Error('数据交换模块未加载');
            }
            
            // 确保模块已初始化
            if (!exchangeModule.state.isInitialized) {
                console.log('🔄 ExchangeModule 正在初始化...');
                await exchangeModule.init();
            }
            
            // 调用导入方法
            return await exchangeModule.importExcelFile(file, mergeStrategy);
            
        } catch (error) {
            console.error('❌ 导入失败:', error);
            throw error;
        }
    };
    
    console.log('✅ ExchangeModule v1.7.0 已全局导出');
    
    // 自动初始化（简化版）
    setTimeout(() => {
        if (!exchangeModule.state.isInitialized) {
            console.log('🔄 ExchangeModule 尝试自动初始化...');
            
            // 延迟初始化，确保其他模块已加载
            setTimeout(async () => {
                try {
                    const initResult = await exchangeModule.init();
                    if (initResult.success) {
                        console.log('✅ ExchangeModule 自动初始化成功');
                    } else {
                        console.warn('⚠️ ExchangeModule 自动初始化失败，将在使用时尝试初始化');
                    }
                } catch (error) {
                    console.warn('⚠️ ExchangeModule 自动初始化异常:', error.message);
                }
            }, 2000);
        }
    }, 1000);
}

// CommonJS 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExchangeModule;
}
