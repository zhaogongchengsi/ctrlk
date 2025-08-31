import { RxStorage, type StorageConfig } from './rx-storage';
import { BehaviorSubject, Observable, of } from 'rxjs';

/**
 * 基本存储接口
 */
export interface IStorage<T> {
  set(value: T): void;
  get(): Observable<T | null>;
  watch(): Observable<T | null>;
  getValue(): T | null;
  delete(): void;
  clear(): void;
  refresh(): Observable<T | null>;
  destroy(): void;
  getCacheStats?(): {
    isCached: boolean;
    isValid: boolean;
    timestamp?: number;
    version?: number;
    cacheSize: number;
  };
}

/**
 * 内存存储实现（用作Chrome storage不可用时的备用方案）
 */
class MemoryStorage<T> implements IStorage<T> {
  private dataSubject: BehaviorSubject<T | null>;
  private defaultValue: T | null;

  constructor(key: string, defaultValue: T | null = null) {
    this.defaultValue = defaultValue;
    this.dataSubject = new BehaviorSubject<T | null>(defaultValue);
    
    console.warn(`[MemoryStorage:${key}] Chrome storage API not available, using memory storage as fallback`);
  }

  set(value: T): void {
    this.dataSubject.next(value);
  }

  get(): Observable<T | null> {
    return of(this.dataSubject.value);
  }

  watch(): Observable<T | null> {
    return this.dataSubject.asObservable();
  }

  getValue(): T | null {
    return this.dataSubject.value;
  }

  delete(): void {
    this.dataSubject.next(this.defaultValue);
  }

  clear(): void {
    this.dataSubject.next(this.defaultValue);
  }

  refresh(): Observable<T | null> {
    return of(this.dataSubject.value);
  }

  getCacheStats() {
    return {
      isCached: true, // 内存存储总是缓存的
      isValid: true,  // 内存存储总是有效的
      timestamp: Date.now(),
      version: 1,
      cacheSize: 1
    };
  }

  destroy(): void {
    this.dataSubject.complete();
  }
}

/**
 * 存储工厂类
 */
export class StorageFactory {
  /**
   * 检查Chrome storage API是否可用
   */
  static isChromeStorageAvailable(): boolean {
    return typeof chrome !== 'undefined' && 
           chrome.storage !== undefined && 
           chrome.storage.local !== undefined;
  }

  /**
   * 创建存储实例
   * @param key 存储键
   * @param defaultValue 默认值
   * @param config 配置选项
   * @returns 存储实例
   */
  static createStorage<T>(
    key: string, 
    defaultValue: T | null = null, 
    config: StorageConfig = {}
  ): IStorage<T> {
    if (this.isChromeStorageAvailable()) {
      try {
        return new RxStorage<T>(key, defaultValue, config);
      } catch (error) {
        console.error('Failed to create RxStorage, falling back to MemoryStorage:', error);
        return new MemoryStorage<T>(key, defaultValue);
      }
    } else {
      return new MemoryStorage<T>(key, defaultValue);
    }
  }

  /**
   * 创建Chrome存储实例（如果可用）
   * @param key 存储键
   * @param defaultValue 默认值
   * @param config 配置选项
   * @returns Chrome存储实例或null
   */
  static createChromeStorage<T>(
    key: string, 
    defaultValue: T | null = null, 
    config: StorageConfig = {}
  ): RxStorage<T> | null {
    if (this.isChromeStorageAvailable()) {
      try {
        return new RxStorage<T>(key, defaultValue, config);
      } catch (error) {
        console.error('Failed to create Chrome storage:', error);
        return null;
      }
    }
    return null;
  }
}
