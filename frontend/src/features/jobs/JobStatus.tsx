import type { JobState } from "@/types";

interface JobStatusProps {
  state: JobState;
}

const STATE_STYLES: Record<JobState, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export function JobStatus({ state }: JobStatusProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}>
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </span>
  );
}
