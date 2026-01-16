/**
 * 数据库模块 - 退货拆包记录系统
 * 修复版 v2.0.0
 * 修复问题:
 * 1. 添加完整的分页功能（问题3）
 * 2. 修复筛选功能（问题4）
 * 3. 修复时间字段错误（问题5）- 区分导入时间和扫描时间
 * 4. 添加分页统计和筛选统计
 */

class DatabaseModule {
    constructor() {
        this.version = '2.0.0';
        this.dbName = 'ReturnUnpackingDB';
        this.dbVersion = 4; // 增加版本号以触发升级（添加新字段）
        this.db = null;
        this.isInitialized = false;
        
        console.log(`✅ DatabaseModule v${this.version} 初始化`);
    }
    
    /**
     * 初始化数据库
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initialize() {
        if (this.isInitialized && this.db) {
            console.log('🔄 数据库已初始化，跳过重复初始化');
            return true;
        }
        
        if (!this._isIndexedDBSupported()) {
            console.error('❌ 浏览器不支持 IndexedDB');
            return false;
        }
        
        try {
            return new Promise((resolve, reject) => {
                console.log(`📂 正在打开数据库: ${this.dbName} (版本: ${this.dbVersion})`);
                
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = (event) => {
                    console.error('❌ 数据库打开失败:', event.target.error);
                    reject(new Error(`数据库初始化失败: ${event.target.error?.message || '未知错误'}`));
                };
                
                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    this.isInitialized = true;
                    
                    console.log('✅ 数据库连接成功');
                    console.log('📊 数据库信息:', {
                        名称: this.db.name,
                        版本: this.db.version,
                        对象存储: Array.from(this.db.objectStoreNames)
                    });
                    
                    this.db.onversionchange = () => {
                        console.log('🔄 数据库版本已变更，正在重新连接...');
                        this.db.close();
                        this.isInitialized = false;
                    };
                    
                    resolve(true);
                };
                
                request.onupgradeneeded = (event) => {
                    console.log('🔄 数据库升级/创建');
                    console.log(`🔄 旧版本: ${event.oldVersion} → 新版本: ${event.newVersion}`);
                    
                    const db = event.target.result;
                    
                    if (!db.objectStoreNames.contains('orders')) {
                        console.log('📦 创建 orders 表');
                        const ordersStore = db.createObjectStore('orders', {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        
                        // 创建所有需要的索引
                        console.log('🔧 创建 orders 表索引...');
                        ordersStore.createIndex('orderNumber', 'orderNumber', { unique: true });
                        console.log('✅ 创建 orderNumber 索引 (唯一)');
                        
                        ordersStore.createIndex('expressNumber', 'expressNumber', { unique: false });
                        ordersStore.createIndex('trackingNumber', 'trackingNumber', { unique: false });
                        ordersStore.createIndex('importTime', 'importTime', { unique: false }); // 导入时间索引
                        ordersStore.createIndex('scanTime', 'scanTime', { unique: false });     // 扫描时间索引
                        ordersStore.createIndex('status', 'status', { unique: false });
                        ordersStore.createIndex('damage', 'damage', { unique: false });
                        ordersStore.createIndex('videoFile', 'videoFile', { unique: false });
                        ordersStore.createIndex('shopName', 'shopName', { unique: false });
                        ordersStore.createIndex('skuInfo', 'skuInfo', { unique: false });
                        ordersStore.createIndex('createdAt', 'createdAt', { unique: false });
                        ordersStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                        
                        console.log('✅ 所有索引创建完成');
                    } else {
                        console.log('📦 orders 表已存在');
                        const transaction = event.currentTarget.transaction;
                        const ordersStore = transaction.objectStore('orders');
                        
                        const existingIndexes = Array.from(ordersStore.indexNames);
                        console.log('📊 现有索引:', existingIndexes);
                        
                        // 确保所有需要的索引都存在
                        const requiredIndexes = [
                            'orderNumber', 'expressNumber', 'trackingNumber', 'importTime',
                            'scanTime', 'status', 'damage', 'videoFile', 'shopName', 
                            'skuInfo', 'createdAt', 'updatedAt'
                        ];
                        
                        requiredIndexes.forEach(indexName => {
                            if (!existingIndexes.includes(indexName)) {
                                try {
                                    ordersStore.createIndex(indexName, indexName, { 
                                        unique: indexName === 'orderNumber' 
                                    });
                                    console.log(`✅ 添加 ${indexName} 索引`);
                                } catch (e) {
                                    console.log(`ℹ️ ${indexName} 索引创建失败:`, e.message);
                                }
                            } else {
                                console.log(`✅ ${indexName} 索引已存在`);
                            }
                        });
                        
                        // 🛠️ 修复：检查并添加新字段（如果旧版本需要）
                        if (event.oldVersion < 4) {
                            console.log('🔄 正在升级数据结构 (v3 -> v4)...');
                            // 字段将通过规范化函数处理，这里主要确保索引
                        }
                    }
                    
                    if (!db.objectStoreNames.contains('stats')) {
                        console.log('📊 创建 stats 表');
                        db.createObjectStore('stats', { keyPath: 'date' });
                    }
                    
                    if (!db.objectStoreNames.contains('settings')) {
                        console.log('⚙️ 创建 settings 表');
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                    
                    if (!db.objectStoreNames.contains('importHistory')) {
                        console.log('📋 创建 importHistory 表');
                        db.createObjectStore('importHistory', {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                    }
                    
                    console.log('🎉 数据库升级完成');
                };
            });
        } catch (error) {
            console.error('❌ 数据库初始化异常:', error);
            return false;
        }
    }
    
    /**
     * 检查浏览器是否支持 IndexedDB
     */
    _isIndexedDBSupported() {
        const supported = 'indexedDB' in window;
        console.log(`🔍 IndexedDB支持: ${supported}`);
        return supported;
    }
    
    /**
     * 生成唯一ID
     */
    _generateId(prefix = 'id_') {
        return prefix + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 🛠️ 修复：查询订单记录
     * @param {string} orderNumber 订单号
     * @returns {Promise<Object>} 订单数据
     */
    async getOrder(orderNumber) {
        console.log(`🔍 [getOrder] 请求查询订单:`, { 
            orderNumber, 
            type: typeof orderNumber,
            trimmed: orderNumber ? orderNumber.trim() : '空'
        });
        
        // 🛠️ 修复：详细的参数验证
        if (!orderNumber) {
            console.error('❌ [getOrder] 订单号参数为空');
            return {
                success: false,
                message: '订单号参数为空',
                data: null,
                error: 'EMPTY_ORDER_NUMBER'
            };
        }
        
        if (typeof orderNumber !== 'string') {
            console.error('❌ [getOrder] 订单号参数类型错误:', typeof orderNumber);
            return {
                success: false,
                message: `订单号参数类型错误，应为字符串，实际为: ${typeof orderNumber}`,
                data: null,
                error: 'INVALID_ORDER_NUMBER_TYPE'
            };
        }
        
        const trimmedOrderNumber = orderNumber.trim();
        if (trimmedOrderNumber === '') {
            console.error('❌ [getOrder] 订单号参数为空字符串');
            return {
                success: false,
                message: '订单号参数为空字符串',
                data: null,
                error: 'EMPTY_STRING_ORDER_NUMBER'
            };
        }
        
        if (!await this.initialize()) {
            console.error('❌ [getOrder] 数据库未初始化');
            return {
                success: false,
                message: '数据库未初始化',
                data: null,
                error: 'DATABASE_NOT_INITIALIZED'
            };
        }
        
        console.log(`🔍 [getOrder] 正在查询订单: "${trimmedOrderNumber}"`);
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['orders'], 'readonly');
                const store = transaction.objectStore('orders');
                
                // 检查索引是否存在
                const indexNames = Array.from(store.indexNames);
                console.log(`📊 [getOrder] 可用索引:`, indexNames);
                
                if (!indexNames.includes('orderNumber')) {
                    console.error('❌ [getOrder] orderNumber 索引不存在');
                    console.log('🔄 [getOrder] 尝试使用主键查询...');
                    
                    // 尝试直接使用 getAll 然后筛选
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = (event) => {
                        const allOrders = event.target.result || [];
                        console.log(`📋 [getOrder] 获取到 ${allOrders.length} 条订单`);
                        
                        const foundOrder = allOrders.find(order => 
                            order.orderNumber && order.orderNumber.toString() === trimmedOrderNumber
                        );
                        
                        if (foundOrder) {
                            console.log(`✅ [getOrder] 通过筛选找到订单: ${trimmedOrderNumber}`, {
                                id: foundOrder.id,
                                shopName: foundOrder.shopName,
                                status: foundOrder.status,
                                importTime: foundOrder.importTime,
                                scanTime: foundOrder.scanTime
                            });
                            resolve({
                                success: true,
                                data: foundOrder
                            });
                        } else {
                            console.log(`ℹ️ [getOrder] 未找到订单: ${trimmedOrderNumber}`);
                            resolve({
                                success: false,
                                message: '订单不存在',
                                data: null,
                                error: 'ORDER_NOT_FOUND'
                            });
                        }
                    };
                    
                    getAllRequest.onerror = (event) => {
                        console.error('❌ [getOrder] 查询失败:', event.target.error);
                        resolve({
                            success: false,
                            message: `查询失败: ${event.target.error?.message || '未知错误'}`,
                            data: null,
                            error: 'QUERY_ERROR'
                        });
                    };
                    
                    return;
                }
                
                const index = store.index('orderNumber');
                console.log(`🔍 [getOrder] 使用索引查询: ${trimmedOrderNumber}`);
                
                const request = index.get(trimmedOrderNumber);
                
                request.onsuccess = (event) => {
                    const order = event.target.result;
                    if (order) {
                        console.log(`✅ [getOrder] 找到订单: ${trimmedOrderNumber}`, {
                            id: order.id,
                            shopName: order.shopName,
                            status: order.status,
                            damage: order.damage || order.damageType,
                            importTime: order.importTime,
                            scanTime: order.scanTime,
                            hasVideo: !!(order.videoFile || order.videoData)
                        });
                        resolve({
                            success: true,
                            data: order
                        });
                    } else {
                        console.log(`ℹ️ [getOrder] 未找到订单: ${trimmedOrderNumber}`);
                        resolve({
                            success: false,
                            message: '订单不存在',
                            data: null,
                            error: 'ORDER_NOT_FOUND'
                        });
                    }
                };
                
                request.onerror = (event) => {
                    console.error('❌ [getOrder] 索引查询失败:', {
                        error: event.target.error,
                        orderNumber: trimmedOrderNumber,
                        errorCode: event.target.error?.code,
                        errorName: event.target.error?.name
                    });
                    
                    // 检查是否是无效键错误
                    if (event.target.error && event.target.error.name === 'DataError') {
                        console.error('❌ [getOrder] 无效的键值参数，检查订单号格式');
                        resolve({
                            success: false,
                            message: '无效的订单号格式',
                            data: null,
                            error: 'INVALID_KEY_FORMAT'
                        });
                    } else {
                        resolve({
                            success: false,
                            message: `查询失败: ${event.target.error?.message || '未知错误'}`,
                            data: null,
                            error: 'INDEX_QUERY_ERROR'
                        });
                    }
                };
                
            } catch (error) {
                console.error('❌ [getOrder] 数据库操作异常:', error);
                resolve({
                    success: false,
                    message: `数据库操作异常: ${error.message}`,
                    data: null,
                    error: 'DATABASE_OPERATION_ERROR'
                });
            }
        });
    }
    
    /**
     * 添加订单记录
     * @param {Object} orderData 订单数据
     * @returns {Promise<Object>} 添加结果
     */
    async addOrder(orderData) {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            
            const order = {
                ...this._normalizeOrder(orderData),
                id: this._generateId('order_'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('📝 添加订单:', order.orderNumber);
            console.log('📅 时间字段:', {
                importTime: order.importTime,
                scanTime: order.scanTime,
                createdAt: order.createdAt
            });
            
            const request = store.add(order);
            
            request.onsuccess = (event) => {
                console.log('✅ 订单添加成功:', order.orderNumber);
                
                this.updateStats();
                
                resolve({
                    success: true,
                    data: order,
                    id: event.target.result
                });
            };
            
            request.onerror = (event) => {
                console.error('❌ 订单添加失败:', event.target.error);
                
                if (event.target.error.name === 'ConstraintError') {
                    reject(new Error('订单号已存在: ' + order.orderNumber));
                } else {
                    reject(new Error('订单添加失败: ' + event.target.error.message));
                }
            };
        });
    }
    
    /**
     * 🛠️ 修复：更新订单记录 - 支持时间字段更新
     * @param {string} orderNumber 订单号
     * @param {Object} updates 更新数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateOrder(orderNumber, updates) {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        console.log(`📝 更新订单: ${orderNumber}`);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const index = store.index('orderNumber');
            
            const getRequest = index.get(orderNumber);
            
            getRequest.onsuccess = (event) => {
                const existingOrder = event.target.result;
                
                if (!existingOrder) {
                    console.warn(`订单 ${orderNumber} 不存在，将创建新订单`);
                    
                    const normalizedUpdates = this._normalizeOrder(updates);
                    
                    const newOrder = {
                        ...normalizedUpdates,
                        orderNumber: orderNumber,
                        id: this._generateId('order_'),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    const addRequest = store.add(newOrder);
                    
                    addRequest.onsuccess = () => {
                        console.log('✅ 订单创建成功:', orderNumber);
                        resolve({
                            success: true,
                            data: newOrder,
                            created: true
                        });
                    };
                    
                    addRequest.onerror = (addEvent) => {
                        console.error('❌ 订单创建失败:', addEvent.target.error);
                        
                        if (addEvent.target.error.name === 'ConstraintError') {
                            reject(new Error('订单号已存在: ' + orderNumber));
                        } else {
                            reject(new Error('订单创建失败: ' + addEvent.target.error.message));
                        }
                    };
                    
                    return;
                }
                
                const normalizedUpdates = this._normalizeOrder(updates, existingOrder);
                
                // 🛠️ 修复：合并时间字段
                const updatedOrder = {
                    ...existingOrder,
                    ...normalizedUpdates,
                    updatedAt: new Date().toISOString()
                };
                
                // 确保关键字段不被覆盖
                updatedOrder.orderNumber = existingOrder.orderNumber;
                updatedOrder.id = existingOrder.id;
                updatedOrder.createdAt = existingOrder.createdAt;
                
                // 如果更新中包含视频录制信息，更新扫描时间
                if (updates.videoRecorded && !updatedOrder.scanTime) {
                    updatedOrder.scanTime = new Date().toISOString();
                    console.log('📹 更新扫描时间:', updatedOrder.scanTime);
                }
                
                const updateRequest = store.put(updatedOrder);
                
                updateRequest.onsuccess = () => {
                    console.log('✅ 订单更新成功:', orderNumber);
                    console.log('📅 更新时间字段:', {
                        importTime: updatedOrder.importTime,
                        scanTime: updatedOrder.scanTime,
                        updatedAt: updatedOrder.updatedAt
                    });
                    resolve({
                        success: true,
                        data: updatedOrder,
                        updated: true
                    });
                };
                
                updateRequest.onerror = (updateEvent) => {
                    console.error('❌ 订单更新失败:', updateEvent.target.error);
                    
                    if (updateEvent.target.error.name === 'ConstraintError') {
                        console.warn('检测到唯一性约束错误，尝试使用ID更新...');
                        
                        const idUpdateRequest = store.put(updatedOrder);
                        
                        idUpdateRequest.onsuccess = () => {
                            console.log('✅ 通过ID更新成功:', orderNumber);
                            resolve({
                                success: true,
                                data: updatedOrder,
                                updated: true
                            });
                        };
                        
                        idUpdateRequest.onerror = (idEvent) => {
                            console.error('❌ 通过ID更新也失败:', idEvent.target.error);
                            reject(new Error('订单更新失败（唯一性约束）: ' + idEvent.target.error.message));
                        };
                    } else {
                        reject(new Error('订单更新失败: ' + updateEvent.target.error.message));
                    }
                };
            };
            
            getRequest.onerror = (event) => {
                console.error('❌ 查询订单失败:', event.target.error);
                reject(new Error('查询订单失败: ' + event.target.error.message));
            };
        });
    }
    
    /**
     * 🛠️ 修复：规范化订单数据 - 区分导入时间和扫描时间
     * @param {Object} order 原始订单数据
     * @param {Object} existingOrder 现有订单数据（用于更新时）
     * @returns {Object} 规范化的订单数据
     */
    _normalizeOrder(order, existingOrder = null) {
        const now = new Date().toISOString();
        
        // 🛠️ 修复：正确处理时间字段
        const normalized = {
            // 基础信息
            orderNumber: order.orderNumber || order['订单编号'] || order['订单号'] || '',
            expressNumber: order.expressNumber || order['发货运单号'] || order['运单号'] || '',
            trackingNumber: order.trackingNumber || order['退货运单号'] || '',
            skuInfo: order.skuInfo || order['sku信息'] || order['SKU'] || '',
            notes: order.notes || order['备注'] || '',
            shopName: order.shopName || order['店铺名字'] || order['店铺名称'] || '',
            
            // 🛠️ 修复：时间字段区分
            // importTime: 导入时间（从Excel导入的时间或创建时间）
            importTime: order.importTime || order.scanTime || now,
            // scanTime: 扫描/录制时间（视频录制的时间）
            scanTime: order.scanTime || order.videoRecordedAt || null,
            
            // 状态信息
            status: order.status || '待处理',
            damage: order.damage || order.damageType || '完好',
            damageType: order.damageType || order.damage || '完好',
            
            // 视频相关字段
            videoFile: order.videoFile || null,
            videoData: order.videoData || null,
            videoFileName: order.videoFileName || null,
            videoRecorded: order.videoRecorded || false,
            videoRecordedAt: order.videoRecordedAt || null,
            videoDuration: order.videoDuration || 0,
            videoSize: order.videoSize || 0,
            
            // 时间戳字段（内部使用）
            createdAt: order.createdAt || now,
            updatedAt: now
        };
        
        // 如果是更新操作，保留原始创建时间
        if (existingOrder && existingOrder.createdAt) {
            normalized.createdAt = existingOrder.createdAt;
        }
        
        // 保留其他字段
        Object.keys(order).forEach(key => {
            if (!normalized.hasOwnProperty(key) && key !== 'id') {
                normalized[key] = order[key];
            }
        });
        
        return normalized;
    }
    
    /**
     * 删除订单记录
     * @param {string} orderNumber 订单号
     * @returns {Promise<Object>} 删除结果
     */
    async deleteOrder(orderNumber) {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const index = store.index('orderNumber');
            
            const getRequest = index.get(orderNumber);
            
            getRequest.onsuccess = (event) => {
                const order = event.target.result;
                if (!order) {
                    reject(new Error('订单不存在: ' + orderNumber));
                    return;
                }
                
                const deleteRequest = store.delete(order.id);
                
                deleteRequest.onsuccess = () => {
                    console.log('✅ 订单删除成功:', orderNumber);
                    resolve({
                        success: true,
                        message: '订单删除成功'
                    });
                };
                
                deleteRequest.onerror = (event) => {
                    console.error('❌ 订单删除失败:', event.target.error);
                    reject(new Error('订单删除失败: ' + event.target.error.message));
                };
            };
            
            getRequest.onerror = (event) => {
                console.error('❌ 查询订单失败:', event.target.error);
                reject(new Error('查询订单失败: ' + event.target.error.message));
            };
        });
    }
    
    /**
     * 🛠️ 新增：获取分页订单数据（问题3修复）
     * @param {number} page 页码（从1开始）
     * @param {number} pageSize 每页条数
     * @param {Object} filter 筛选条件
     * @param {string} sortBy 排序字段
     * @param {string} sortOrder 排序顺序（asc/desc）
     * @returns {Promise<Object>} 分页数据
     */
    async getOrdersWithPagination(page = 1, pageSize = 20, filter = {}, sortBy = 'importTime', sortOrder = 'desc') {
        if (!await this.initialize()) {
            return {
                success: false,
                message: '数据库未初始化',
                data: [],
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    total: 0,
                    totalPages: 0
                }
            };
        }
        
        console.log(`📄 获取分页数据: 第${page}页, ${pageSize}条/页`, filter);
        
        try {
            // 先获取所有订单（为了筛选和统计总数）
            const allOrders = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['orders'], 'readonly');
                const store = transaction.objectStore('orders');
                
                let request;
                if (sortBy === 'importTime' || sortBy === 'scanTime' || sortBy === 'createdAt') {
                    const index = store.index(sortBy);
                    request = index.openCursor(null, sortOrder === 'desc' ? 'prev' : 'next');
                } else {
                    request = store.openCursor();
                }
                
                const orders = [];
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (cursor) {
                        const order = cursor.value;
                        
                        // 应用筛选条件
                        if (this._applyFilter(order, filter)) {
                            orders.push(order);
                        }
                        
                        cursor.continue();
                    } else {
                        resolve(orders);
                    }
                };
                
                request.onerror = (event) => {
                    console.error('❌ 查询订单失败:', event.target.error);
                    reject(new Error('查询订单失败: ' + event.target.error.message));
                };
            });
            
            // 计算分页
            const total = allOrders.length;
            const totalPages = Math.ceil(total / pageSize);
            
            // 确保页码在有效范围内
            const validPage = Math.max(1, Math.min(page, totalPages || 1));
            
            // 获取当前页的数据
            const startIndex = (validPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const pagedOrders = allOrders.slice(startIndex, endIndex);
            
            console.log(`✅ 分页查询完成: ${total}条记录, ${totalPages}页, 当前第${validPage}页`);
            
            return {
                success: true,
                data: pagedOrders,
                pagination: {
                    page: validPage,
                    pageSize: pageSize,
                    total: total,
                    totalPages: totalPages,
                    hasPrevious: validPage > 1,
                    hasNext: validPage < totalPages
                },
                filter: filter
            };
            
        } catch (error) {
            console.error('❌ 分页查询失败:', error);
            return {
                success: false,
                message: `分页查询失败: ${error.message}`,
                data: [],
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    total: 0,
                    totalPages: 0
                }
            };
        }
    }
    
    /**
     * 🛠️ 修复：筛选函数（问题4修复）
     * @param {Object} order 订单数据
     * @param {Object} filter 筛选条件
     * @returns {boolean} 是否通过筛选
     */
    _applyFilter(order, filter) {
        // 状态筛选
        if (filter.status && filter.status !== '全部' && filter.status !== '') {
            if (order.status !== filter.status) {
                return false;
            }
        }
        
        // 损坏情况筛选
        if (filter.damage && filter.damage !== '全部' && filter.damage !== '') {
            const orderDamage = order.damage || order.damageType || '完好';
            if (orderDamage !== filter.damage) {
                return false;
            }
        }
        
        // 🛠️ 修复：日期范围筛选（支持 importTime 和 scanTime）
        if (filter.dateFrom || filter.dateTo) {
            let orderDate;
            
            // 优先使用 scanTime（扫描/录制时间）
            if (order.scanTime) {
                orderDate = new Date(order.scanTime).getTime();
            } 
            // 其次使用 importTime（导入时间）
            else if (order.importTime) {
                orderDate = new Date(order.importTime).getTime();
            }
            // 最后使用 createdAt（创建时间）
            else if (order.createdAt) {
                orderDate = new Date(order.createdAt).getTime();
            } else {
                // 没有时间信息，跳过日期筛选
                return true;
            }
            
            if (filter.dateFrom) {
                const fromDate = new Date(filter.dateFrom).setHours(0, 0, 0, 0);
                if (orderDate < fromDate) {
                    return false;
                }
            }
            
            if (filter.dateTo) {
                const toDate = new Date(filter.dateTo).setHours(23, 59, 59, 999);
                if (orderDate > toDate) {
                    return false;
                }
            }
        }
        
        // 店铺名称筛选
        if (filter.shopName && filter.shopName !== '全部' && filter.shopName !== '') {
            if (!order.shopName || order.shopName !== filter.shopName) {
                return false;
            }
        }
        
        // 是否有视频筛选
        if (filter.hasVideo === '有视频') {
            if (!order.videoFile && !order.videoData) {
                return false;
            }
        } else if (filter.hasVideo === '无视频') {
            if (order.videoFile || order.videoData) {
                return false;
            }
        }
        
        // 关键词搜索（多字段模糊匹配）
        if (filter.keyword && filter.keyword.trim() !== '') {
            const keyword = filter.keyword.toLowerCase().trim();
            const searchFields = [
                order.orderNumber,
                order.expressNumber,
                order.trackingNumber,
                order.shopName,
                order.skuInfo,
                order.notes
            ];
            
            const hasKeyword = searchFields.some(field => 
                field && field.toString().toLowerCase().includes(keyword)
            );
            
            if (!hasKeyword) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 🛠️ 新增：获取筛选统计信息
     * @param {Object} filter 筛选条件
     * @returns {Promise<Object>} 筛选统计
     */
    async getFilterStats(filter = {}) {
        if (!await this.initialize()) {
            return {
                total: 0,
                processed: 0,
                damaged: 0,
                pending: 0,
                withVideo: 0,
                withoutVideo: 0
            };
        }
        
        try {
            const allOrders = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['orders'], 'readonly');
                const store = transaction.objectStore('orders');
                const request = store.getAll();
                
                request.onsuccess = (event) => {
                    resolve(event.target.result || []);
                };
                
                request.onerror = (event) => {
                    console.error('❌ 获取订单失败:', event.target.error);
                    reject(new Error('获取订单失败: ' + event.target.error.message));
                };
            });
            
            // 应用筛选条件
            const filteredOrders = allOrders.filter(order => this._applyFilter(order, filter));
            
            // 计算统计
            const stats = {
                total: filteredOrders.length,
                processed: filteredOrders.filter(o => o.status === '已处理').length,
                damaged: filteredOrders.filter(o => o.damage === '破损' || o.damage === '缺件').length,
                pending: filteredOrders.filter(o => o.status === '待处理').length,
                withVideo: filteredOrders.filter(o => o.videoFile || o.videoData).length,
                withoutVideo: filteredOrders.filter(o => !o.videoFile && !o.videoData).length
            };
            
            console.log('📊 筛选统计:', stats);
            return stats;
            
        } catch (error) {
            console.error('❌ 获取筛选统计失败:', error);
            return {
                total: 0,
                processed: 0,
                damaged: 0,
                pending: 0,
                withVideo: 0,
                withoutVideo: 0
            };
        }
    }
    
    /**
     * 智能查询订单 - 支持多字段匹配
     * @param {string} input - 用户输入
     * @returns {Promise<Array>} 匹配的订单数组
     */
    async findOrderByAnyIdentifier(input) {
        if (!await this.initialize()) {
            return [];
        }
        
        if (!input || input.trim() === '') {
            return [];
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            
            const searchValue = input.trim().toLowerCase();
            const results = [];
            
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const order = cursor.value;
                    
                    const matches = 
                        (order.orderNumber && order.orderNumber.toLowerCase().includes(searchValue)) ||
                        (order.expressNumber && order.expressNumber.toLowerCase().includes(searchValue)) ||
                        (order.trackingNumber && order.trackingNumber.toLowerCase().includes(searchValue)) ||
                        (order.shopName && order.shopName.toLowerCase().includes(searchValue)) ||
                        (order.skuInfo && order.skuInfo.toLowerCase().includes(searchValue));
                    
                    if (matches) {
                        results.push(order);
                    }
                    
                    cursor.continue();
                } else {
                    console.log(`✅ 智能查询完成，找到 ${results.length} 条记录`);
                    resolve(results);
                }
            };
            
            request.onerror = (event) => {
                console.error('❌ 智能查询失败:', event.target.error);
                reject(new Error('智能查询失败: ' + event.target.error.message));
            };
        });
    }
    
    /**
     * 根据订单号获取单个订单（快速查询）
     * @param {string} orderNumber - 订单编号
     * @returns {Promise<Object|null>} 订单对象或null
     */
    async getOrderByNumber(orderNumber) {
        if (!await this.initialize()) {
            return null;
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const index = store.index('orderNumber');
            
            const request = index.get(orderNumber);
            
            request.onsuccess = (event) => {
                resolve(event.target.result || null);
            };
            
            request.onerror = (event) => {
                console.error('获取订单失败:', event.target.error);
                resolve(null);
            };
        });
    }
    
    /**
     * 获取所有订单（兼容旧版本）
     * @param {Object} options 查询选项
     * @returns {Promise<Array>} 订单列表
     */
    async getAllOrders(options = {}) {
        const {
            page = 1,
            pageSize = 1000,
            filter = {},
            sortBy = 'importTime',
            sortOrder = 'desc'
        } = options;
        
        // 如果指定了分页，使用新的分页方法
        if (options.compatibilityMode === false) {
            return this.getOrdersWithPagination(page, pageSize, filter, sortBy, sortOrder);
        }
        
        // 兼容旧版本的调用（无分页）
        if (!await this.initialize()) {
            return [];
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            
            let request;
            if (sortBy === 'importTime' || sortBy === 'scanTime') {
                const index = store.index(sortBy);
                request = index.openCursor(null, sortOrder === 'desc' ? 'prev' : 'next');
            } else {
                request = store.openCursor();
            }
            
            const allOrders = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    const order = cursor.value;
                    
                    if (this._applyFilter(order, filter)) {
                        allOrders.push(order);
                    }
                    
                    cursor.continue();
                } else {
                    console.log(`✅ 获取到 ${allOrders.length} 条订单记录`);
                    resolve(allOrders);
                }
            };
            
            request.onerror = (event) => {
                console.error('❌ 查询订单失败:', event.target.error);
                resolve([]);
            };
        });
    }
    
    /**
     * 获取订单总数
     */
    async getOrdersCount(filter = {}) {
        if (!await this.initialize()) {
            return 0;
        }
        
        const allOrders = await this.getAllOrders();
        const filtered = allOrders.filter(order => this._applyFilter(order, filter));
        return filtered.length;
    }
    
    /**
     * 批量导入订单（修复版）
     * @param {Array} orders 订单列表
     * @param {string} strategy 导入策略
     * @returns {Promise<Object>} 导入结果
     */
    async bulkImportOrders(orders, strategy = 'fill_blanks') {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        const results = {
            total: orders.length,
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };
        
        console.log(`🔄 开始批量导入 ${orders.length} 条订单，策略: ${strategy}`);
        
        const importTime = new Date().toISOString(); // 统一的导入时间
        
        for (let i = 0; i < orders.length; i++) {
            try {
                const order = orders[i];
                
                if (!order.orderNumber) {
                    throw new Error('缺少订单号');
                }
                
                // 🛠️ 修复：设置导入时间
                const normalizedOrder = this._normalizeOrder({
                    ...order,
                    importTime: importTime // 设置统一的导入时间
                });
                
                const existingResult = await this.getOrder(normalizedOrder.orderNumber);
                
                if (existingResult.success && existingResult.data) {
                    if (strategy === 'skip_duplicates') {
                        results.skipped++;
                        continue;
                    } else if (strategy === 'fill_blanks') {
                        const existing = existingResult.data;
                        const mergedOrder = { ...existing };
                        
                        Object.keys(normalizedOrder).forEach(key => {
                            if (!existing[key] || existing[key] === '' || existing[key] === null) {
                                mergedOrder[key] = normalizedOrder[key];
                            }
                        });
                        
                        mergedOrder.updatedAt = new Date().toISOString();
                        await this.updateOrder(normalizedOrder.orderNumber, mergedOrder);
                        results.updated++;
                    } else if (strategy === 'update_all') {
                        await this.updateOrder(normalizedOrder.orderNumber, normalizedOrder);
                        results.updated++;
                    }
                } else {
                    await this.addOrder(normalizedOrder);
                    results.created++;
                }
                
            } catch (error) {
                console.error(`❌ 导入订单失败 (第${i+1}条):`, error);
                results.failed++;
                results.errors.push({
                    index: i,
                    order: orders[i],
                    error: error.message
                });
            }
        }
        
        await this.addImportHistory({
            timestamp: new Date().toISOString(),
            strategy: strategy,
            results: { ...results }
        });
        
        console.log('✅ 批量导入完成:', results);
        return results;
    }
    
    /**
     * 添加导入历史记录
     */
    async addImportHistory(historyData) {
        if (!await this.initialize()) {
            return { success: false, error: '数据库未初始化' };
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['importHistory'], 'readwrite');
            const store = transaction.objectStore('importHistory');
            
            const history = {
                ...historyData,
                id: this._generateId('import_')
            };
            
            const request = store.add(history);
            
            request.onsuccess = () => {
                resolve({ success: true });
            };
            
            request.onerror = (event) => {
                console.error('❌ 保存导入历史失败:', event.target.error);
                reject(new Error('保存导入历史失败'));
            };
        });
    }
    
    /**
     * 获取导入历史
     */
    async getImportHistory() {
        if (!await this.initialize()) {
            return [];
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['importHistory'], 'readonly');
            const store = transaction.objectStore('importHistory');
            
            const request = store.getAll();
            
            request.onsuccess = (event) => {
                resolve(event.target.result || []);
            };
            
            request.onerror = (event) => {
                console.error('❌ 获取导入历史失败:', event.target.error);
                reject(new Error('获取导入历史失败'));
            };
        });
    }
    
    /**
     * 更新统计信息
     */
    async updateStats() {
        if (!await this.initialize()) {
            return { success: false, error: '数据库未初始化' };
        }
        
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const allOrders = await this.getAllOrders();
            const todayOrders = allOrders.filter(order => {
                const orderDate = new Date(order.scanTime || order.importTime).toISOString().split('T')[0];
                return orderDate === today;
            });
            
            const stats = {
                date: today,
                total: todayOrders.length,
                processed: todayOrders.filter(o => o.status === '已处理').length,
                damaged: todayOrders.filter(o => o.damage === '破损' || o.damage === '缺件').length,
                pending: todayOrders.filter(o => o.status === '待处理').length,
                videos: todayOrders.filter(o => o.videoFile || o.videoData).length,
                lastUpdated: new Date().toISOString()
            };
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['stats'], 'readwrite');
                const store = transaction.objectStore('stats');
                
                const request = store.put(stats);
                
                request.onsuccess = () => {
                    resolve({ success: true, data: stats });
                };
                
                request.onerror = (event) => {
                    console.error('❌ 更新统计失败:', event.target.error);
                    reject(new Error('更新统计失败'));
                };
            });
            
        } catch (error) {
            console.error('❌ 更新统计信息失败:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 获取统计信息
     */
    async getStats(date = null) {
        if (!await this.initialize()) {
            return {
                todayTotal: 0,
                todayProcessed: 0,
                todayDamaged: 0,
                todayVideos: 0,
                date: date || new Date().toISOString().split('T')[0]
            };
        }
        
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stats'], 'readonly');
            const store = transaction.objectStore('stats');
            
            const request = store.get(targetDate);
            
            request.onsuccess = (event) => {
                const stats = event.target.result;
                if (stats) {
                    resolve(stats);
                } else {
                    resolve({
                        date: targetDate,
                        total: 0,
                        processed: 0,
                        damaged: 0,
                        pending: 0,
                        videos: 0,
                        lastUpdated: null
                    });
                }
            };
            
            request.onerror = (event) => {
                console.error('❌ 获取统计失败:', event.target.error);
                resolve({
                    date: targetDate,
                    total: 0,
                    processed: 0,
                    damaged: 0,
                    pending: 0,
                    videos: 0,
                    lastUpdated: null
                });
            };
        });
    }
    
    /**
     * 清空数据库
     */
    async clearAll() {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) {
            return { success: false, message: '操作已取消' };
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ['orders', 'stats', 'settings', 'importHistory'],
                'readwrite'
            );
            
            let completed = 0;
            const totalStores = 4;
            
            const checkCompletion = () => {
                completed++;
                if (completed === totalStores) {
                    console.log('✅ 数据库已清空');
                    resolve({ success: true, message: '数据库已清空' });
                }
            };
            
            ['orders', 'stats', 'settings', 'importHistory'].forEach(storeName => {
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                request.onsuccess = () => {
                    console.log(`✅ ${storeName} 表已清空`);
                    checkCompletion();
                };
                
                request.onerror = (event) => {
                    console.error(`❌ 清空 ${storeName} 表失败:`, event.target.error);
                    checkCompletion();
                };
            });
            
            transaction.onerror = (event) => {
                console.error('❌ 清空数据库失败:', event.target.error);
                reject(new Error('清空数据库失败: ' + event.target.error.message));
            };
        });
    }
    
    /**
     * 备份数据库
     */
    async backup() {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        try {
            const backupData = {};
            
            const tables = ['orders', 'stats', 'settings', 'importHistory'];
            
            for (const table of tables) {
                const data = await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction([table], 'readonly');
                    const store = transaction.objectStore(table);
                    const request = store.getAll();
                    
                    request.onsuccess = (event) => {
                        resolve(event.target.result);
                    };
                    
                    request.onerror = (event) => {
                        reject(new Error(`备份 ${table} 失败: ${event.target.error.message}`));
                    };
                });
                
                backupData[table] = data;
            }
            
            const backupInfo = {
                timestamp: new Date().toISOString(),
                version: this.version,
                dbName: this.dbName,
                dbVersion: this.dbVersion,
                data: backupData
            };
            
            console.log('✅ 数据库备份完成');
            return backupInfo;
            
        } catch (error) {
            console.error('❌ 数据库备份失败:', error);
            throw error;
        }
    }
    
    /**
     * 恢复数据库
     */
    async restore(backupData) {
        if (!backupData || !backupData.data) {
            throw new Error('无效的备份数据');
        }
        
        if (!confirm('⚠️ 确定要恢复备份数据吗？当前数据将被覆盖！')) {
            return { success: false, message: '操作已取消' };
        }
        
        try {
            await this.clearAll();
            
            for (const [table, data] of Object.entries(backupData.data)) {
                if (Array.isArray(data)) {
                    for (const item of data) {
                        await new Promise((resolve, reject) => {
                            const transaction = this.db.transaction([table], 'readwrite');
                            const store = transaction.objectStore(table);
                            
                            const request = store.add(item);
                            
                            request.onsuccess = () => resolve();
                            request.onerror = (event) => reject(event.target.error);
                        });
                    }
                }
            }
            
            console.log('✅ 数据库恢复完成');
            return { success: true, message: '数据库恢复成功' };
            
        } catch (error) {
            console.error('❌ 数据库恢复失败:', error);
            throw error;
        }
    }
    
    /**
     * 清理旧数据
     */
    async cleanupOldData(daysBefore = 7, includeVideos = false) {
        if (!await this.initialize()) {
            throw new Error('数据库未初始化');
        }
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBefore);
        cutoffDate.setHours(0, 0, 0, 0);
        
        console.log(`🔄 清理 ${daysBefore} 天前的数据，截止日期: ${cutoffDate.toLocaleString()}`);
        
        try {
            const allOrders = await this.getAllOrders();
            const ordersToDelete = allOrders.filter(order => {
                const orderDate = new Date(order.scanTime || order.importTime);
                return orderDate < cutoffDate;
            });
            
            let deletedCount = 0;
            const videoFilesToDelete = [];
            
            for (const order of ordersToDelete) {
                try {
                    await this.deleteOrder(order.orderNumber);
                    deletedCount++;
                    
                    if (includeVideos && order.videoFile) {
                        videoFilesToDelete.push(order.videoFile);
                    }
                } catch (error) {
                    console.error(`❌ 删除订单失败 ${order.orderNumber}:`, error);
                }
            }
            
            const result = {
                success: true,
                totalFound: ordersToDelete.length,
                deletedCount: deletedCount,
                videosToDelete: videoFilesToDelete.length,
                cutoffDate: cutoffDate.toISOString()
            };
            
            console.log('✅ 数据清理完成:', result);
            return result;
            
        } catch (error) {
            console.error('❌ 数据清理失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取数据库信息
     */
    getInfo() {
        return {
            version: this.version,
            dbName: this.dbName,
            dbVersion: this.dbVersion,
            isInitialized: this.isInitialized,
            support: {
                indexedDB: this._isIndexedDBSupported()
            }
        };
    }
    
    /**
     * ======================= 兼容性方法 =======================
     */
    
    /**
     * 保存订单（兼容性方法）
     */
    async saveOrder(order) {
        try {
            const existing = await this.getOrder(order.orderNumber);
            
            if (existing.success && existing.data) {
                return await this.updateOrder(order.orderNumber, order);
            } else {
                const result = await this.addOrder(order);
                return result.data || result;
            }
        } catch (error) {
            console.error('❌ 保存订单失败:', error);
            throw error;
        }
    }
    
    /**
     * 搜索订单（兼容性方法）
     */
    async searchOrders(searchTerm) {
        if (!await this.initialize()) {
            return [];
        }
        
        try {
            return await this.findOrderByAnyIdentifier(searchTerm);
        } catch (error) {
            console.error('❌ 搜索订单失败:', error);
            return [];
        }
    }
    
    /**
     * 添加视频到订单（兼容性方法）- 修复版
     */
    async addVideoToOrder(orderNumber, videoData) {
        try {
            const orderResult = await this.getOrder(orderNumber);
            
            // 正确处理返回值格式
            if (!orderResult || !orderResult.success || !orderResult.data) {
                throw new Error(orderResult?.message || '订单不存在');
            }
            
            const order = orderResult.data;
            const shopName = order.shopName || '未知店铺';
            
            const cleanShopName = (name) => {
                if (!name) return '未知店铺';
                return name
                    .replace(/[<>:"/\\|?*]/g, '')
                    .replace(/\s+/g, '_')
                    .trim()
                    .substring(0, 50);
            };
            
            const cleanName = cleanShopName(shopName);
            const newFileName = `${orderNumber}_${cleanName}.mp4`;
            
            // 🛠️ 修复：同时更新扫描时间
            return await this.updateOrder(orderNumber, {
                videoData: videoData,
                videoRecorded: true,
                videoFileName: newFileName,
                videoFile: newFileName,
                videoDuration: videoData.duration || 0,
                videoSize: videoData.fileSize || 0,
                scanTime: new Date().toISOString(), // 更新扫描时间
                videoRecordedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ 添加视频失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取统计信息（兼容性方法）
     */
    async getStatistics() {
        try {
            const stats = await this.getStats();
            return {
                todayTotal: stats.total || 0,
                todayProcessed: stats.processed || 0,
                todayDamaged: stats.damaged || 0,
                todayVideos: stats.videos || 0,
                date: stats.date
            };
        } catch (error) {
            console.error('❌ 获取统计失败:', error);
            return {
                todayTotal: 0,
                todayProcessed: 0,
                todayDamaged: 0,
                todayVideos: 0
            };
        }
    }
    
    /**
     * 创建数据库备份（兼容性方法）
     */
    async createBackup() {
        return this.backup();
    }
    
    /**
     * 🛠️ 新增：获取分页数据（兼容性方法）
     */
    async getPagedOrders(page = 1, pageSize = 20, filter = {}) {
        return this.getOrdersWithPagination(page, pageSize, filter);
    }
    
    /**
     * 初始化方法（兼容 exchange.js 的调用）
     */
    async init() {
        return this.initialize();
    }
}

// ======================= 全局导出 =======================

(function() {
    const databaseModule = new DatabaseModule();
    
    if (typeof window !== 'undefined') {
        window.DatabaseModule = DatabaseModule;
        window.databaseModule = databaseModule;
        
        if (window.ReturnUnpackSystem) {
            window.ReturnUnpackSystem.modules = window.ReturnUnpackSystem.modules || {};
            window.ReturnUnpackSystem.modules.database = databaseModule;
            
            // 导出所有方法
            window.ReturnUnpackSystem.Database = {
                // 基本操作
                findOrderByAnyIdentifier: databaseModule.findOrderByAnyIdentifier.bind(databaseModule),
                getOrderByNumber: databaseModule.getOrderByNumber.bind(databaseModule),
                getOrder: databaseModule.getOrder.bind(databaseModule),
                updateOrder: databaseModule.updateOrder.bind(databaseModule),
                saveOrder: databaseModule.saveOrder.bind(databaseModule),
                deleteOrder: databaseModule.deleteOrder.bind(databaseModule),
                addVideoToOrder: databaseModule.addVideoToOrder.bind(databaseModule),
                
                // 🛠️ 新增：分页和筛选功能
                getOrdersWithPagination: databaseModule.getOrdersWithPagination.bind(databaseModule),
                getPagedOrders: databaseModule.getPagedOrders.bind(databaseModule),
                getFilterStats: databaseModule.getFilterStats.bind(databaseModule),
                getAllOrders: databaseModule.getAllOrders.bind(databaseModule),
                getOrdersCount: databaseModule.getOrdersCount.bind(databaseModule),
                
                // 搜索
                searchOrders: databaseModule.searchOrders.bind(databaseModule),
                
                // 批量操作
                bulkImportOrders: databaseModule.bulkImportOrders.bind(databaseModule),
                cleanupOldData: databaseModule.cleanupOldData.bind(databaseModule),
                
                // 统计和备份
                getStatistics: databaseModule.getStatistics.bind(databaseModule),
                createBackup: databaseModule.createBackup.bind(databaseModule),
                clearAll: databaseModule.clearAll.bind(databaseModule),
                
                // 初始化
                init: databaseModule.init.bind(databaseModule),
                initialize: databaseModule.initialize.bind(databaseModule)
            };
        }
        
        console.log('✅ DatabaseModule v2.0.0 已全局导出');
        console.log('🎯 已修复问题:');
        console.log('  1. ✅ 完整的分页功能');
        console.log('  2. ✅ 修复的筛选功能');
        console.log('  3. ✅ 区分导入时间和扫描时间');
    }
    
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = DatabaseModule;
    }
})();