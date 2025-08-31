import * as React from "react";
import { Primitive } from "@radix-ui/react-primitive";
import { cn } from "@/lib/utils";

// ===========================================
// Types and Interfaces
// ===========================================

interface CommandContextValue {
  // Selection state
  value: string;
  setValue: (value: string) => void;

  // Search state
  search: string;
  setSearch: (search: string) => void;
  clearAll: () => void;

  // Items management
  registerItem: (id: string, value: string, type?: string, _keywords?: string[], disabled?: boolean) => () => void;

  // Refs for DOM access
  listRef: React.RefObject<HTMLDivElement | null>;

  // Callbacks
  onSelect?: (value: string, type?: string) => void;
  onValueChange?: (value: string) => void;
}

const CommandContext = React.createContext<CommandContextValue | null>(null);

const useCommand = () => {
  const context = React.useContext(CommandContext);
  if (!context) {
    throw new Error("Command components must be used within CommandRoot");
  }
  return context;
};

// ===========================================
// Constants
// ===========================================

const ITEM_SELECTOR = '[cmdk-item=""]';
const VALID_ITEM_SELECTOR = `${ITEM_SELECTOR}:not([aria-disabled="true"])`;
const VALUE_ATTR = "data-value";

// ===========================================
// Command Root Component
// ===========================================

export interface CommandRootProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string, type?: string) => void;
  children?: React.ReactNode;
}

export const CommandRoot = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  Omit<React.ComponentPropsWithoutRef<typeof Primitive.div>, "onSelect"> & CommandRootProps
>(({ onValueChange, onSelect, children, className, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState("");
  const [search, setSearch] = React.useState("");
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const itemsRef = React.useRef<Map<string, { value: string; type?: string; disabled: boolean }>>(new Map());

  // 简化搜索值通知逻辑，避免不必要的调用
  const searchNotified = React.useRef("");
  React.useEffect(() => {
    if (search !== searchNotified.current) {
      searchNotified.current = search;
      onValueChange?.(search);
    }
  }, [search, onValueChange]);

  // 清空所有状态的方法
  const clearAll = React.useCallback(() => {
    setInternalValue("");
    setSearch("");
    searchNotified.current = "";
  }, []);

  // Update selected item's aria-selected attribute
  React.useEffect(() => {
    if (!listRef.current) return;

    // Remove previous selection
    const prevSelected = listRef.current.querySelector('[aria-selected="true"]');
    if (prevSelected) {
      prevSelected.setAttribute("aria-selected", "false");
      prevSelected.setAttribute("data-selected", "false");
    }

    // Set new selection
    if (internalValue) {
      const newSelected = listRef.current.querySelector(`[${VALUE_ATTR}="${internalValue}"]`);
      if (newSelected) {
        newSelected.setAttribute("aria-selected", "true");
        newSelected.setAttribute("data-selected", "true");
        // Scroll into view
        newSelected.scrollIntoView({ block: "nearest" });
      }
    }
  }, [internalValue]);

  const setValue = React.useCallback((newValue: string) => {
    setInternalValue(newValue);
  }, []);

  const registerItem = React.useCallback(
    (
      id: string,
      itemValue: string,
      type?: string,
      _keywords?: string[], // Prefix with underscore to indicate intentionally unused
      disabled?: boolean,
    ) => {
      console.log("Registering item:", { id, itemValue, type, disabled, items: itemsRef.current });
      // Store item data (keywords could be used for enhanced search in the future)
      itemsRef.current.set(id, { value: itemValue, type, disabled: disabled || false });

      return () => {
        itemsRef.current.delete(id);
      };
    },
    [],
  );

  const getValidItems = React.useCallback(() => {
    return Array.from(listRef.current?.querySelectorAll(VALID_ITEM_SELECTOR) || []);
  }, []);

  const selectFirstItem = React.useCallback(() => {
    const items = getValidItems();
    const firstItem = items[0];
    if (firstItem) {
      const value = firstItem.getAttribute(VALUE_ATTR);
      if (value) setValue(value);
    }
  }, [getValidItems, setValue]);

  const updateSelectedByItem = React.useCallback(
    (change: 1 | -1) => {
      const items = getValidItems();
      const currentIndex = items.findIndex((item) => item.getAttribute(VALUE_ATTR) === internalValue);

      let newIndex = currentIndex + change;

      // Wrap around
      if (newIndex < 0) newIndex = items.length - 1;
      if (newIndex >= items.length) newIndex = 0;

      const newItem = items[newIndex];
      if (newItem) {
        const value = newItem.getAttribute(VALUE_ATTR);
        if (value) setValue(value);
      }
    },
    [getValidItems, internalValue, setValue],
  );

  const select = React.useCallback(
    (id: string) => {
      const item = itemsRef.current.get(id);
      console.log("Selecting item:", { id, item, items: itemsRef.current });
      if (item && !item.disabled) {
        setValue(item.value);
        onSelect?.(item.value, item.type);
      }
    },
    [onSelect, setValue, itemsRef],
  );

  // Keyboard navigation - 参考 cmdk 的实现
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      // IME 组合输入检测，参考 cmdk 实现
      const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;

      // 如果事件已被阻止或正在 IME 组合输入中，不处理键盘导航
      if (event.defaultPrevented || isComposing) {
        return;
      }

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          updateSelectedByItem(1);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          updateSelectedByItem(-1);
          break;
        }
        case "Enter": {
          event.preventDefault();
          if (internalValue) {
            console.log("Enter pressed, selecting:", internalValue);
            select(internalValue);
          } else if (search.trim()) {
            // TODO: 如果没有选择任何项目但有搜索内容，触发搜索
            // select(search.trim());
          }
          break;
        }
        case "Escape": {
          event.preventDefault();
          clearAll();
          break;
        }
      }
    },
    [updateSelectedByItem, internalValue, select, clearAll, search],
  );

  // Auto-select first item when search changes and no current selection
  React.useEffect(() => {
    if (search && !internalValue) {
      // Small delay to let items register
      const timer = setTimeout(selectFirstItem, 10);
      return () => clearTimeout(timer);
    }
  }, [search, internalValue, selectFirstItem]);

  const contextValue: CommandContextValue = React.useMemo(
    () => ({
      value: internalValue,
      setValue,
      search,
      setSearch,
      clearAll,
      registerItem,
      listRef,
      onSelect,
      onValueChange,
    }),
    [internalValue, setValue, search, setSearch, clearAll, registerItem, onSelect, onValueChange],
  );

  return (
    <CommandContext.Provider value={contextValue}>
      <Primitive.div
        ref={ref}
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        onKeyDown={handleKeyDown}
        cmdk-root=""
        data-slot="command"
        className={cn("bg-[var(--gray2)] flex h-full w-full flex-col rounded-md ctrl-k-command", className)}
        {...props}
      >
        {children}
      </Primitive.div>
    </CommandContext.Provider>
  );
});

CommandRoot.displayName = "CommandRoot";

// ===========================================
// Command Input Component
// ===========================================

export interface CommandInputProps {
  value?: string;
  onValueChange?: (search: string) => void;
}

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof Primitive.input>,
  React.ComponentPropsWithoutRef<typeof Primitive.input> & CommandInputProps
>(({ className, value: propValue, onValueChange, ...props }, ref) => {
  const { search, setSearch } = useCommand();
  const isControlled = propValue != null;

  // 当受控 value 变化时更新内部搜索状态
  React.useEffect(() => {
    if (propValue != null) {
      setSearch(propValue);
    }
  }, [propValue, setSearch]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      if (isControlled) {
        // 受控模式：通知父组件值变化
        onValueChange?.(newValue);
      } else {
        // 非受控模式：直接更新内部状态
        setSearch(newValue);
      }
    },
    [isControlled, onValueChange, setSearch],
  );

  return (
    <div data-slot="command-input-wrapper">
      <Primitive.input
        ref={ref}
        value={isControlled ? propValue : search}
        onChange={handleChange}
        cmdk-input=""
        data-slot="command-input"
        className={cn("ctrlk-command-input", className)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        {...props}
      />
    </div>
  );
});

CommandInput.displayName = "CommandInput";

// ===========================================
// Command List Component
// ===========================================

export const CommandList = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ className, ...props }, ref) => {
  const { listRef } = useCommand();

  return (
    <Primitive.div
      ref={(node) => {
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
        if (listRef && node) listRef.current = node;
      }}
      cmdk-list=""
      data-slot="cmdk-command-list"
      className={cn("ctrlk-command-list", className)}
      role="listbox"
      {...props}
    />
  );
});

CommandList.displayName = "CommandList";

// ===========================================
// Command Empty Component
// ===========================================

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ className, ...props }, ref) => {
  return (
    <Primitive.div
      ref={ref}
      cmdk-empty=""
      data-slot="command-empty"
      className={cn("py-12 text-center text-base text-gray-500 dark:text-gray-400 font-medium", className)}
      role="presentation"
      {...props}
    />
  );
});

CommandEmpty.displayName = "CommandEmpty";

// ===========================================
// Command Group Component
// ===========================================

export interface CommandGroupProps {
  heading?: React.ReactNode;
  children?: React.ReactNode;
}

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div> & CommandGroupProps
>(({ heading, className, children, ...props }, ref) => {
  const headingId = React.useId();

  return (
    <Primitive.div
      ref={ref}
      cmdk-group=""
      data-slot="command-group"
      className={cn(
        "text-foreground overflow-hidden [&_[cmdk-group-heading]]:px-[8px] [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:text-[var(--gray11)]",
        className,
      )}
      role="presentation"
      {...props}
    >
      {heading && (
        <div cmdk-group-heading="" aria-hidden id={headingId}>
          {heading}
        </div>
      )}
      <div cmdk-group-items="" role="group" aria-labelledby={heading ? headingId : undefined}>
        {children}
      </div>
    </Primitive.div>
  );
});

CommandGroup.displayName = "CommandGroup";

// ===========================================
// Command Item Component
// ===========================================

export interface CommandItemProps {
  value?: string;
  disabled?: boolean;
  onSelect?: (value: string, type?: string) => void;
  keywords?: string[];
  children?: React.ReactNode;
  type?: string; // 添加类型属性
}

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  Omit<React.ComponentPropsWithoutRef<typeof Primitive.div>, "onSelect"> & CommandItemProps
>(({ value, className, disabled = false, onSelect, keywords, children, type, ...props }, ref) => {
  const id = React.useId();
  const { registerItem, setValue, onSelect: contextOnSelect } = useCommand();
  const itemRef = React.useRef<HTMLDivElement>(null);

  // Use value from props or generate from children
  const itemValue = React.useMemo(() => {
    if (value) return value;
    if (typeof children === "string") return children;
    return id; // fallback to unique id
  }, [value, children, id]);

  // Register this item
  React.useEffect(() => {
    return registerItem(value ?? id, itemValue, type, keywords, disabled);
  }, [registerItem, value, itemValue, keywords, disabled, type, id]);

  // Combine refs
  React.useImperativeHandle(ref, () => itemRef.current!);

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      setValue(itemValue);
      onSelect?.(itemValue, type);
      contextOnSelect?.(itemValue, type);
    }
  }, [disabled, itemValue, onSelect, contextOnSelect, setValue, type]);

  const handleMouseEnter = React.useCallback(() => {
    if (!disabled) {
      setValue(itemValue);
    }
  }, [disabled, itemValue, setValue]);

  return (
    <Primitive.div
      ref={itemRef}
      cmdk-item=""
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-[var(--gray4)] data-[selected=true]:text-[var(--gray12)] [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      role="option"
      aria-disabled={Boolean(disabled)}
      aria-selected={false} // Will be updated by CommandRoot
      data-disabled={Boolean(disabled)}
      data-selected={false} // Will be updated by CommandRoot
      data-value={itemValue}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Primitive.div>
  );
});

CommandItem.displayName = "CommandItem";

// ===========================================
// Command Separator Component
// ===========================================

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  React.ComponentPropsWithoutRef<typeof Primitive.div>
>(({ className, ...props }, ref) => {
  return (
    <Primitive.div
      ref={ref}
      cmdk-separator=""
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      role="separator"
      {...props}
    />
  );
});

CommandSeparator.displayName = "CommandSeparator";
