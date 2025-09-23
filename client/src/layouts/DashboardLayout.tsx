import { Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Home, BookOpen, PlusSquare, ListTodo } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
//import { useAppDispatch } from "../app/hooks";

export default function DashboardLayout() {
  const loc = useLocation();
  //const dispatch = useAppDispatch();

  const nav = [
    { to: "/dashboard", icon: Home, label: "Dashboard" },
    { to: "/articles", icon: BookOpen, label: "Article Explorer" },
    { to: "/jobs", icon: ListTodo, label: "Job Lists" },
    { to: "/jobs/create", icon: PlusSquare, label: "Create Job" }
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        brand="CLEAR-CARD Data Explorer"
        items={nav}
        footer={
        null}
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
