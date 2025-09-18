//import { motion } from "motion/react";
import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import { BarChart3 } from "lucide-react";

interface Item { to: string; icon: ComponentType<any>; label: string; }
export default function Sidebar({ brand, items, footer }: { brand: string; items: Item[]; footer?: React.ReactNode }) {
  return (
    <aside className="w-64 hidden md:flex flex-col border-r bg-white">
      <div className="h-16 flex items-center gap-2 px-4 border-b">
        <BarChart3 className="text-brand"/> <span className="text-xl font-extrabold tracking-tight">{brand}</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({isActive}) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition ${isActive?"bg-brand text-white shadow-smooth":"hover:bg-slate-100"}`
            }
          >
            <it.icon className="h-4 w-4"/>
            <span className="font-medium">{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t">{footer}</div>
    </aside>
  );
}
