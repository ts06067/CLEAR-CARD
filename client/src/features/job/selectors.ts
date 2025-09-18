import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";

export const selectJobsItems = (state: RootState) => state.jobs.items;

export const selectPinnedJobs = createSelector([selectJobsItems], (items) =>
  items.filter((j) => j.pinned)
);

// Keep a separate, memoized list of pinned IDs for effect deps
export const selectPinnedIds = createSelector([selectPinnedJobs], (pinned) =>
  pinned.map((j) => j.id)
);
