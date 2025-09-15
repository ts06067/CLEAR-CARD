import { motion } from "motion/react";
export default function SqlPreview({ sql }: { sql: string }) {
  return (
    <motion.pre
      layout
      className="p-3 bg-slate-900 text-slate-100 text-xs rounded overflow-auto h-64"
      initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
    >
      {sql}
    </motion.pre>
  );
}
