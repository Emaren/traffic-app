export const TRAFFIC_SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;

export function TrafficSocialCard() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at top right, rgba(245,158,11,0.28), transparent 34%), linear-gradient(180deg, #111317 0%, #07080b 100%)",
        color: "#f8fafc",
        padding: "56px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          borderRadius: "32px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(8,10,14,0.8)",
          padding: "42px",
          justifyContent: "space-between",
          gap: "32px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#fcd34d",
                fontSize: "22px",
                letterSpacing: "0.32em",
                textTransform: "uppercase",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "52px",
                  height: "52px",
                  borderRadius: "18px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.04)",
                  color: "#f8fafc",
                  fontSize: "30px",
                  fontWeight: 700,
                }}
              >
                T
              </div>
              <span>traffic.tokentap.ca</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "74px", fontWeight: 700, lineHeight: 1.02 }}>Traffic Observatory</div>
              <div style={{ maxWidth: "680px", fontSize: "30px", lineHeight: 1.35, color: "#cbd5e1" }}>
                Realtime visitor intelligence, durable history, premium filtering, and threat-aware traffic reporting.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            {[
              "Realtime feed",
              "Visitor history",
              "Project attribution",
              "Security watch",
            ].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  borderRadius: "999px",
                  border: "1px solid rgba(52,211,153,0.25)",
                  background: "rgba(52,211,153,0.1)",
                  color: "#bbf7d0",
                  padding: "10px 18px",
                  fontSize: "22px",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "320px",
            flexDirection: "column",
            gap: "16px",
            justifyContent: "center",
          }}
        >
          {[
            ["Humans", "Live, ranked clearly"],
            ["History", "Stored and queryable"],
            ["Security", "Suspicious traffic separated"],
          ].map(([title, detail], index) => (
            <div
              key={title}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderRadius: "24px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: index === 0 ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                padding: "22px",
              }}
            >
              <div style={{ fontSize: "18px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>
                {title}
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700 }}>{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
