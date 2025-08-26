import React, { useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

interface CommandWrapperProps {
  children: ReactNode;
  onSizeChange?: (size: { width: number; height: number }) => void;
  debounceMs?: number;
  className?: string;
}

/**
 * CommandWrapper 组件
 * 
 * 用于包裹 Command 组件，监听自身尺寸变化并通知父页面
 * 
 * 功能特性：
 * - 使用 ResizeObserver API 监听尺寸变化
 * - 自动通知父页面高度变化
 * - 支持防抖优化性能
 * - 兼容跨域 iframe 环境
 */
const CommandWrapper: React.FC<CommandWrapperProps> = ({
  children,
  onSizeChange,
  debounceMs = 100,
  className = ''
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const debounceTimerRef = useRef<number | null>(null);

  // 通知父页面高度变化
  const notifyParentHeightChange = useCallback(() => {
    // 检查是否在 iframe 环境中
    if (window.parent !== window) {
      try {
        window.parent.postMessage({
          type: 'HEIGHT_CHANGE_NOTIFICATION',
          timestamp: Date.now()
        }, '*');
      } catch (error) {
        console.warn('Failed to notify parent window:', error);
      }
    }

    // 如果存在全局通知方法，也调用它
    if (typeof window.notifyParentHeightChange === 'function') {
      window.notifyParentHeightChange();
    }
  }, []);

  // 处理尺寸变化
  const handleSizeChange = useCallback((newSize: { width: number; height: number }) => {
    const { width: lastWidth, height: lastHeight } = lastSizeRef.current;
    
    // 检查是否真的发生了变化（避免无效触发）
    if (Math.abs(newSize.width - lastWidth) < 1 && Math.abs(newSize.height - lastHeight) < 1) {
      return;
    }

    // 更新记录的尺寸
    lastSizeRef.current = newSize;

    // 调用自定义回调
    if (onSizeChange) {
      onSizeChange(newSize);
    }

    // 通知父页面
    notifyParentHeightChange();

    console.log(`CommandWrapper size changed: ${newSize.width}x${newSize.height}`);
  }, [onSizeChange, notifyParentHeightChange]);

  // 防抖处理
  const debouncedHandleSizeChange = useCallback((newSize: { width: number; height: number }) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      handleSizeChange(newSize);
    }, debounceMs);
  }, [handleSizeChange, debounceMs]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    // 使用 ResizeObserver 监听尺寸变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        debouncedHandleSizeChange({ width, height });
      }
    });

    // 开始观察
    resizeObserver.observe(element);

    // 初始化时获取当前尺寸
    const rect = element.getBoundingClientRect();
    lastSizeRef.current = { width: rect.width, height: rect.height };

    // 清理函数
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [debouncedHandleSizeChange]);

  // 监听内容变化（作为 ResizeObserver 的补充）
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    // 使用 MutationObserver 监听 DOM 变化
    const mutationObserver = new MutationObserver(() => {
      // 延迟执行，等待 DOM 渲染完成
      setTimeout(() => {
        if (element) {
          const rect = element.getBoundingClientRect();
          debouncedHandleSizeChange({ width: rect.width, height: rect.height });
        }
      }, 50);
    });

    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      mutationObserver.disconnect();
    };
  }, [debouncedHandleSizeChange]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleWindowResize = () => {
      const element = wrapperRef.current;
      if (element) {
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          debouncedHandleSizeChange({ width: rect.width, height: rect.height });
        }, 100);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [debouncedHandleSizeChange]);

  return (
    <div 
      ref={wrapperRef}
      className={`command-wrapper ${className}`}
      style={{
        transition: 'all 0.2s ease-out' // 平滑的尺寸变化动画
      }}
    >
      {children}
    </div>
  );
};

export default CommandWrapper;
