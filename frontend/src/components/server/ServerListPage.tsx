import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Server, Pencil, Trash2, ExternalLink, QrCode } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { QRScanner } from "@/components/QRScanner";
import type { ServerConfig } from "@/types";

export function ServerListPage() {
  const navigate = useNavigate();
  const { servers, loaded, init, addServer, updateServer, removeServer } =
    useServerStore();

  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Handle QR code scan result
  const handleQRScan = (scannedUrl: string) => {
    setUrl(scannedUrl);
    setShowScanner(false);
    // Auto-generate a name from the URL if empty
    if (!name) {
      try {
        const urlObj = new URL(scannedUrl);
        const hostname = urlObj.hostname;
        // Use first part of hostname as name
        const namePart = hostname.split(".")[0];
        setName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
      } catch {
        // Ignore URL parsing errors
      }
    }
  };

  useEffect(() => {
    init();
  }, [init]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    if (editingId) {
      await updateServer(editingId, trimmedName, trimmedUrl);
    } else {
      await addServer(trimmedName, trimmedUrl);
    }
    resetForm();
  };

  const startEdit = (server: ServerConfig) => {
    setEditingId(server.id);
    setName(server.name);
    setUrl(server.url);
    setShowForm(true);
    setConfirmDeleteId(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setUrl("");
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await removeServer(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleCardClick = (server: ServerConfig) => {
    if (confirmDeleteId || editingId) return;
    navigate(`/login?server=${server.id}`);
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <span style={{ color: 'var(--color-text-secondary)' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: '4px'
          }}>
            Servers
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            {servers.length} server{servers.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '44px',
              padding: '0 20px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
          >
            <Plus size={18} />
            Add Server
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '20px'
          }}>
            {editingId ? "Edit Server" : "Add New Server"}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
              }}>
                Server Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Home Lab"
                autoFocus
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: '15px',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
              }}>
                Server URL
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. https://myserver.example.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  style={{
                    flex: 1,
                    height: '48px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid transparent',
                    color: 'var(--color-text-primary)',
                    fontSize: '15px',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  title="Scan QR Code"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                    e.currentTarget.style.color = 'var(--color-accent)';
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  <QrCode size={22} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
              <button
                onClick={handleSubmit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '44px',
                  padding: '0 20px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
              >
                {editingId ? "Save Changes" : "Add Server"}
              </button>
              <button
                onClick={resetForm}
                style={{
                  height: '44px',
                  padding: '0 20px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  fontSize: '15px',
                  fontWeight: 500,
                  border: '1px solid var(--color-border-strong)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {servers.length === 0 && !showForm && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 0',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}>
            <Server size={28} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <p style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '4px'
          }}>
            No servers yet
          </p>
          <p style={{
            fontSize: '14px',
            color: 'var(--color-text-muted)',
            marginBottom: '20px'
          }}>
            Add your first server to get started
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '44px',
              padding: '0 20px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent)'}
          >
            <Plus size={18} />
            Add Server
          </button>
        </div>
      )}

      {/* Server list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {servers.map((server) => (
          <div
            key={server.id}
            onClick={() => handleCardClick(server)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-bg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Server size={22} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)'
                  }}>
                    {server.name}
                  </span>
                  <ExternalLink
                    size={14}
                    style={{
                      color: 'var(--color-text-muted)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                    }}
                    className="group-hover-icon"
                  />
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {server.url}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(server);
                }}
                title="Edit server"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(server.id);
                }}
                title={confirmDeleteId === server.id ? "Click to confirm" : "Delete server"}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: confirmDeleteId === server.id ? 'var(--color-error)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: confirmDeleteId === server.id ? 'white' : 'var(--color-text-muted)',
                }}
                onMouseEnter={(e) => {
                  if (confirmDeleteId !== server.id) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                    e.currentTarget.style.color = 'var(--color-error)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (confirmDeleteId !== server.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
