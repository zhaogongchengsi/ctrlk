import { useState, useCallback, useRef } from 'react';

/**
 * 处理中文输入法组合输入的自定义 Hook
 * 解决中文输入过程中搜索频繁触发的问题
 */
export function useCompositionInput(
  value: string,
  onChange: (value: string) => void,
  delay: number = 0
) {
  const [isComposing, setIsComposing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理组合开始
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  // 处理组合结束
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    setDisplayValue(newValue);
    
    if (delay > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, delay);
    } else {
      onChange(newValue);
    }
  }, [onChange, delay]);

  // 处理输入变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    
    // 非组合状态下立即更新
    if (!isComposing) {
      if (delay > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          onChange(newValue);
        }, delay);
      } else {
        onChange(newValue);
      }
    }
  }, [isComposing, onChange, delay]);

  // 清理定时器
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    value: displayValue,
    isComposing,
    handlers: {
      onChange: handleChange,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
    },
    cleanup,
  };
}
