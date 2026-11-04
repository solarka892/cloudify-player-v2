import "@fontsource-variable/manrope";
import "@fontsource-variable/unbounded";
import "@/styles/index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { queryClient } from "@/app/queryClient";
import { WholeApp } from "@/features/problems/Part";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

createRoot(root).render(
  <StrictMode>
    <WholeApp>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WholeApp>
  </StrictMode>,
);
