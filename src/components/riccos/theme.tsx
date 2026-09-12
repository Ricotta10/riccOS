import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "riccos_theme";
export const DEFAULT_THEME: Theme = "dark";

/**
 * Script inline executado no <head> antes da hidratação para evitar flash de tema.
 * Mantém a mesma regra do provider: valor salvo > tema padrão (escuro).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t="${DEFAULT_THEME}"}var r=document.documentElement;r.classList.toggle("dark",t==="dark");var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",t==="dark"?"#000000":"#f6f6f6")}}catch(e){}})();`;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#000000" : "#f6f6f6");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Sincroniza com o valor que o boot script já aplicou no <html>.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      const initial: Theme = stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
      setThemeState(initial);
      applyTheme(initial);
    } catch {
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage indisponível (modo privado etc.) */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  return ctx;
}

export function ThemeToggle({
  className,
  size = "icon",
}: {
  className?: string;
  size?: "icon" | "icon-sm";
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      className={cn("relative text-muted-foreground hover:text-foreground", className)}
      title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      <Sun
        className={cn(
          "absolute transition-all duration-300",
          isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute transition-all duration-300",
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
        )}
      />
    </Button>
  );
}
