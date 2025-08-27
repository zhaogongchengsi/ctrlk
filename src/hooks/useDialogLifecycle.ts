import { useEffect, useState } from 'react';
import { fromEvent, filter, takeUntil, Subject } from 'rxjs';

// 定义生命周期事件类型
export type DialogLifecycleEvent = 'will-show' | 'did-show' | 'will-hide' | 'did-hide';

// 定义消息数据结构
export interface DialogLifecycleMessage {
  type: 'DIALOG_LIFECYCLE';
  event: DialogLifecycleEvent;
  timestamp: number;
}

// 定义 hook 的状态
export interface DialogLifecycleState {
  currentEvent: DialogLifecycleEvent | null;
  isVisible: boolean;
  lastEventTime: number | null;
  eventHistory: Array<{
    event: DialogLifecycleEvent;
    timestamp: number;
  }>;
}

// 定义 hook 选项
export interface UseDialogLifecycleOptions {
  // 是否记录事件历史
  keepHistory?: boolean;
  // 历史记录最大长度
  maxHistoryLength?: number;
  // 是否在控制台输出日志
  enableLogging?: boolean;
  // 自定义事件处理器
  onEvent?: (event: DialogLifecycleEvent, timestamp: number) => void;
  // 聚焦输入框处理器
  onFocusInput?: () => void;
}

/**
 * 使用 RxJS 封装的对话框生命周期监听 Hook
 * 监听来自父级页面发送的生命周期事件
 */
export function useDialogLifecycle(options: UseDialogLifecycleOptions = {}) {
  const {
    keepHistory = true,
    maxHistoryLength = 50,
    enableLogging = false,
    onEvent,
    onFocusInput
  } = options;

  // Hook 状态
  const [state, setState] = useState<DialogLifecycleState>({
    currentEvent: null,
    isVisible: false,
    lastEventTime: null,
    eventHistory: []
  });

  // 用于清理订阅的 Subject
  const [destroy$] = useState(() => new Subject<void>());

  useEffect(() => {
    // 创建消息事件流
    const message$ = fromEvent<MessageEvent>(window, 'message').pipe(
      // 过滤出对话框相关消息
      filter((event): event is MessageEvent<DialogLifecycleMessage | { type: 'FOCUS_INPUT' }> => {
        return event.data?.type === 'DIALOG_LIFECYCLE' || event.data?.type === 'FOCUS_INPUT';
      }),
      // 组件卸载时停止监听
      takeUntil(destroy$)
    );

    // 订阅消息流
    const subscription = message$.subscribe({
      next: (event) => {
        if (event.data.type === 'FOCUS_INPUT') {
          // 处理聚焦输入框请求
          if (onFocusInput) {
            onFocusInput();
          }
        } else if (event.data.type === 'DIALOG_LIFECYCLE') {
          // 处理生命周期事件
          const { event: lifecycleEvent, timestamp } = event.data;
          
          if (enableLogging) {
            console.log(`[useDialogLifecycle] Received event: ${lifecycleEvent} at ${new Date(timestamp).toISOString()}`);
          }

          // 更新状态
          setState(prevState => {
            const newEventHistory = keepHistory 
              ? [...prevState.eventHistory, { event: lifecycleEvent, timestamp }].slice(-maxHistoryLength)
              : [];

            return {
              currentEvent: lifecycleEvent,
              isVisible: lifecycleEvent === 'did-show' || (lifecycleEvent === 'will-show' && prevState.isVisible),
              lastEventTime: timestamp,
              eventHistory: newEventHistory
            };
          });

          // 调用自定义事件处理器
          if (onEvent) {
            onEvent(lifecycleEvent, timestamp);
          }
        }
      },
      error: (error) => {
        console.error('[useDialogLifecycle] Error in message stream:', error);
      }
    });

    // 清理函数
    return () => {
      subscription.unsubscribe();
    };
  }, [keepHistory, maxHistoryLength, enableLogging, onEvent, onFocusInput, destroy$]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      destroy$.next();
      destroy$.complete();
    };
  }, [destroy$]);

  // 提供一些便捷的方法
  const utils = {
    // 检查是否是特定事件
    isEvent: (event: DialogLifecycleEvent) => state.currentEvent === event,
    
    // 检查是否刚刚发生某个事件（在指定时间内）
    isRecentEvent: (event: DialogLifecycleEvent, withinMs = 1000) => {
      if (state.currentEvent !== event || !state.lastEventTime) {
        return false;
      }
      return Date.now() - state.lastEventTime <= withinMs;
    },

    // 获取特定事件的历史记录
    getEventHistory: (event?: DialogLifecycleEvent) => {
      if (!event) return state.eventHistory;
      return state.eventHistory.filter(item => item.event === event);
    },

    // 清除事件历史
    clearHistory: () => {
      setState(prev => ({ ...prev, eventHistory: [] }));
    }
  };

  return {
    // 状态
    ...state,
    
    // 工具方法
    ...utils
  };
}

// 创建一个更简单的版本，只关注可见状态
export function useDialogVisibility() {
  const { isVisible, currentEvent } = useDialogLifecycle({
    keepHistory: false,
    enableLogging: false
  });

  return {
    isVisible,
    currentEvent,
    isShowing: currentEvent === 'will-show' || currentEvent === 'did-show',
    isHiding: currentEvent === 'will-hide' || currentEvent === 'did-hide'
  };
}

// 创建一个专门用于事件回调的版本
export function useDialogLifecycleCallback(
  callback: (event: DialogLifecycleEvent, timestamp: number) => void
) {
  useDialogLifecycle({
    keepHistory: false,
    enableLogging: false,
    onEvent: callback
  });
}

// 创建一个专门处理输入框聚焦的 Hook
export function useInputFocus(inputRef?: React.RefObject<HTMLInputElement | null>) {
  useDialogLifecycle({
    keepHistory: false,
    enableLogging: false,
    onFocusInput: () => {
      // 聚焦指定的输入框
      if (inputRef?.current) {
        inputRef.current.focus();
        console.log('[useInputFocus] Input focused via ref');
      } else {
        // 如果没有指定 ref，尝试聚焦页面中的第一个输入框
        const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
        const firstInput = inputs[0] as HTMLInputElement;
        if (firstInput) {
          firstInput.focus();
          console.log('[useInputFocus] First input focused');
        } else {
          // 尝试聚焦 cmdk 输入框
          const cmdkInput = document.querySelector('[data-slot="command-input"]') as HTMLInputElement;
          if (cmdkInput) {
            cmdkInput.focus();
            console.log('[useInputFocus] CMDK input focused');
          }
        }
      }
    }
  });
}
