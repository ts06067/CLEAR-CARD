import { useAppSelector, useAppDispatch } from "../app/hooks";
import { LogOut, BarChart3 } from "lucide-react";
import { logout } from "../features/auth/authSlice";

/**
 * Compact top-left overlay bar:
 * - white blur + shadow
 * - readable height, small margins
 * - Left: logo trigger (hovering here opens the sidebar overlay)
 * - Middle: greeting
 * - Right: small Logout button
 */
export default function Topbar() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  return (
    <header
      className="fixed top-3 left-3 z-[190] px-3 py-2 border rounded-2xl
                 bg-white/85 backdrop-blur shadow-md flex items-center gap-3"
      style={{ minWidth: 360, maxWidth: "60vw" }}
    >
      {/* Hover this to open the sidebar overlay */}
      <button
        id="sidebar-hover-anchor"
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-white/80 hover:bg-white shadow-sm"
        title="Menu"
      >
        <BarChart3 className="text-brand h-4 w-4" />
        <span className="text-sm font-extrabold tracking-tight">CLEAR-CARD</span>
      </button>

      <div className="text-sm text-slate-700 truncate">
        {user?.name ? `Welcome, ${user.name}` : "v0.1.0-alpha"}
      </div>

      <div className="ml-auto">
        <button
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border hover:bg-gray-50"
          onClick={() => dispatch(logout())}
          title="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>
    </header>
  );
}
