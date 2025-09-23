import { jsx as _jsx } from "react/jsx-runtime";
import { Star } from "lucide-react";
import { motion } from "motion/react";
export default function PinToggle({ pinned, onToggle }) {
    return (_jsx(motion.button, { whileTap: { scale: 0.95 }, className: `rounded-full p-2 ${pinned ? "text-yellow-500" : "text-slate-400"} hover:bg-slate-100`, title: pinned ? "Unpin" : "Pin to dashboard", onClick: onToggle, children: _jsx(Star, { className: `${pinned ? "fill-yellow-400" : ""}` }) }));
}
