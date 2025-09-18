import "./App.css";
import AppRoutes from "./routes/AppRoutes";

/**
 * Not strictly required (main.tsx can render <AppRoutes/> directly),
 * but provided since you asked for App.tsx.
 */
export default function App() {
  return <AppRoutes />;
}
