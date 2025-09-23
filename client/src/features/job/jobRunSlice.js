import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { submitJob } from "../../api/jobs";
const initial = { submitting: false };
export const createJob = createAsyncThunk("jobRun/create", async ({ sql, title, config }, { rejectWithValue }) => {
    try {
        const { job_id } = await submitJob(sql, { format: "csv", config, title });
        return job_id;
    }
    catch (e) {
        return rejectWithValue(e?.message ?? "Job submit failed");
    }
});
const slice = createSlice({
    name: "jobRun",
    initialState: initial,
    reducers: { reset: () => initial },
    extraReducers: (b) => {
        b.addCase(createJob.pending, (s) => { s.submitting = true; s.error = undefined; s.lastJobId = undefined; });
        b.addCase(createJob.fulfilled, (s, a) => { s.submitting = false; s.lastJobId = a.payload; });
        b.addCase(createJob.rejected, (s, a) => { s.submitting = false; s.error = String(a.payload ?? a.error.message); });
    }
});
export const { reset } = slice.actions;
export default slice.reducer;
