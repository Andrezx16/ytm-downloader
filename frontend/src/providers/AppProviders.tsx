import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { RouterProvider } from "./RouterProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <RouterProvider>{children}</RouterProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
