import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DailyLog from "@/pages/DailyLog";
import LifeInWeeks from "@/pages/LifeInWeeks";
import Finances from "@/pages/Finances";
import Business from "@/pages/Business";
import Trading from "@/pages/Trading";
import Growth from "@/pages/Growth";
import Mental from "@/pages/Mental";
import Relationships from "@/pages/Relationships";
import Books from "@/pages/Books";
import Login from "@/pages/Login";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={process.env.PUBLIC_URL}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/daily" element={<Layout><DailyLog /></Layout>} />
          <Route path="/life" element={<Layout><LifeInWeeks /></Layout>} />
          <Route path="/finances" element={<Layout><Finances /></Layout>} />
          <Route path="/trading" element={<Layout><Trading /></Layout>} />
          <Route path="/business" element={<Layout><Business /></Layout>} />
          <Route path="/growth" element={<Layout><Growth /></Layout>} />
          <Route path="/mental" element={<Layout><Mental /></Layout>} />
          <Route path="/relationships" element={<Layout><Relationships /></Layout>} />
          <Route path="/books" element={<Layout><Books /></Layout>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
