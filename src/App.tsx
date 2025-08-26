// import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-react";
import { Command, CommandInput } from "@/components/ui/command";
import { useState, useCallback } from "react";
import { createDebouncedSearch } from "./search/search-api";
import type { SearchResult } from "./search/search-api";

const debouncedSearch = createDebouncedSearch(300);

function App() {
  const [, setResults] = useState<SearchResult[]>([]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // setLoading(true);
    try {
      const searchResults = await debouncedSearch(searchQuery, 20);
      console.log("Search results:", searchResults);
      setResults(searchResults);
      // setSelectedIndex(0);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      // setLoading(false);
    }
  }, []);


  return (
    <div className="w-full h-screen bg-transparent flex items-center justify-center">
      <Command className="rounded-lg border shadow-lg bg-white/95 backdrop-blur-sm md:min-w-[450px] max-w-[600px]">
        <CommandInput onValueChange={performSearch} placeholder="Type a command or search..." />
      </Command>
    </div>
  );
}

export default App;
