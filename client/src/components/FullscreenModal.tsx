import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function FullscreenModal({ open, title, onClose, children }: Props) {
  // Lock page scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000]">
          {/* BACKDROP: separate shade + blur layers for smoothness */}
          <motion.div
            key="shade"
            className="fixed inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.div
            key="blur"
            className="fixed inset-0 backdrop-blur-md"
            style={{ WebkitBackdropFilter: "blur(12px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={onClose}
          />

          {/* DIALOG */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-[95vw] max-h-[90vh] w-[1200px] bg-white rounded-2xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.985, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-medium">{title}</div>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-auto">{children}</div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
