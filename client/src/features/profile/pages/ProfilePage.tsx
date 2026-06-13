import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthProvider";
import {
  updateUserPassword,
  updateUserProfile,
  updateUserAvatar,
  updateMyKeyVault,
  updateMySettings,
  getMySessions,
  revokeSession,
  revokeOtherSessions,
  type SessionInfo,
} from "../../../services/user.service";
import { encryptPrivateKeyToVault } from "../../../services/keyVault.service";
import { Link } from "react-router-dom";
import { User } from "../../../types";
import { decryptMessage, encryptMessage } from "../../../services/crypto.service";

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`wa-toggle ${enabled ? 'active' : ''}`}
    role="switch"
    aria-checked={enabled}
  />
);

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  rightElement?: React.ReactNode;
  onClick?: () => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, label, description, rightElement, onClick }) => (
  <div
    className={`flex items-center gap-4 px-5 py-3.5 ${onClick ? 'cursor-pointer hover:bg-wa-sidebar-hover' : ''} transition-smooth`}
    onClick={onClick}
  >
    <div className="text-wa-text-secondary flex-shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-wa-text-primary">{label}</p>
      {description && <p className="text-xs text-wa-text-secondary mt-0.5">{description}</p>}
    </div>
    {rightElement && <div className="flex-shrink-0">{rightElement}</div>}
  </div>
);

export const ProfilePage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const initialAvatarUrl = user?.avatarUrl || DEFAULT_FALLBACK_AVATAR;

  const [newName, setNewName] = useState(user?.username || "");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isUsernameLoading, setIsUsernameLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(initialAvatarUrl);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"account" | "privacy" | "chat" | "security" | "about">("account");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [securityStatus, setSecurityStatus] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [keyVaultInput, setKeyVaultInput] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    if (user?.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    } else {
      setAvatarPreview(DEFAULT_FALLBACK_AVATAR);
    }
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (activeTab === "security") {
      getMySessions()
        .then(setSessions)
        .catch(() => setSecurityStatus("Could not load active sessions."));
    }
  }, [activeTab]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameSuccess("");
    setUsernameError("");
    if (!newName.trim() || user?.username === newName) return;

    setIsUsernameLoading(true);
    try {
      const updatedUser = await updateUserProfile(newName);
      updateUser(updatedUser as User);
      setUsernameSuccess("Username updated!");
    } catch (err: any) {
      setUsernameError(err.response?.data?.message || "An error occurred.");
    } finally {
      setIsUsernameLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      return setPasswordError("New passwords do not match.");
    }
    if (newPassword.length < 8) {
      return setPasswordError("Password must be at least 8 characters long.");
    }

    setIsPasswordLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);

      // Re-encrypt and persist the private key vault with the NEW password
      const privateKey = localStorage.getItem("privateKey");
      if (privateKey) {
        const keyVault = await encryptPrivateKeyToVault(privateKey, newPassword);
        await updateMyKeyVault(keyVault);
      }

      setPasswordSuccess("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(
        err.response?.data?.message || "An unexpected error occurred."
      );
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return setAvatarError("File is too large (max 2MB).");
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setAvatarError("");
      setAvatarSuccess("");
    }
  };

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarFile) return setAvatarError("Please select a new image.");

    setAvatarError("");
    setAvatarSuccess("");
    setIsAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const updatedUser = await updateUserAvatar(formData);
      updateUser(updatedUser as User);
      setAvatarSuccess("Avatar updated!");
      setAvatarFile(null);
    } catch (err: any) {
      setAvatarError(err.response?.data?.message || "Upload failed.");
    } finally {
      setIsAvatarLoading(false);
    }
  };

  const handleExportPrivateKey = () => {
    const privateKey = localStorage.getItem("privateKey");
    if (!privateKey) {
      setSecurityStatus("Private key is not available on this device.");
      return;
    }
    setKeyVaultInput(privateKey);
    setSecurityStatus("Private key loaded below. Keep it secret.");
  };

  const handleRestorePrivateKey = async () => {
    if (!keyVaultInput.trim()) {
      setSecurityStatus("Paste a private key first.");
      return;
    }
    const inputKey = keyVaultInput.trim();
    try {
      const decoded = atob(inputKey);
      if (decoded.length !== 32) {
        throw new Error("Invalid length");
      }
    } catch {
      setSecurityStatus("Invalid private key format.");
      return;
    }

    localStorage.setItem("privateKey", inputKey);
    if (restorePassword) {
      const keyVault = await encryptPrivateKeyToVault(
        inputKey,
        restorePassword
      );
      await updateMyKeyVault(keyVault);
    }
    setSecurityStatus("Private key restored on this device.");
  };

  const handleCryptoSelfTest = async () => {
    const privateKey = localStorage.getItem("privateKey");
    if (!privateKey || !user?.publicKey) {
      setSecurityStatus("Missing local private key or public key.");
      return;
    }
    try {
      const encrypted = await encryptMessage(
        "secure-chat-self-test",
        user.publicKey,
        privateKey
      );
      const decrypted = await decryptMessage(
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        user.publicKey,
        privateKey
      );
      setSecurityStatus(
        decrypted === "secure-chat-self-test"
          ? "✅ Encryption self-test passed."
          : "❌ Encryption self-test failed."
      );
    } catch {
      setSecurityStatus("❌ Encryption self-test failed.");
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      setSessions(await getMySessions());
    } catch (err: any) {
      setSecurityStatus("Failed to revoke session: " + (err.message || "Unknown error"));
    }
  };

  const handleRevokeOthers = async () => {
    try {
      await revokeOtherSessions();
      setSessions(await getMySessions());
    } catch (err: any) {
      setSecurityStatus("Failed to revoke other sessions: " + (err.message || "Unknown error"));
    }
  };

  const handleSettingToggle = async (
    key:
      | "notificationsEnabled"
      | "readReceiptsEnabled"
      | "encryptedFilePreviewsEnabled",
    value: boolean
  ) => {
    try {
      const updatedUser = await updateMySettings({ [key]: value });
      updateUser(updatedUser as User);
      setSettingsStatus("Settings saved.");
      setTimeout(() => setSettingsStatus(""), 2000);
    } catch (err: any) {
      setSettingsStatus("Failed to save settings: " + (err.message || "Unknown error"));
    }
  };

  const tabs = [
    { id: "account" as const, label: "Account", icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )},
    { id: "privacy" as const, label: "Privacy", icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    )},
    { id: "chat" as const, label: "Chats", icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    )},
    { id: "security" as const, label: "Security", icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )},
    { id: "about" as const, label: "About", icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    )},
  ];

  return (
    <div className="flex h-screen bg-wa-dark">
      {/* Sidebar navigation */}
      <div className="w-[350px] bg-wa-sidebar border-r border-wa-border/50 flex flex-col">
        <div className="px-5 py-4 bg-wa-header flex items-center gap-3">
          <Link
            to="/"
            className="text-wa-icon hover:text-wa-text-primary transition-smooth"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-lg font-normal text-wa-text-primary">Settings</h1>
        </div>

        {/* User info card */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-wa-border/30">
          <img
            src={avatarPreview}
            alt="Profile"
            className="w-[70px] h-[70px] rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_FALLBACK_AVATAR;
            }}
          />
          <div className="min-w-0">
            <p className="text-lg text-wa-text-primary font-normal truncate">{user?.username}</p>
            <p className="text-sm text-wa-text-secondary truncate">{user?.email}</p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 transition-smooth text-left
                ${activeTab === tab.id
                  ? 'bg-wa-sidebar-hover text-wa-text-primary'
                  : 'text-wa-text-secondary hover:bg-wa-sidebar-hover/50 hover:text-wa-text-primary'
                }`}
            >
              {tab.icon}
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}

          <div className="border-t border-wa-border/30 mt-2 pt-2">
            <button
              onClick={logout}
              className="w-full flex items-center gap-4 px-5 py-3.5 text-wa-danger hover:bg-wa-sidebar-hover/50 transition-smooth text-left"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm">Log out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-wa-panel">
        <div className="max-w-2xl mx-auto py-8 px-6">

          {/* ACCOUNT TAB */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <h2 className="text-xl text-wa-text-primary font-normal mb-6">Account</h2>

              {/* Avatar */}
              <div className="bg-wa-header rounded-xl overflow-hidden">
                <form onSubmit={handleAvatarSubmit} className="p-5">
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      <img
                        src={avatarPreview}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_AVATAR; }}
                      />
                      <label
                        htmlFor="avatarInput"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-full cursor-pointer transition-smooth"
                      >
                        <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-smooth" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </label>
                      <input
                        type="file"
                        id="avatarInput"
                        accept="image/png, image/jpeg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-wa-text-primary">Profile photo</p>
                      <p className="text-xs text-wa-text-secondary mt-0.5">Max 2MB, JPG or PNG</p>
                      {avatarFile && (
                        <button
                          type="submit"
                          disabled={isAvatarLoading}
                          className="mt-2 px-4 py-1.5 bg-wa-unread text-white text-xs rounded-full hover:bg-wa-unread/90 disabled:opacity-50 transition-smooth"
                        >
                          {isAvatarLoading ? "Uploading..." : "Upload"}
                        </button>
                      )}
                    </div>
                  </div>
                  {avatarError && <p className="text-xs text-wa-danger mt-2">{avatarError}</p>}
                  {avatarSuccess && <p className="text-xs text-wa-unread mt-2">{avatarSuccess}</p>}
                </form>
              </div>

              {/* Username */}
              <div className="bg-wa-header rounded-xl overflow-hidden">
                <form onSubmit={handleUsernameSubmit} className="p-5">
                  <label className="text-xs text-wa-unread font-medium uppercase tracking-wider block mb-2">
                    Your name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1 bg-transparent text-wa-text-primary text-sm border-b border-wa-border pb-1.5 focus:outline-none focus:border-wa-unread transition-smooth"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isUsernameLoading || newName === user?.username}
                      className="px-4 py-1.5 bg-wa-unread text-white text-xs rounded-full hover:bg-wa-unread/90 disabled:opacity-30 transition-smooth"
                    >
                      {isUsernameLoading ? "..." : "Save"}
                    </button>
                  </div>
                  {usernameSuccess && <p className="text-xs text-wa-unread mt-2">{usernameSuccess}</p>}
                  {usernameError && <p className="text-xs text-wa-danger mt-2">{usernameError}</p>}
                </form>
              </div>

              {/* Change Password */}
              <div className="bg-wa-header rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="w-full flex items-center justify-between p-5 hover:bg-wa-sidebar-hover transition-smooth"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-wa-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    <span className="text-sm text-wa-text-primary">Change password</span>
                  </div>
                  <svg className={`w-4 h-4 text-wa-text-secondary transition-transform ${showPasswordSection ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showPasswordSection && (
                  <form onSubmit={handlePasswordSubmit} className="px-5 pb-5 space-y-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 bg-wa-dark border border-wa-border rounded-lg text-sm text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread transition-smooth"
                      required
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 bg-wa-dark border border-wa-border rounded-lg text-sm text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread transition-smooth"
                      required
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`w-full px-3 py-2 bg-wa-dark border rounded-lg text-sm text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none transition-smooth ${
                        confirmPassword && newPassword !== confirmPassword
                          ? 'border-wa-danger focus:border-wa-danger'
                          : 'border-wa-border focus:border-wa-unread'
                      }`}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isPasswordLoading}
                      className="w-full py-2 bg-wa-unread text-white text-sm rounded-lg hover:bg-wa-unread/90 disabled:opacity-50 transition-smooth"
                    >
                      {isPasswordLoading ? "Changing..." : "Change Password"}
                    </button>
                    {passwordSuccess && <p className="text-xs text-wa-unread text-center">{passwordSuccess}</p>}
                    {passwordError && <p className="text-xs text-wa-danger text-center">{passwordError}</p>}
                  </form>
                )}
              </div>
            </div>
          )}

          {/* PRIVACY TAB */}
          {activeTab === "privacy" && (
            <div className="space-y-6">
              <h2 className="text-xl text-wa-text-primary font-normal mb-6">Privacy</h2>

              <div className="bg-wa-header rounded-xl overflow-hidden">
                <SettingRow
                  icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  label="Read receipts"
                  description="If turned off, you won't send or receive read receipts"
                  rightElement={
                    <ToggleSwitch
                      enabled={user?.settings?.readReceiptsEnabled !== false}
                      onChange={(v) => handleSettingToggle("readReceiptsEnabled", v)}
                    />
                  }
                />
                <div className="border-t border-wa-border/30" />
                <SettingRow
                  icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3 3 3-3"/></svg>}
                  label="Encrypted file previews"
                  description="Show previews of encrypted files inline"
                  rightElement={
                    <ToggleSwitch
                      enabled={user?.settings?.encryptedFilePreviewsEnabled !== false}
                      onChange={(v) => handleSettingToggle("encryptedFilePreviewsEnabled", v)}
                    />
                  }
                />
              </div>

              {settingsStatus && (
                <p className="text-xs text-wa-unread text-center">{settingsStatus}</p>
              )}
            </div>
          )}

          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <div className="space-y-6">
              <h2 className="text-xl text-wa-text-primary font-normal mb-6">Chats</h2>

              <div className="bg-wa-header rounded-xl overflow-hidden">
                <SettingRow
                  icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
                  label="Notifications"
                  description="Show message notifications"
                  rightElement={
                    <ToggleSwitch
                      enabled={user?.settings?.notificationsEnabled !== false}
                      onChange={(v) => handleSettingToggle("notificationsEnabled", v)}
                    />
                  }
                />
              </div>

              <div className="bg-wa-header rounded-xl overflow-hidden">
                <div className="px-5 py-3.5">
                  <p className="text-xs text-wa-unread font-medium uppercase tracking-wider mb-3">Storage info</p>
                  <div className="flex items-center gap-3 text-wa-text-secondary">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      <path d="M22 10H2" />
                    </svg>
                    <div>
                      <p className="text-sm text-wa-text-primary">Local storage</p>
                      <p className="text-xs text-wa-text-secondary mt-0.5">
                        Private key: {localStorage.getItem("privateKey") ? "✅ Stored" : "❌ Not found"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl text-wa-text-primary font-normal mb-6">Security</h2>

              {/* Encryption keys */}
              <div className="bg-wa-header rounded-xl overflow-hidden">
                <div className="px-5 py-3.5">
                  <p className="text-xs text-wa-unread font-medium uppercase tracking-wider mb-3">Encryption Keys</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportPrivateKey}
                      className="px-3 py-1.5 bg-wa-dark text-wa-text-primary text-xs rounded-lg hover:bg-wa-sidebar-hover transition-smooth"
                    >
                      Export Private Key
                    </button>
                    <button
                      type="button"
                      onClick={handleCryptoSelfTest}
                      className="px-3 py-1.5 bg-wa-unread text-white text-xs rounded-lg hover:bg-wa-unread/90 transition-smooth"
                    >
                      Run Encryption Test
                    </button>
                  </div>
                  <textarea
                    value={keyVaultInput}
                    onChange={(e) => setKeyVaultInput(e.target.value)}
                    placeholder="Paste private key here to restore on this device"
                    className="mt-3 w-full min-h-[80px] p-3 bg-wa-dark border border-wa-border rounded-lg text-xs text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread resize-none"
                  />
                  <input
                    type="password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="Password to re-encrypt key vault"
                    className="mt-2 w-full p-2 bg-wa-dark border border-wa-border rounded-lg text-sm text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread"
                  />
                  <button
                    type="button"
                    onClick={handleRestorePrivateKey}
                    className="mt-2 w-full py-2 bg-wa-unread text-white text-sm rounded-lg hover:bg-wa-unread/90 transition-smooth"
                  >
                    Restore Key
                  </button>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="bg-wa-header rounded-xl overflow-hidden">
                <div className="px-5 py-3.5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-wa-unread font-medium uppercase tracking-wider">Active Sessions</p>
                    <button
                      type="button"
                      onClick={handleRevokeOthers}
                      className="px-3 py-1 bg-wa-danger/10 text-wa-danger text-xs rounded-full hover:bg-wa-danger/20 transition-smooth"
                    >
                      Revoke Others
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session._id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-wa-dark p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-wa-text-primary font-medium truncate">
                            {session.deviceInfo}
                          </p>
                          <p className="text-xs text-wa-text-secondary">
                            {session.ipAddress} •{" "}
                            {new Date(session.lastActive).toLocaleString()}
                            {session.isCurrent && (
                              <span className="text-wa-unread ml-1">• Current</span>
                            )}
                          </p>
                        </div>
                        {!session.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(session._id)}
                            className="px-3 py-1 bg-wa-sidebar-hover text-wa-text-secondary rounded-md text-xs hover:text-wa-text-primary transition-smooth"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-xs text-wa-text-secondary text-center py-4">Loading sessions...</p>
                    )}
                  </div>
                </div>
              </div>

              {securityStatus && (
                <p className="text-xs text-wa-unread text-center">{securityStatus}</p>
              )}
            </div>
          )}

          {/* ABOUT TAB */}
          {activeTab === "about" && (
            <div className="space-y-6">
              <h2 className="text-xl text-wa-text-primary font-normal mb-6">About</h2>

              <div className="bg-wa-header rounded-xl overflow-hidden p-5 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-wa-unread/10 mb-4">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-wa-unread" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.78.46 3.45 1.27 4.9L2 22l5.1-1.27C8.55 21.54 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.46 14.12c-.23.64-1.34 1.23-1.85 1.3-.47.07-.84.21-2.82-.59-2.39-0.96-3.9-3.4-4.02-3.56-.12-.16-.95-1.27-.95-2.42s.6-1.72.81-1.95c.22-.23.47-.29.63-.29.16 0 .32 0 .46.01.15.01.35-.06.55.42.2.48.68 1.67.74 1.79.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.24-.1.47.14.23.62 1.03 1.34 1.67.92.82 1.7 1.07 1.93 1.19.24.12.38.1.52-.06.14-.16.59-.69.75-.93.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.56-.17 1.1z"/>
                  </svg>
                </div>
                <h3 className="text-lg text-wa-text-primary font-normal mb-1">Secure Chat</h3>
                <p className="text-sm text-wa-text-secondary mb-4">Version 1.0.0</p>

                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-3 p-3 bg-wa-dark rounded-lg">
                    <svg className="w-5 h-5 text-wa-unread flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <div>
                      <p className="text-sm text-wa-text-primary">End-to-end encryption</p>
                      <p className="text-xs text-wa-text-secondary">Your messages are secured with NaCl/libsodium</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-wa-dark rounded-lg">
                    <svg className="w-5 h-5 text-wa-unread flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <div>
                      <p className="text-sm text-wa-text-primary">File sharing up to 50MB</p>
                      <p className="text-xs text-wa-text-secondary">Share documents, images, and files securely</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-wa-dark rounded-lg">
                    <svg className="w-5 h-5 text-wa-unread flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <div>
                      <p className="text-sm text-wa-text-primary">Group chats</p>
                      <p className="text-xs text-wa-text-secondary">Create groups with multiple participants</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
