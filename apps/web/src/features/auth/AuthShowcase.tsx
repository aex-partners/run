import { useTranslation } from "react-i18next";

// Right-hand marketing panel for the auth screens. A CSS-only mock of the AEX
// app (chat column + data grid) sits on a brand gradient, in the Linear /
// Supabase "product screenshot" style. Hidden below the lg breakpoint so the
// form takes the full width on narrow screens.

const dot = (color: string) => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: color,
});

function ChatBubble({ align, width }: { align: "left" | "right"; width: number }) {
  return (
    <div
      style={{
        alignSelf: align === "right" ? "flex-end" : "flex-start",
        width,
        height: 22,
        borderRadius: 8,
        background:
          align === "right" ? "var(--accent)" : "rgba(255,255,255,0.14)",
        opacity: align === "right" ? 0.9 : 1,
      }}
    />
  );
}

function GridRow({ accent }: { accent?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", height: 26 }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          background: accent ? "var(--accent)" : "rgba(255,255,255,0.18)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 2, height: 9, borderRadius: 4, background: "rgba(255,255,255,0.18)" }} />
      <div style={{ flex: 1, height: 9, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />
      <div
        style={{
          width: 40,
          height: 14,
          borderRadius: 999,
          background: accent ? "rgba(10,10,10,0.35)" : "rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

export function AuthShowcase() {
  const { t } = useTranslation();

  const features = [
    t("authShowcase.feature1"),
    t("authShowcase.feature2"),
    t("authShowcase.feature3"),
  ];

  return (
    <div
      className="hidden lg:flex"
      style={{
        position: "relative",
        flexDirection: "column",
        justifyContent: "center",
        gap: 44,
        padding: "56px 64px",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, #1f2937 0%, #111827 55%, #0b1220 100%)",
      }}
    >
      {/* Brand glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -140,
          right: -100,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(10,10,10,0.38), transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      {/* Headline */}
      <div style={{ position: "relative", maxWidth: 460 }}>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#fff",
            marginBottom: 14,
          }}
        >
          {t("authShowcase.title")}
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.7)",
            margin: 0,
          }}
        >
          {t("authShowcase.subtitle")}
        </p>
      </div>

      {/* App window mock */}
      <div
        aria-hidden
        style={{
          position: "relative",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(17,24,39,0.6)",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
          overflow: "hidden",
          maxWidth: 520,
        }}
      >
        {/* Window title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={dot("#ef4444")} />
          <div style={dot("#f59e0b")} />
          <div style={dot("#22c55e")} />
        </div>

        {/* Two-pane body: chat + data grid */}
        <div style={{ display: "flex", minHeight: 200 }}>
          {/* Chat pane */}
          <div
            style={{
              width: "44%",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <ChatBubble align="left" width={120} />
            <ChatBubble align="right" width={150} />
            <ChatBubble align="left" width={90} />
            <ChatBubble align="right" width={130} />
            <div style={{ flex: 1 }} />
            <div
              style={{
                height: 32,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            />
          </div>

          {/* Data grid pane */}
          <div
            style={{
              flex: 1,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <GridRow accent />
            <GridRow />
            <GridRow />
            <GridRow accent />
            <GridRow />
          </div>
        </div>
      </div>

      {/* Feature chips */}
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {features.map((label) => (
          <span
            key={label}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
