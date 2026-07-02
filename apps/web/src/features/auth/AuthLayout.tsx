import type { ReactNode } from "react";
import { AexLogo } from "../../shared/ui/AexLogo/AexLogo";
import { AuthShowcase } from "./AuthShowcase";

// Two-column shell shared by every auth screen: the form sits in the left
// column, the AuthShowcase marketing panel in the right. The right panel
// collapses below the lg breakpoint, leaving a centered single-column form.

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid min-h-screen lg:grid-cols-2"
      style={{ background: "var(--background)" }}
    >
      <div className="flex items-center justify-center px-6 py-12">
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <AexLogo size={28} />
          </div>
          {children}
        </div>
      </div>

      <AuthShowcase />
    </div>
  );
}
