import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import jobRunReducer from "../features/job/jobRunSlice";
import jobsReducer from "../features/job/jobsSlice";
export const store = configureStore({
    reducer: {
        auth: authReducer,
        jobRun: jobRunReducer,
        jobs: jobsReducer
    }
});
