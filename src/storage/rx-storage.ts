import { BehaviorSubject, Observable, distinctUntilChanged, debounceTime, switchMap, catchError, of, shareReplay } from 'rxjs';

/**
 * 存储配置接口
 */
export interface StorageConfig {
  /** 防抖延迟时间（毫秒），默认 500ms */
  debounceTime?: number;
  /** 缓存过期时间（毫秒），默认 5 分钟 */
  cacheExpiry?: number;
  /** 是否启用日志，默认 false */
  enableLogging?: boolean;
  /** 存储区域，默认 'local' */
  area?: 'local' | 'sync' | 'session';
}

/**
 * 缓存数据结构
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

/**
 * 存储操作类型
 */
interface StorageOperation<T> {
  type: 'SET' | 'DELETE' | 'CLEAR';
  key?: string;
  value?: T;
  timestamp: number;
}

/**
 * 基于 RxJS 的浏览器插件数据永久存储管理器
 * 
 * 特性：
 * - 防抖写入：多次频繁写入只执行最后一次
 * - 缓存机制：读取操作优先从缓存获取最新数据
 * - 响应式：数据变化时自动通知订阅者
 * - 类型安全：支持 TypeScript 泛型
 */
export class RxStorage<T = unknown> {
  private dataSubject: BehaviorSubject<T | null>;
  private operationSubject: BehaviorSubject<StorageOperation<T> | null>;
  private cache = new Map<string, CacheEntry<T>>();
  private config: Required<StorageConfig>;
  private storageArea: chrome.storage.StorageArea;
  private operationVersion = 0;
  private key: string;
  private defaultValue: T | null;

  constructor(
    key: string,
    defaultValue: T | null = null,
    config: StorageConfig = {}
  ) {
    this.key = key;
    this.defaultValue = defaultValue;
    this.config = {
      debounceTime: 500,
      cacheExpiry: 5 * 60 * 1000, // 5 分钟
      enableLogging: false,
      area: 'local',
      ...config
    };

    // 选择存储区域
    if (typeof chrome === 'undefined' || !chrome.storage) {
      throw new Error('Chrome storage API is not available. This class can only be used in Chrome extension context.');
    }
    
    const storageArea = chrome.storage[this.config.area];
    if (!storageArea) {
      throw new Error(`Chrome storage area '${this.config.area}' is not available.`);
    }
    
    this.storageArea = storageArea;

    // 初始化 subjects
    this.dataSubject = new BehaviorSubject<T | null>(defaultValue);
    this.operationSubject = new BehaviorSubject<StorageOperation<T> | null>(null);

    // 设置防抖写入
    this.setupDebouncedWrite();

    // 监听存储变化
    this.setupStorageListener();

    // 初始化时加载数据
    this.loadInitialData();
  }

  /**
   * 设置防抖写入机制
   */
  private setupDebouncedWrite(): void {
    this.operationSubject.pipe(
      distinctUntilChanged((prev, curr) => {
        if (!prev || !curr) return prev === curr;
        return prev.type === curr.type && 
               prev.key === curr.key && 
               prev.value === curr.value &&
               prev.timestamp === curr.timestamp;
      }),
      debounceTime(this.config.debounceTime),
      switchMap(operation => {
        if (!operation) return of(null);
        return this.executeStorageOperation(operation);
      }),
      catchError(error => {
        this.log('Storage operation error:', error);
        return of(null);
      })
    ).subscribe({
      next: (result) => {
        if (result) {
          this.log('Storage operation completed:', result);
        }
      },
      error: (error) => {
        this.log('Storage subscription error:', error);
      }
    });
  }

  /**
   * 执行存储操作
   */
  private executeStorageOperation(operation: StorageOperation<T>): Observable<{ success: boolean; operation: StorageOperation<T> }> {
    return new Observable(observer => {
      const execute = async () => {
        try {
          switch (operation.type) {
            case 'SET':
              if (operation.key && operation.value !== undefined) {
                await this.storageArea.set({ [operation.key]: operation.value });
                this.updateCache(operation.key, operation.value, operation.timestamp);
                this.log(`Stored data for key: ${operation.key}`, operation.value);
              }
              break;
            
            case 'DELETE':
              if (operation.key) {
                await this.storageArea.remove(operation.key);
                this.cache.delete(operation.key);
                this.log(`Removed data for key: ${operation.key}`);
              }
              break;
            
            case 'CLEAR':
              await this.storageArea.clear();
              this.cache.clear();
              this.log('Cleared all storage data');
              break;
          }
          
          observer.next({ success: true, operation });
          observer.complete();
        } catch (error) {
          this.log('Storage operation failed:', error);
          observer.error(error);
        }
      };

      execute();
    });
  }

  /**
   * 监听存储变化
   */
  private setupStorageListener(): void {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
      this.log('Chrome storage change listener is not available, skipping setup');
      return;
    }
    
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== this.config.area) return;
      
      if (changes[this.key]) {
        const change = changes[this.key];
        const newValue = change.newValue;
        
        this.log(`Storage changed for key: ${this.key}`, {
          oldValue: change.oldValue,
          newValue: newValue
        });

        // 更新缓存和 subject
        if (newValue !== undefined) {
          this.updateCache(this.key, newValue, Date.now());
          this.dataSubject.next(newValue);
        } else {
          this.cache.delete(this.key);
          this.dataSubject.next(this.defaultValue);
        }
      }
    });
  }

  /**
   * 加载初始数据
   */
  private async loadInitialData(): Promise<void> {
    try {
      const result = await this.storageArea.get(this.key);
      const value = result[this.key];
      
      if (value !== undefined) {
        this.updateCache(this.key, value, Date.now());
        this.dataSubject.next(value);
        this.log(`Loaded initial data for key: ${this.key}`, value);
      } else {
        this.dataSubject.next(this.defaultValue);
        this.log(`No initial data found for key: ${this.key}, using default value`);
      }
    } catch (error) {
      this.log('Failed to load initial data:', error);
      this.dataSubject.next(this.defaultValue);
    }
  }

  /**
   * 更新缓存
   */
  private updateCache(key: string, data: T, timestamp: number): void {
    this.cache.set(key, {
      data,
      timestamp,
      version: ++this.operationVersion
    });
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.config.cacheExpiry;
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.enableLogging) {
      console.log(`[RxStorage:${this.key}] ${message}`, ...args);
    }
  }

  /**
   * 设置数据（防抖写入）
   */
  set(value: T): void {
    const operation: StorageOperation<T> = {
      type: 'SET',
      key: this.key,
      value,
      timestamp: Date.now()
    };

    // 立即更新缓存和本地状态
    this.updateCache(this.key, value, operation.timestamp);
    this.dataSubject.next(value);

    // 发送操作到防抖队列
    this.operationSubject.next(operation);
    
    this.log('Set operation queued:', value);
  }

  /**
   * 获取数据（优先从缓存）
   */
  get(): Observable<T | null> {
    return new Observable<T | null>(observer => {
      // 首先检查缓存
      const cached = this.cache.get(this.key);
      if (cached && this.isCacheValid(cached)) {
        this.log('Cache hit for key:', this.key);
        observer.next(cached.data);
        observer.complete();
        return;
      }

      // 缓存无效或不存在，从存储读取
      this.log('Cache miss, loading from storage for key:', this.key);
      this.storageArea.get(this.key).then(result => {
        const value = result[this.key];
        if (value !== undefined) {
          this.updateCache(this.key, value, Date.now());
          observer.next(value);
        } else {
          observer.next(this.defaultValue);
        }
        observer.complete();
      }).catch(error => {
        this.log('Failed to get data from storage:', error);
        observer.error(error);
      });
    });
  }

  /**
   * 获取数据的响应式流（返回 Observable 会自动更新）
   */
  watch(): Observable<T | null> {
    return this.dataSubject.asObservable().pipe(
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  /**
   * 获取当前值（同步）
   */
  getValue(): T | null {
    return this.dataSubject.value;
  }

  /**
   * 删除数据
   */
  delete(): void {
    const operation: StorageOperation<T> = {
      type: 'DELETE',
      key: this.key,
      timestamp: Date.now()
    };

    // 立即更新本地状态
    this.cache.delete(this.key);
    this.dataSubject.next(this.defaultValue);

    // 发送操作到防抖队列
    this.operationSubject.next(operation);
    
    this.log('Delete operation queued');
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    const operation: StorageOperation<T> = {
      type: 'CLEAR',
      timestamp: Date.now()
    };

    // 立即清空缓存和本地状态
    this.cache.clear();
    this.dataSubject.next(this.defaultValue);

    // 发送操作到防抖队列
    this.operationSubject.next(operation);
    
    this.log('Clear operation queued');
  }

  /**
   * 强制刷新数据（忽略缓存）
   */
  refresh(): Observable<T | null> {
    return new Observable<T | null>(observer => {
      this.storageArea.get(this.key).then(result => {
        const value = result[this.key];
        if (value !== undefined) {
          this.updateCache(this.key, value, Date.now());
          this.dataSubject.next(value);
          observer.next(value);
        } else {
          this.dataSubject.next(this.defaultValue);
          observer.next(this.defaultValue);
        }
        observer.complete();
      }).catch(error => {
        this.log('Failed to refresh data:', error);
        observer.error(error);
      });
    });
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const entry = this.cache.get(this.key);
    return {
      isCached: !!entry,
      isValid: entry ? this.isCacheValid(entry) : false,
      timestamp: entry?.timestamp,
      version: entry?.version,
      cacheSize: this.cache.size
    };
  }

  /**
   * 销毁存储实例
   */
  destroy(): void {
    this.dataSubject.complete();
    this.operationSubject.complete();
    this.cache.clear();
    this.log('Storage instance destroyed');
  }
}
