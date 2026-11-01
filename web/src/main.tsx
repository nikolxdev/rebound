import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import MyBooking from "./pages/MyBooking";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/teren/:court" element={<Home />} />
        <Route path="/rezervacija/:code" element={<MyBooking />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
