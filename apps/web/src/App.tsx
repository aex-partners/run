import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { SetupPage } from "./pages/SetupPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainApp } from "./pages/MainApp";
import { PublicFormPage } from "./pages/PublicFormPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/f/:token" element={<PublicFormPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={<MainApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
