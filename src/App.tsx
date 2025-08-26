// import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-react";
import { Command, CommandInput } from "@/components/ui/command";

function App() {
  chrome.runtime.sendMessage({ type: "HELLO_FROM_PAGE" }, (response) => {
    console.log("收到 background 的回复:", response);
  });

  return (
    <div className="w-full h-screen bg-transparent flex items-center justify-center">
      <Command className="rounded-lg border shadow-lg bg-white/95 backdrop-blur-sm md:min-w-[450px] max-w-[600px]">
        <CommandInput placeholder="Type a command or search..." />
      </Command>
    </div>
  );
}

export default App;
