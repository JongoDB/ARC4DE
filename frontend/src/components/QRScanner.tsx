import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X, Camera, AlertCircle } from "lucide-react";

interface QRScannerProps {
  onScan: (url: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: { rawValue: string }[]) => {
    if (result && result.length > 0) {
      const scannedValue = result[0].rawValue;
      // Validate it looks like a URL
      if (
        scannedValue.startsWith("http://") ||
        scannedValue.startsWith("https://")
      ) {
        onScan(scannedValue);
      } else {
        setError("QR code does not contain a valid URL");
      }
    }
  };

  const handleError = (err: Error) => {
    console.error("QR Scanner error:", err);
    if (err.message.includes("Permission")) {
      setError("Camera permission denied. Please allow camera access.");
    } else {
      setError("Could not access camera. Please enter URL manually.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Camera size={24} style={{ color: "white" }} />
          <span
            style={{ fontSize: "18px", fontWeight: 600, color: "white" }}
          >
            Scan QR Code
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Scanner or Error */}
      {error ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            padding: "32px",
            backgroundColor: "var(--color-bg-secondary)",
            borderRadius: "16px",
            maxWidth: "320px",
            textAlign: "center",
          }}
        >
          <AlertCircle size={48} style={{ color: "var(--color-error)" }} />
          <p style={{ color: "var(--color-text-primary)", fontSize: "16px" }}>
            {error}
          </p>
          <button
            onClick={onClose}
            style={{
              height: "44px",
              padding: "0 24px",
              borderRadius: "8px",
              backgroundColor: "var(--color-accent)",
              color: "white",
              fontSize: "15px",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            Enter URL Manually
          </button>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            aspectRatio: "1",
            borderRadius: "16px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Scanner
            onScan={handleScan}
            onError={handleError}
            constraints={{
              facingMode: "environment",
            }}
            styles={{
              container: {
                width: "100%",
                height: "100%",
              },
              video: {
                width: "100%",
                height: "100%",
                objectFit: "cover",
              },
            }}
          />
          {/* Scanning overlay */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "200px",
              height: "200px",
              border: "2px solid var(--color-accent)",
              borderRadius: "16px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
      )}

      {/* Instructions */}
      {!error && (
        <p
          style={{
            marginTop: "24px",
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          Point your camera at the QR code on your server's terminal
        </p>
      )}
    </div>
  );
}
