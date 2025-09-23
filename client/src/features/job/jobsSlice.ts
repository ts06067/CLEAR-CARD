import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getJobStatus, listMyJobs } from "../../api/jobs";
import type { JobSummary } from "../../api/jobs";
import { loadPins, togglePin } from "../../utils/pinned";

interface JobsState {
  items: JobSummary[];
  loading: boolean;
  error?: string;
}
const initial: JobsState = { items: [], loading: false };

export const fetchJobs = createAsyncThunk("jobs/list", async (_, { rejectWithValue, getState }) => {
  try {
    const res = await listMyJobs();
    const state: any = getState();
    const userId = state?.auth?.user?.id ?? "anon";
    const pinned = new Set(loadPins(userId));
    // Only keep jobs with a truthy id
    return res.filter(j => j.id).map(j => ({ ...j, pinned: pinned.has(j.id) }));
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "Failed to load jobs");
  }
});

export const pollStatuses = createAsyncThunk("jobs/poll", async (_, { getState, rejectWithValue }) => {
  try {
    const state: any = getState();
    const jobs: JobSummary[] = state.jobs.items;

    const updating = await Promise.all(
      jobs.map(async (j) => {
        if (!j.id) return j; // guard against undefined id
        if (j.status === "PENDING" || j.status === "QUEUED" || j.status === "RUNNING") {
          try {
            const s = await getJobStatus(j.id);
            const next = s.state as JobSummary["status"];
            if (next !== j.status) return { ...j, status: next };
          } catch {
            // ignore per-job polling errors, keep previous status
          }
        }
        return j;
      })
    );
    return updating;
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "Poll failed");
  }
});

const slice = createSlice({
  name: "jobs",
  initialState: initial,
  reducers: {
    togglePinnedLocal: (s, a) => {
      const id = a.payload.id as string;
      const userId = a.payload.userId as string;
      s.items = s.items.map((j) => (j.id === id ? { ...j, pinned: !j.pinned } : j));
      togglePin(userId, id);
    }
  },
  extraReducers: (b) => {
    b.addCase(fetchJobs.pending, (s) => {
      s.loading = true;
      s.error = undefined;
    });
    b.addCase(fetchJobs.fulfilled, (s, a) => {
      s.loading = false;
      s.items = a.payload;
    });
    b.addCase(fetchJobs.rejected, (s, a) => {
      s.loading = false;
      s.error = String(a.payload ?? a.error.message);
    });
    b.addCase(pollStatuses.fulfilled, (s, a) => {
      const prev = s.items;
      const next = a.payload;

      if (
        prev.length === next.length &&
        prev.every((p, i) => {
          const n = next[i]!;
          return (
            p.id === n.id &&
            p.status === n.status &&
            p.createdAt === n.createdAt &&
            p.title === n.title &&
            p.pinned === n.pinned
          );
        })
      ) {
        return;
      }
      s.items = next;
    });
  }
});

export const { togglePinnedLocal } = slice.actions;
export default slice.reducer;
