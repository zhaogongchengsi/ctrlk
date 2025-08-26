// import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

function App() {
  return (
    <div className="w-full h-screen bg-transparent flex items-center justify-center">
      <Command className="rounded-lg border shadow-lg bg-white/95 backdrop-blur-sm md:min-w-[450px] max-w-[600px]">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          {/* <CommandEmpty>No results found.</CommandEmpty> */}
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
