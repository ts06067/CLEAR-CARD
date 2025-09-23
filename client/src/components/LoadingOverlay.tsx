import { AnimatePresence, motion } from "motion/react";

/**
 * Page loading overlay that sits UNDER the fixed Topbar/Sidebar.
 * - Topbar z is expected >= 190, Sidebar z >= 180; we use z-150 here.
 * - Smooth blur/fade in & out.
 * - The spinner card remains clickable (pointer-events enabled on it only).
 */
export default function LoadingOverlay({ open, text }: { open: boolean; text?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="loading-overlay"
          className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, backdropFilter: "blur(0px)", backgroundColor: "rgba(255,255,255,0)" }}
          animate={{ opacity: 1, backdropFilter: "blur(4px)", backgroundColor: "rgba(255,255,255,0.35)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)", backgroundColor: "rgba(255,255,255,0)" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{ WebkitBackdropFilter: "blur(4px)" }} // Safari
        >
          <div className="flex flex-col items-center gap-3 pointer-events-auto">
            <div className="w-10 h-10 border-4 border-indigo-500/40 border-t-indigo-600 rounded-full animate-spin" />
            <div className="text-sm text-slate-700">{text ?? "Loading..."}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
