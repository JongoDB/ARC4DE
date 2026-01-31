import { useEffect, useState, useCallback, useMemo } from "react";
import { Link2, Copy, Check, QrCode, ExternalLink, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTunnelStore } from "@/stores/tunnelStore";
import { useServerStore } from "@/stores/serverStore";

const POLL_INTERVAL_MS = 30000; // 30 seconds

// Check if we're accessing via a Cloudflare tunnel
function isAccessingViaTunnel(): boolean {
  return window.location.hostname.endsWith(".trycloudflare.com");
}

export function TunnelBar() {
  const { sessionUrl, previews, fetchTunnelInfo, fetchTunnelInfoFromOrigin } =
    useTunnelStore();
  const { servers, activeConnection } = useServerStore();
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Determine if we're accessing via tunnel
  const viaTunnel = useMemo(() => isAccessingViaTunnel(), []);

  // Get the server URL for the active connection
  const serverUrl = activeConnection
    ? servers.find((s) => s.id === activeConnection.serverId)?.url
    : null;

  const fetchInfo = useCallback(() => {
    // If accessing via tunnel, fetch from current origin (no auth needed)
    if (viaTunnel) {
      fetchTunnelInfoFromOrigin();
    } else if (serverUrl && activeConnection?.accessToken) {
      fetchTunnelInfo(serverUrl, activeConnection.accessToken);
    }
  }, [
    viaTunnel,
    serverUrl,
    activeConnection?.accessToken,
    fetchTunnelInfo,
    fetchTunnelInfoFromOrigin,
  ]);

  // Fetch tunnel info on mount and periodically
  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!sessionUrl) return;
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Don't render if there's no session URL and no previews
  if (!sessionUrl && previews.length === 0) {
    return null;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px 16px",
          backgroundColor: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Session URL row */}
        {sessionUrl && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
                minWidth: 0,
              }}
            >
              <Link2
                size={16}
                style={{
                  color: "var(--color-accent)",
                  flexShrink: 0,
                }}
              />
              <span
                className="font-mono"
                style={{
                  fontSize: "13px",
                  color: "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sessionUrl}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <button
                onClick={handleCopy}
                title={copied ? "Copied!" : "Copy URL"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "32px",
                  padding: "0 12px",
                  borderRadius: "6px",
                  backgroundColor: copied
                    ? "var(--color-success)"
                    : "var(--color-bg-tertiary)",
                  border: "1px solid var(--color-border)",
                  color: copied ? "white" : "var(--color-text-secondary)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-bg-elevated)";
                    e.currentTarget.style.color = "var(--color-text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-bg-tertiary)";
                    e.currentTarget.style.color = "var(--color-text-secondary)";
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span style={{ display: "none" }} className="copy-label">
                  {copied ? "Copied!" : "Copy"}
                </span>
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                title="Show QR Code"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  backgroundColor: "var(--color-bg-tertiary)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-elevated)";
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-tertiary)";
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                }}
              >
                <QrCode size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Preview tunnels row */}
        {previews.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                color: "var(--color-text-muted)",
              }}
            >
              Preview:
            </span>
            {previews.map((preview) => (
              <a
                key={preview.port}
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open preview for port ${preview.port}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "28px",
                  padding: "0 10px",
                  borderRadius: "14px",
                  backgroundColor: "var(--color-accent-muted)",
                  border: "none",
                  color: "var(--color-accent)",
                  fontSize: "12px",
                  fontWeight: 500,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-accent)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-accent-muted)";
                  e.currentTarget.style.color = "var(--color-accent)";
                }}
              >
                <span>:{preview.port}</span>
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && sessionUrl && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowQrModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "90vw",
              width: "360px",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                Session URL
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-elevated)";
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--color-text-muted)";
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* QR Code */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <QRCodeSVG
                  value={sessionUrl}
                  size={180}
                  level="M"
                  marginSize={0}
                />
              </div>

              <div
                className="font-mono"
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "var(--color-bg-tertiary)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  wordBreak: "break-all",
                  textAlign: "center",
                }}
              >
                {sessionUrl}
              </div>

              <button
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  height: "40px",
                  padding: "0 20px",
                  borderRadius: "8px",
                  backgroundColor: copied
                    ? "var(--color-success)"
                    : "var(--color-accent)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-accent-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-accent)";
                  }
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
