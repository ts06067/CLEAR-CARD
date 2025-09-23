import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store"; // adjust if your store path differs
import type { JobSummary } from "../../api/jobs";

const selectJobsState = (s: RootState) => s.jobs;
export const selectJobsItems = createSelector(
  selectJobsState,
  (j): JobSummary[] => j?.items ?? []
);

// already used in your code; keep it memoized:
export const selectPinnedIds = createSelector(selectJobsItems, (items) =>
  items.filter((j) => j.pinned).map((j) => j.id)
);

// memoized list of pinned jobs (used by DashboardPage)
export const selectPinnedJobs = createSelector(selectJobsItems, (items) =>
  items.filter((j) => j.pinned)
);
