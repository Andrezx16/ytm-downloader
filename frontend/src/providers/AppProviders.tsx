import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { RouterProvider } from "./RouterProvider";
import { SettingsProvider } from "@/features/settings";
import { JobSubscriber } from "@/features/jobs/JobSubscriber";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <QueryProvider>
          <RouterProvider>
            <JobSubscriber />
            {children}
          </RouterProvider>
        </QueryProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
