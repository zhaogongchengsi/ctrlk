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
  
  // Items management
  registerItem: (id: string, value: string, _keywords?: string[], disabled?: boolean) => () => void;
  
  // Refs for DOM access
  listRef: React.RefObject<HTMLDivElement | null>;
  
  // Callbacks
  onSelect?: (value: string) => void;
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
const VALUE_ATTR = 'data-value';

// ===========================================
// Command Root Component
// ===========================================

export interface CommandRootProps {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  children?: React.ReactNode;
}

export const CommandRoot = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  Omit<React.ComponentPropsWithoutRef<typeof Primitive.div>, "onSelect"> & CommandRootProps
>(({ value = "", onValueChange, onSelect, children, className, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [search, setSearch] = React.useState(value);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const itemsRef = React.useRef<Map<string, { value: string; disabled: boolean }>>(new Map());
  const prevValueRef = React.useRef(value);
  const isControlled = value !== undefined;
  
  // External value control - 只在受控模式且 prop 真的变化时更新
  React.useEffect(() => {
    if (isControlled && value !== prevValueRef.current) {
      prevValueRef.current = value;
      setSearch(value);
      setInternalValue(value);
    }
  }, [value, isControlled]);

  // 使用 useCallback 来稳定 setSearch 函数，避免子组件重复渲染
  const stableSetSearch = React.useCallback((newSearch: string) => {
    setSearch(newSearch);
    if (!isControlled) {
      // 非受控模式下通知父组件
      onValueChange?.(newSearch);
    }
  }, [isControlled, onValueChange]);

  // 受控模式下，当内部搜索值变化时通知父组件
  React.useEffect(() => {
    if (isControlled && search !== value) {
      onValueChange?.(search);
    }
  }, [search, value, isControlled, onValueChange]);

  // Update selected item's aria-selected attribute
  React.useEffect(() => {
    if (!listRef.current) return;
    
    // Remove previous selection
    const prevSelected = listRef.current.querySelector('[aria-selected="true"]');
    if (prevSelected) {
      prevSelected.setAttribute('aria-selected', 'false');
      prevSelected.setAttribute('data-selected', 'false');
    }
    
    // Set new selection
    if (internalValue) {
      const newSelected = listRef.current.querySelector(`[${VALUE_ATTR}="${internalValue}"]`);
      if (newSelected) {
        newSelected.setAttribute('aria-selected', 'true');
        newSelected.setAttribute('data-selected', 'true');
        // Scroll into view
        newSelected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [internalValue]);

  const setValue = React.useCallback((newValue: string) => {
    setInternalValue(newValue);
    if (value === undefined) {
      // Uncontrolled mode, update internal state
      onValueChange?.(newValue);
    }
  }, [value, onValueChange]);

  const registerItem = React.useCallback((
    id: string, 
    itemValue: string, 
    _keywords?: string[], // Prefix with underscore to indicate intentionally unused
    disabled?: boolean
  ) => {
    // Store item data (keywords could be used for enhanced search in the future)
    itemsRef.current.set(id, { value: itemValue, disabled: disabled || false });
    
    return () => {
      itemsRef.current.delete(id);
    };
  }, []);

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

  const updateSelectedByItem = React.useCallback((change: 1 | -1) => {
    const items = getValidItems();
    const currentIndex = items.findIndex(item => 
      item.getAttribute(VALUE_ATTR) === internalValue
    );
    
    let newIndex = currentIndex + change;
    
    // Wrap around
    if (newIndex < 0) newIndex = items.length - 1;
    if (newIndex >= items.length) newIndex = 0;
    
    const newItem = items[newIndex];
    if (newItem) {
      const value = newItem.getAttribute(VALUE_ATTR);
      if (value) setValue(value);
    }
  }, [getValidItems, internalValue, setValue]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
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
          onSelect?.(internalValue);
        }
        break;
      }
      case "Escape": {
        event.preventDefault();
        setValue("");
        break;
      }
    }
  }, [updateSelectedByItem, internalValue, onSelect, setValue]);

  // Auto-select first item when search changes and no current selection
  React.useEffect(() => {
    if (search && !internalValue) {
      // Small delay to let items register
      const timer = setTimeout(selectFirstItem, 10);
      return () => clearTimeout(timer);
    }
  }, [search, internalValue, selectFirstItem]);

  const contextValue: CommandContextValue = React.useMemo(() => ({
    value: internalValue,
    setValue,
    search,
    setSearch: stableSetSearch,
    registerItem,
    listRef,
    onSelect,
    onValueChange,
  }), [internalValue, setValue, search, stableSetSearch, registerItem, onSelect, onValueChange]);

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

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof Primitive.input>,
  React.ComponentPropsWithoutRef<typeof Primitive.input>
>(({ className, ...props }, ref) => {
  const { search, setSearch } = useCommand();
  const [isComposing, setIsComposing] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(search);
  const lastSearchRef = React.useRef(search);

  // 同步外部搜索值到内部值
  React.useEffect(() => {
    // 只有在不是用户正在输入时才同步外部值
    if (search !== lastSearchRef.current && !isComposing) {
      setInternalValue(search);
      lastSearchRef.current = search;
    }
  }, [search, isComposing]);

  // 处理中文输入法组合事件
  const handleCompositionStart = React.useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = React.useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setIsComposing(false);
    setInternalValue(value);
    lastSearchRef.current = value;
    setSearch(value);
  }, [setSearch]);

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInternalValue(value);
    
    // 只有在非组合状态下才更新搜索值
    if (!isComposing) {
      lastSearchRef.current = value;
      setSearch(value);
    }
  }, [isComposing, setSearch]);

  return (
    <div data-slot="command-input-wrapper">
      <Primitive.input
        ref={ref}
        value={internalValue}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
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
        if (typeof ref === 'function') ref(node);
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
        <div 
          cmdk-group-heading="" 
          aria-hidden 
          id={headingId}
        >
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
  onSelect?: (value: string) => void;
  keywords?: string[];
  children?: React.ReactNode;
}

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof Primitive.div>,
  Omit<React.ComponentPropsWithoutRef<typeof Primitive.div>, "onSelect"> & CommandItemProps
>(({ value, className, disabled = false, onSelect, keywords, children, ...props }, ref) => {
  const id = React.useId();
  const { registerItem, setValue, onSelect: contextOnSelect } = useCommand();
  const itemRef = React.useRef<HTMLDivElement>(null);
  
  // Use value from props or generate from children
  const itemValue = React.useMemo(() => {
    if (value) return value;
    if (typeof children === 'string') return children;
    return id; // fallback to unique id
  }, [value, children, id]);

  // Register this item
  React.useEffect(() => {
    return registerItem(id, itemValue, keywords, disabled);
  }, [registerItem, id, itemValue, keywords, disabled]);

  // Combine refs
  React.useImperativeHandle(ref, () => itemRef.current!);

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      setValue(itemValue);
      onSelect?.(itemValue);
      contextOnSelect?.(itemValue);
    }
  }, [disabled, itemValue, onSelect, contextOnSelect, setValue]);

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
