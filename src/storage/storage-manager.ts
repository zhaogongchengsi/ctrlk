import { RxStorage } from './rx-storage';
import type { StorageConfig } from './rx-storage';
import { Observable, combineLatest, map } from 'rxjs';

/**
 * 存储实例注册表
 */
interface StorageRegistry {
  [key: string]: RxStorage<unknown>;
}

/**
 * 存储管理器配置
 */
export interface StorageManagerConfig {
  /** 全局存储配置 */
  globalConfig?: StorageConfig;
  /** 是否启用全局日志 */
  enableGlobalLogging?: boolean;
}

/**
 * 存储管理器 - 统一管理所有存储实例
 */
export class StorageManager {
  private storages: StorageRegistry = {};
  private config: StorageManagerConfig;

  constructor(config: StorageManagerConfig = {}) {
    this.config = {
      globalConfig: {
        debounceTime: 500,
        cacheExpiry: 5 * 60 * 1000,
        enableLogging: false,
        area: 'local'
      },
      enableGlobalLogging: false,
      ...config
    };

    this.log('Storage manager initialized with config:', this.config);
  }

  /**
   * 创建或获取存储实例
   */
  getStorage<T>(
    key: string, 
    defaultValue: T | null = null, 
    config?: StorageConfig
  ): RxStorage<T> {
    if (this.storages[key]) {
      this.log(`Returning existing storage for key: ${key}`);
      return this.storages[key] as RxStorage<T>;
    }

    const mergedConfig = {
      ...this.config.globalConfig,
      ...config
    };

    this.log(`Creating new storage for key: ${key}`, mergedConfig);
    const storage = new RxStorage<T>(key, defaultValue, mergedConfig);
    this.storages[key] = storage as RxStorage<unknown>;

    return storage;
  }

  /**
   * 销毁指定存储实例
   */
  destroyStorage(key: string): boolean {
    const storage = this.storages[key];
    if (storage) {
      storage.destroy();
      delete this.storages[key];
      this.log(`Destroyed storage for key: ${key}`);
      return true;
    }
    this.log(`Storage not found for key: ${key}`);
    return false;
  }

  /**
   * 销毁所有存储实例
   */
  destroyAll(): void {
    Object.keys(this.storages).forEach(key => {
      this.storages[key].destroy();
    });
    this.storages = {};
    this.log('All storages destroyed');
  }

  /**
   * 获取所有存储实例的键
   */
  getStorageKeys(): string[] {
    return Object.keys(this.storages);
  }

  /**
   * 监听多个存储的变化
   */
  watchMultiple<T extends Record<string, unknown>>(
    keys: (keyof T)[]
  ): Observable<Partial<T>> {
    const storageObservables = keys.map(key => {
      const storage = this.getStorage(key as string);
      return storage.watch().pipe(
        map(value => ({ [key]: value } as Partial<T>))
      );
    });

    return combineLatest(storageObservables).pipe(
      map(results => results.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Partial<T>))
    );
  }

  /**
   * 批量设置数据
   */
  setBatch<T extends Record<string, unknown>>(data: T): void {
    Object.entries(data).forEach(([key, value]) => {
      const storage = this.getStorage<unknown>(key, null);
      storage.set(value);
    });
    this.log('Batch set completed for keys:', Object.keys(data));
  }

  /**
   * 批量获取数据
   */
  getBatch<T extends Record<string, unknown>>(
    keys: (keyof T)[]
  ): Observable<Partial<T>> {
    const getOperations = keys.map(async key => {
      const storage = this.getStorage(key as string);
      const value = await storage.get().toPromise();
      return { [key]: value } as Partial<T>;
    });

    return new Observable(observer => {
      Promise.all(getOperations).then(results => {
        const combined = results.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Partial<T>);
        observer.next(combined);
        observer.complete();
      }).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * 获取所有存储的缓存统计信息
   */
  getAllCacheStats(): Record<string, ReturnType<RxStorage<unknown>['getCacheStats']>> {
    const stats: Record<string, ReturnType<RxStorage<unknown>['getCacheStats']>> = {};
    
    Object.entries(this.storages).forEach(([key, storage]) => {
      stats[key] = storage.getCacheStats();
    });

    return stats;
  }

  /**
   * 清空所有存储的缓存
   */
  clearAllCaches(): void {
    Object.values(this.storages).forEach(storage => {
      storage.refresh();
    });
    this.log('All caches cleared');
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.enableGlobalLogging) {
      console.log(`[StorageManager] ${message}`, ...args);
    }
  }
}

// 导出单例实例
export const storageManager = new StorageManager({
  enableGlobalLogging: process.env.NODE_ENV === 'development',
  globalConfig: {
    debounceTime: 500,
    cacheExpiry: 10 * 60 * 1000, // 10 分钟
    enableLogging: process.env.NODE_ENV === 'development',
    area: 'local'
  }
});
