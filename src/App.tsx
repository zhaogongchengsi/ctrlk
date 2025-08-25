// import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-react";
import { useEffect } from "react";
import {
  Command,
  CommandEmpty,
  // CommandGroup,
  CommandInput,
  // CommandItem,
  CommandList,
  // CommandSeparator,
  // CommandShortcut,
} from "@/components/ui/command";

function App() {
  useEffect(() => {
    // 监听窗口失去焦点事件
    const handleWindowBlur = () => {
      // 延迟一点时间，避免在窗口内部点击时误触发
      setTimeout(() => {
        if (!document.hasFocus()) {
          window.close();
        }
      }, 100);
    };

    // 监听 ESC 键关闭窗口
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.close();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('keydown', handleKeyDown);

    // 确保窗口获得焦点
    window.focus();

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-transparent flex items-center justify-center">
      <Command className="rounded-lg border shadow-lg bg-white/95 backdrop-blur-sm md:min-w-[450px] max-w-[600px] mx-4">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {/* <CommandGroup heading="Suggestions">
            <CommandItem>
              <Calendar />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem>
              <Smile />
              <span>Search Emoji</span>
            </CommandItem>
            <CommandItem disabled>
              <Calculator />
              <span>Calculator</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <User />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <CreditCard />
              <span>Billing</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings />
              <span>Settings</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup> */}
        </CommandList>
      </Command>
    </div>
  );
}

export default App;
