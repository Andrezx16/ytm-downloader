import { JobCard } from "./JobCard";
import type { JobRecord } from "./types";

interface JobListProps {
  jobs: JobRecord[];
  onCancel: (id: string) => void;
  onClear: (id: string) => void;
  emptyMessage?: string;
}

export function JobList({
  jobs,
  onCancel,
  onClear,
  emptyMessage = "No jobs",
}: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onCancel={onCancel}
          onClear={onClear}
        />
      ))}
    </div>
  );
}
