import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  submitJob,
  getJobStatus,
  getResultJson,
  getResultCsvUrl
} from "../../api/jobs";

export interface JobState {
  submitting: boolean;
  jobId?: string;
  status?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  error?: string;
  result?: { json?: any[]; csvUrl?: string };
}
const initialState: JobState = { submitting: false };

export const runJob = createAsyncThunk(
  "job/run",
  async (sql: string, { rejectWithValue }) => {
    try {
      const { job_id } = await submitJob(sql, { format: "csv" });
      let status = await getJobStatus(job_id);
      const t0 = Date.now();

      while (
        (status.state === "PENDING" || status.state === "RUNNING") &&
        Date.now() - t0 < 10 * 60_000
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        status = await getJobStatus(job_id);
      }

      if (status.state !== "SUCCEEDED") {
        throw new Error(status.error || "Job failed");
      }

      const json = await getResultJson(job_id);
      const csvUrl = getResultCsvUrl(job_id);
      return { jobId: job_id, json, csvUrl };
    } catch (e: any) {
      return rejectWithValue(e.message ?? "Job failed");
    }
  }
);

const slice = createSlice({
  name: "job",
  initialState,
  reducers: { reset: () => initialState },
  extraReducers: (b) => {
    b.addCase(runJob.pending, (s) => {
      s.submitting = true;
      s.error = undefined;
      s.status = "PENDING";
    });
    b.addCase(runJob.fulfilled, (s, a) => {
      s.submitting = false;
      s.status = "SUCCEEDED";
      s.jobId = a.payload.jobId;
      s.result = { json: a.payload.json, csvUrl: a.payload.csvUrl };
    });
    b.addCase(runJob.rejected, (s, a) => {
      s.submitting = false;
      s.status = "FAILED";
      s.error = String(a.payload ?? a.error.message);
    });
  }
});

export const { reset } = slice.actions;
export default slice.reducer;
