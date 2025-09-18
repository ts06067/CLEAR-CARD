import { Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Home, PlusSquare, ListTodo, LogOut } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useAppDispatch } from "../app/hooks";
import { logout } from "../features/auth/authSlice";

export default function DashboardLayout() {
  const loc = useLocation();
  const dispatch = useAppDispatch();

  const nav = [
    { to: "/dashboard", icon: Home, label: "Dashboard" },
    { to: "/jobs", icon: ListTodo, label: "Job Lists" },
    { to: "/jobs/create", icon: PlusSquare, label: "Create Job" }
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        brand="CLEAR-CARD"
        items={nav}
        footer={
          <button
            className="w-full btn btn-ghost mt-4"
            onClick={() => dispatch(logout())}
            title="Log out"
          >
            <LogOut className="mr-2 h-4 w-4"/> Logout
          </button>
        }
      />
      <div className="flex-1 flex flex-col">
        <Topbar/>
        <motion.main
          layout
          className="p-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          key={loc.pathname}
        >
          <Outlet/>
        </motion.main>
      </div>
    </div>
  );
}
