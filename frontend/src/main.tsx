import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "@/app/store";
import AppRoutes from "@/routes"; // ✅ Use AppRoutes
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>  {/* ✅ Wrap with Redux Provider */}
      <AppRoutes />  {/* ✅ Use new modular routes */}
    </Provider>
  </StrictMode>
);
