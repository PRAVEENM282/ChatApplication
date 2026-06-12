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

const BackArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const DEFAULT_FALLBACK_AVATAR =
  "https://api.dicebear.com/8.x/adventurer/svg?seed=User";

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
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
  const [activeTab, setActiveTab] = useState<"account" | "security" | "chat">(
    "account"
  );
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [securityStatus, setSecurityStatus] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [keyVaultInput, setKeyVaultInput] = useState("");

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
      setUsernameSuccess("Username updated successfully!");
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

      // Re-encrypt and persist the private key vault with the NEW password so multi-device login keeps working.
      const privateKey = localStorage.getItem("privateKey");
      if (privateKey) {
        const keyVault = await encryptPrivateKeyToVault(privateKey, newPassword);
        await updateMyKeyVault(keyVault);
      }

      setPasswordSuccess("Password updated successfully!");
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
      setAvatarSuccess("Avatar updated successfully!");
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
          ? "Encryption self-test passed."
          : "Encryption self-test failed."
      );
    } catch {
      setSecurityStatus("Encryption self-test failed.");
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
    } catch (err: any) {
      setSettingsStatus("Failed to save settings: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="p-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <Link
          to="/"
          className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors font-semibold"
        >
          <BackArrowIcon />
          <span>Back to Chats</span>
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-3xl p-8 space-y-8 bg-white shadow-xl rounded-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage your account settings
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["account", "security", "chat"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`p-2 rounded-lg font-semibold capitalize ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "account" && (
          <>
          <form
            onSubmit={handleAvatarSubmit}
            className="flex flex-col items-center space-y-4"
          >
            <img
              src={avatarPreview}
              alt="Profile Avatar"
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_FALLBACK_AVATAR; 
              }}
            />

            <input
              type="file"
              id="avatarInput"
              accept="image/png, image/jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="avatarInput"
              className="cursor-pointer bg-gray-100 text-gray-800 font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Choose Image
            </label>
            {avatarFile && (
              <div className="w-full flex flex-col items-center space-y-2">
                <p className="text-xs text-gray-600">{avatarFile.name}</p>
                <button
                  type="submit"
                  disabled={isAvatarLoading}
                  className="w-full max-w-xs py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:bg-green-300"
                >
                  {isAvatarLoading ? "Uploading..." : "Upload New Avatar"}
                </button>
              </div>
            )}
            {avatarError && (
              <p className="text-sm text-red-600">{avatarError}</p>
            )}
            {avatarSuccess && (
              <p className="text-sm text-green-600">{avatarSuccess}</p>
            )}
          </form>

          <hr />

          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="text-xl font-semibold text-gray-700 block mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={isUsernameLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:bg-blue-300"
            >
              {isUsernameLoading ? "Saving..." : "Save Username"}
            </button>
            {usernameSuccess && (
              <p className="text-sm text-center text-green-600 mt-2">
                {usernameSuccess}
              </p>
            )}
            {usernameError && (
              <p className="text-sm text-center text-red-600 mt-2">
                {usernameError}
              </p>
            )}
          </form>

          <hr />

          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Change Password
            </h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="currentPassword"
                  className="text-sm font-semibold text-gray-700 block mb-2"
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="text-sm font-semibold text-gray-700 block mb-2"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-semibold text-gray-700 block mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    Passwords do not match.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isPasswordLoading}
                className="w-full py-3 bg-gray-700 hover:bg-gray-800 text-white font-bold rounded-lg transition-colors disabled:bg-gray-400"
              >
                {isPasswordLoading ? "Changing..." : "Change Password"}
              </button>
            </form>
            {passwordSuccess && (
              <p className="text-sm text-center text-green-600 mt-4">
                {passwordSuccess}
              </p>
            )}
            {passwordError && (
              <p className="text-sm text-center text-red-600 mt-4">
                {passwordError}
              </p>
            )}
          </div>
          </>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <h2 className="text-xl font-bold text-gray-800 mb-3">
                  Encryption Keys
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportPrivateKey}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg"
                  >
                    Export Private Key
                  </button>
                  <button
                    type="button"
                    onClick={handleCryptoSelfTest}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    Run Encryption Test
                  </button>
                </div>
                <textarea
                  value={keyVaultInput}
                  onChange={(e) => setKeyVaultInput(e.target.value)}
                  placeholder="Paste private key here to restore on this device"
                  className="mt-4 w-full min-h-24 p-3 border border-gray-300 rounded-lg text-xs"
                />
                <input
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Password to re-encrypt key vault"
                  className="mt-3 w-full p-2 border border-gray-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRestorePrivateKey}
                  className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg"
                >
                  Restore Key
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-gray-800">
                    Active Sessions
                  </h2>
                  <button
                    type="button"
                    onClick={handleRevokeOthers}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm"
                  >
                    Revoke Others
                  </button>
                </div>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex items-center justify-between gap-3 rounded-md bg-gray-50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {session.deviceInfo}
                        </p>
                        <p className="text-xs text-gray-500">
                          {session.ipAddress} -{" "}
                          {new Date(session.lastActive).toLocaleString()}
                          {session.isCurrent ? " - Current" : ""}
                        </p>
                      </div>
                      {!session.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(session._id)}
                          className="px-3 py-1 bg-gray-200 rounded-md text-sm"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {securityStatus && (
                <p className="text-sm text-center text-blue-700">
                  {securityStatus}
                </p>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="space-y-4">
              {[
                ["notificationsEnabled", "Notifications"],
                ["readReceiptsEnabled", "Read receipts"],
                ["encryptedFilePreviewsEnabled", "Encrypted file previews"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <span className="font-semibold text-gray-800">{label}</span>
                  <input
                    type="checkbox"
                    checked={
                      user?.settings?.[
                        key as keyof NonNullable<User["settings"]>
                      ] !== false
                    }
                    onChange={(e) =>
                      handleSettingToggle(
                        key as
                          | "notificationsEnabled"
                          | "readReceiptsEnabled"
                          | "encryptedFilePreviewsEnabled",
                        e.target.checked
                      )
                    }
                    className="h-5 w-5"
                  />
                </label>
              ))}
              {settingsStatus && (
                <p className="text-sm text-center text-green-700">
                  {settingsStatus}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
