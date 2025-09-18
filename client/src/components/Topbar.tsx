import { useAppSelector } from "../app/hooks";
import { motion } from "motion/react";

export default function Topbar() {
  const user = useAppSelector(s=>s.auth.user);
  return (
    <motion.header
      layout
      className="h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-10"
    >
      <div className="font-semibold text-brand text-lg">Welcome{user?.name?`, ${user.name}`:""}.</div>
      <div className="text-sm text-slate-500">{user?.email}</div>
    </motion.header>
  );
}
