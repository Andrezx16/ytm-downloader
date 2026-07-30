import { useCallback, useMemo } from "react";
import { cancelJob } from "@/api";
import { Page } from "@/components/layout/Page";
import { useJobs } from "./hooks";
import { JobList } from "./JobList";
import { removeJob, updateJob } from "./store";

export function JobsPage() {
  const jobs = useJobs();

  const active = useMemo(
    () => jobs.filter((j) => j.state === "queued" || j.state === "running"),
    [jobs],
  );

  const completed = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.state === "completed" ||
          j.state === "failed" ||
          j.state === "cancelled",
      ),
    [jobs],
  );

  const handleCancel = useCallback(async (id: string) => {
    try {
      const result = await cancelJob(id);
      updateJob(id, {
        state: result.state,
        progress: result.progress,
        message: result.message,
        error: result.error,
      });
    } catch {
      // ignore
    }
  }, []);

  const handleClear = useCallback((id: string) => {
    removeJob(id);
  }, []);

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Downloads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active and completed downloads
          </p>
        </div>

        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Active ({active.length})
          </h2>
          <JobList
            jobs={active}
            onCancel={handleCancel}
            onClear={handleClear}
            emptyMessage="No active downloads"
          />
        </section>

        {completed.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              History ({completed.length})
            </h2>
            <JobList
              jobs={completed}
              onCancel={handleCancel}
              onClear={handleClear}
              emptyMessage="No completed downloads"
            />
          </section>
        )}
      </div>
    </Page>
  );
}
