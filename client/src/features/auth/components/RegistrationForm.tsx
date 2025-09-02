import React, { useState } from "react";
import { useAuth } from "../../../context/AuthProvider";
import { registerUser } from "../../../services/auth.service";
import { initializeSodium } from "../../../services/crypto.service";

// New component for the recovery key display step
const RecoveryKeyStep = ({ privateKey, onAcknowledged }: { privateKey: string, onAcknowledged: () => void }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(privateKey);
    setIsCopied(true);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white shadow-2xl rounded-2xl p-8 space-y-4 border">
      <h2 className="text-2xl font-extrabold text-center text-red-600">IMPORTANT: Save Your Key!</h2>
      <p className="text-center text-gray-700">
        This is your **Recovery Key**. It is the ONLY way to access your messages on a new device. We do not store it and cannot recover it for you.
      </p>
      <div className="bg-gray-100 p-4 rounded-lg break-all font-mono text-sm border">
        {privateKey}
      </div>
      <button
        onClick={handleCopy}
        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg"
      >
        {isCopied ? "Copied!" : "Copy to Clipboard"}
      </button>
      <div className="flex items-center gap-3 mt-4">
        <input 
          type="checkbox" 
          id="acknowledge"
          checked={hasAcknowledged}
          onChange={(e) => setHasAcknowledged(e.target.checked)}
          className="h-5 w-5 rounded"
        />
        <label htmlFor="acknowledge" className="text-sm text-gray-800">
          I have saved my Recovery Key in a safe place.
        </label>
      </div>
      <button
        onClick={onAcknowledged}
        disabled={!hasAcknowledged}
        className="w-full py-3 mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg"
      >
        Continue to App
      </button>
    </div>
  );
};


export const RegistrationForm = () => {
  // --- New state for multi-step registration ---
  const [step, setStep] = useState(1); // 1 for form, 2 for recovery key
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState("");
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... (form validation logic remains the same) ...

    try {
      await initializeSodium();
      const data = await registerUser({ username, email, password });
      
      if (data.accessToken && data.privateKeyBase64) {
        // Don't log in yet. Show the recovery key first.
        setGeneratedPrivateKey(data.privateKeyBase64);
        setStep(2); // Move to the next step
        
        // Temporarily store auth data to log in after acknowledgement
        localStorage.setItem("temp_token", data.accessToken);
        localStorage.setItem("temp_username", data.username);
        localStorage.setItem("temp_userId", data.userId);
      }
    } catch (err: any) {
      // ... (error handling remains the same) ...
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyAcknowledgement = () => {
    const token = localStorage.getItem("temp_token");
    const uname = localStorage.getItem("temp_username");
    const uid = localStorage.getItem("temp_userId");
    
    if (token && uname && uid) {
      login(token);
      localStorage.setItem("username", uname);
      localStorage.setItem("userId", uid);

      // Clean up temp items
      localStorage.removeItem("temp_token");
      localStorage.removeItem("temp_username");
      localStorage.removeItem("temp_userId");
    } else {
      setError("Something went wrong. Please try registering again.");
    }
  };

  if (step === 2) {
    return <RecoveryKeyStep privateKey={generatedPrivateKey} onAcknowledged={handleKeyAcknowledgement} />;
  }


  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-2xl rounded-2xl px-10 pt-8 pb-10 space-y-6 border border-gray-100"
      >
        <h2 className="text-3xl font-extrabold text-center text-gray-900">
          Create an Account
        </h2>

        {error && (
          <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-center text-sm capitalize">
            {error}
          </p>
        )}

        {/* Username */}
        <div>
          <label
            className="block text-gray-700 text-sm font-semibold mb-1"
            htmlFor="username"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label
            className="block text-gray-700 text-sm font-semibold mb-1"
            htmlFor="email"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        {/* Password */}
        <div>
          <label
            className="block text-gray-700 text-sm font-semibold mb-1"
            htmlFor="password"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label
            className="block text-gray-700 text-sm font-semibold mb-1"
            htmlFor="ConfirmPassword"
          >
            Confirm Password
          </label>
          <input
            id="ConfirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none
          ${
            confirmPassword && confirmPassword !== password
              ? "border-red-500 bg-red-50 text-red-700 focus:ring-red-500"
              : "border-gray-300 focus:ring-blue-500"
          }
        `}
            required
          />
          {confirmPassword && confirmPassword !== password && (
            <p className="text-red-500 text-xs mt-1">Passwords do not match.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg shadow-lg transform transition-transform duration-150 hover:scale-[1.02]"
        >
          {isLoading ? "Registering..." : "Register"}
        </button>
      </form>
    </div>
  );
};
