import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { SetupPage } from "../features/auth/SetupPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { MainApp } from "../features/workspace/MainApp";
import { PublicFormPage } from "../features/forms/PublicFormPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
