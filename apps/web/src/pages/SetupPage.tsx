import { useState, useCallback } from "react";
import { NewWorkspaceWizard, type NewWorkspaceWizardData } from "../components/screens/NewWorkspaceWizard/NewWorkspaceWizard";
import { trpc } from "../lib/trpc";

export function SetupPage() {
  const [error, setError] = useState("");
  const completeSetup = trpc.settings.completeSetup.useMutation();

  const handleCreateAccount = useCallback(async (name: string, email: string, password: string) => {
    const signupRes = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });

    if (!signupRes.ok) {
      const body = await signupRes.json().catch(() => ({}));
      throw new Error(body.message || "Failed to create account");
    }

    const signinRes = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!signinRes.ok) {
      throw new Error("Failed to sign in after account creation");
    }
  }, []);

  const handleSubmit = async (data: NewWorkspaceWizardData) => {
    setError("");
    try {
      await completeSetup.mutateAsync({
        orgName: data.orgName,
        orgLogo: data.orgLogo || undefined,
        accentColor: data.accentColor || undefined,
        website: data.website || undefined,
        niche: data.niche || undefined,
        subNiche: data.subNiche || undefined,
        country: data.country || undefined,
        language: data.language || undefined,
        timezone: data.timezone || undefined,
        currencies: data.currencies,
        invites: data.invites.filter((e) => e.trim()),
        onboardingPath: data.onboardingPath,
        selectedRoutines: data.selectedRoutines,
        emailProvider: data.emailProvider,
        smtpHost: data.smtpHost || undefined,
        smtpPort: data.smtpPort || undefined,
        smtpUser: data.smtpUser || undefined,
        smtpPass: data.smtpPass || undefined,
        smtpFrom: data.smtpFrom || undefined,
        smtpSecure: data.smtpSecure,
      });

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    }
  };

  return (
    <div style={{ height: "100vh", overflow: "auto" }}>
      {error && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 1000,
          }}
        >
          {error}
        </div>
      )}
      <NewWorkspaceWizard
        onSubmit={handleSubmit}
        onCreateAccount={handleCreateAccount}
      />
    </div>
  );
}
