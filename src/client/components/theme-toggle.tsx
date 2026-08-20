import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size={collapsed ? "icon" : "default"} className={collapsed ? "w-full" : "w-full justify-start"}><Icon />{!collapsed && <span>Appearance</span>}<span className="sr-only">Change appearance</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end" side="right"><DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}><DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem><DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem><DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}
