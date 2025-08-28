import React, { useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useDialogLifecycle } from '../hooks/useDialogLifecycle';

interface CommandWrapperProps {
  children: ReactNode;
  onSizeChange?: (size: { width: number; height: number }) => void;
  onContentHeightChange?: (contentHeight: number) => void; // 新增：内容高度变化回调
  debounceMs?: number;
  className?: string;
  maxHeight?: number; // 新增：最大高度限制
  enableScrollCheck?: boolean; // 新增：是否启用滚动检查
  enableLifecycleUpdates?: boolean; // 新增：是否启用生命周期尺寸更新
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
  onContentHeightChange,
  debounceMs = 100,
  className = '',
  maxHeight,
  enableScrollCheck = true,
  enableLifecycleUpdates = true
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const lastContentHeightRef = useRef<number>(0);
  const debounceTimerRef = useRef<number | null>(null);

  // 计算精确的内容高度（包括所有子元素）
  const calculateContentHeight = useCallback(() => {
    const element = wrapperRef.current;
    if (!element) return 0;

    // 获取所有子元素的精确高度
    let totalHeight = 0;
    const children = Array.from(element.children);
    
    for (const child of children) {
      const childRect = child.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(child as Element);
      
      // 计算包含 margin 的总高度
      const marginTop = parseFloat(computedStyle.marginTop) || 0;
      const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
      
      totalHeight += childRect.height + marginTop + marginBottom;
    }

    // 添加容器的 padding
    const containerStyle = window.getComputedStyle(element);
    const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;
    
    totalHeight += paddingTop + paddingBottom;

    return Math.ceil(totalHeight); // 向上取整避免滚动条
  }, []);

  // 检查是否有滚动条
  const checkForScrollbars = useCallback(() => {
    const element = wrapperRef.current;
    if (!element || !enableScrollCheck) return false;

    const hasVerticalScrollbar = element.scrollHeight > element.clientHeight;
    const hasHorizontalScrollbar = element.scrollWidth > element.clientWidth;

    if (hasVerticalScrollbar || hasHorizontalScrollbar) {
      return true;
    }
    return false;
  }, [enableScrollCheck]);

  // 通知父页面高度变化
  const notifyParentHeightChange = useCallback((height: number) => {
    // 检查是否在 iframe 环境中
    if (window.parent !== window) {
      try {
        window.parent.postMessage({
          type: 'HEIGHT_CHANGE_NOTIFICATION',
          timestamp: Date.now(),
		      height,
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

    // 计算精确的内容高度
    const contentHeight = calculateContentHeight();
    const lastContentHeight = lastContentHeightRef.current;

    // 检查滚动条
    const hasScrollbars = checkForScrollbars();

    // 如果设置了最大高度，确保不超过限制
    let finalHeight = contentHeight;
    if (maxHeight && contentHeight > maxHeight) {
      finalHeight = maxHeight;
      console.log(`Content height ${contentHeight}px exceeds max height ${maxHeight}px, capped to ${finalHeight}px`);
    }

    // 更新记录的尺寸
    lastSizeRef.current = newSize;
    lastContentHeightRef.current = contentHeight;

    // 调用自定义回调
    if (onSizeChange) {
      onSizeChange({ width: newSize.width, height: finalHeight });
    }

    // 调用内容高度变化回调
    if (onContentHeightChange && Math.abs(contentHeight - lastContentHeight) >= 1) {
      onContentHeightChange(finalHeight);
    }

    // 通知父页面
    notifyParentHeightChange(finalHeight);

    console.log(`CommandWrapper size changed: ${newSize.width}x${newSize.height}, content: ${contentHeight}px${hasScrollbars ? ' (has scrollbars)' : ''}`);
  }, [onSizeChange, onContentHeightChange, notifyParentHeightChange, calculateContentHeight, checkForScrollbars, maxHeight]);

  // 防抖处理
  const debouncedHandleSizeChange = useCallback((newSize: { width: number; height: number }) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      handleSizeChange(newSize);
    }, debounceMs);
  }, [handleSizeChange, debounceMs]);

  // 触发尺寸更新的通用方法
  const triggerSizeUpdate = useCallback((reason: string = 'manual') => {
    const element = wrapperRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    console.log(`[CommandWrapper] Triggering size update (${reason}):`, { width: rect.width, height: rect.height });
    
    // 强制触发尺寸变化处理，重置记录的尺寸以确保触发
    lastSizeRef.current = { width: 0, height: 0 };
    setTimeout(() => {
      if (wrapperRef.current) {
        const newRect = wrapperRef.current.getBoundingClientRect();
        debouncedHandleSizeChange({ width: newRect.width, height: newRect.height });
      }
    }, 10);
  }, [debouncedHandleSizeChange]);

  // 使用生命周期 Hook 监听对话框状态变化
  const lifecycle = useDialogLifecycle({
    keepHistory: false,
    enableLogging: false,
    onEvent: (event, timestamp) => {
      if (!enableLifecycleUpdates) return;
      
      console.log(`[CommandWrapper] Dialog lifecycle event: ${event} at ${new Date(timestamp).toISOString()}`);
      
      // 在特定生命周期事件时触发尺寸更新
      switch (event) {
        case 'did-show':
          // 对话框完全显示后，立即更新尺寸
          setTimeout(() => {
            triggerSizeUpdate('lifecycle:did-show');
          }, 50);
          
          // 额外聚焦输入框
          setTimeout(() => {
            const input = document.querySelector('[data-slot="command-input"]') as HTMLInputElement;
            if (input) {
              input.focus();
              console.log('[CommandWrapper] Input focused after did-show');
            }
          }, 150);
          break;
        case 'will-hide':
          // 即将隐藏时也可以更新一次（可选）
          triggerSizeUpdate('lifecycle:will-hide');
          break;
      }
    }
  });

  // 为了消除 lint 警告，简单使用 lifecycle 变量
  if (lifecycle && enableLifecycleUpdates) {
    // lifecycle Hook 已正确初始化
  }

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

    // 初始化时获取当前尺寸和内容高度
    setTimeout(() => {
      const rect = element.getBoundingClientRect();
      const contentHeight = calculateContentHeight();

      lastSizeRef.current = { width: rect.width, height: rect.height };
      lastContentHeightRef.current = contentHeight;

      // 初始化时也通知一次
      if (onContentHeightChange) {
        onContentHeightChange(contentHeight);
      }

      console.log("CommandWrapper initialized:", {
        containerSize: { width: rect.width, height: rect.height },
        contentHeight: contentHeight,
      });
    }, 50); // 小延迟确保渲染完成

    // 清理函数
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [wrapperRef, debouncedHandleSizeChange, calculateContentHeight, onContentHeightChange]);

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
        transition: 'all 0.2s ease-out', // 平滑的尺寸变化动画
        overflow: 'hidden', // 防止出现滚动条
        height: 'auto', // 自动高度
        minHeight: 'fit-content', // 最小高度适应内容
        maxHeight: maxHeight ? `${maxHeight}px` : 'none', // 设置最大高度
        boxSizing: 'border-box' // 确保 padding 和 border 包含在尺寸内
      }}
    >
      {children}
    </div>
  );
};

export default CommandWrapper;
