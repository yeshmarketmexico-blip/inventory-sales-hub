import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/hooks/useSheetData";
import { DashboardLayout } from "@/components/DashboardLayout";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import PurchasesPage from "@/pages/PurchasesPage";
import SalesPage from "@/pages/SalesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DataProvider>
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route path="/compras" element={<PurchasesPage />} />
              <Route path="/ventas" element={<SalesPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardLayout>
        </DataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
