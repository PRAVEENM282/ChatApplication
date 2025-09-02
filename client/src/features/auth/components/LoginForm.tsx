import React, { useState } from "react";
import { useAuth } from "../../../context/AuthProvider";
import { loginUser } from "../../../services/auth.service";
import { getPrivateKey } from "../../../utils/KeyStorage";
import RecoveryKeyForm from "./RecoveryKeyForm"; // Import the new component

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- New state to handle recovery key flow ---
  const [needsRecoveryKey, setNeedsRecoveryKey] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState("");

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await loginUser({ email, password });
      if (data.accessToken) {
        // Check if the private key exists for this user in this browser
        const privateKey = await getPrivateKey(data.username);
        if (privateKey) {
          // Key exists, log in directly
          login(data.accessToken);
          localStorage.setItem("username", data.username);
          localStorage.setItem("userId", data.userId);
        } else {
          // Key MISSING. Prompt user for it.
          setLoggedInUsername(data.username);
          setNeedsRecoveryKey(true);
           // We still need to set these for the recovery form to work with the socket
          localStorage.setItem("accessToken", data.accessToken); 
          localStorage.setItem("userId", data.userId);
          localStorage.setItem("username", data.username);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRecoverySuccess = () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        login(token); // Finalize login state
      }
  };

  // If we need the recovery key, render that form instead
  if (needsRecoveryKey) {
    return <RecoveryKeyForm username={loggedInUsername} onSuccess={handleRecoverySuccess} />;
  }

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-lg px-8 pt-6 pb-8 mb-4"
      >
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Login
        </h2>
        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center">
            {error}
          </p>
        )}

        <div className="mb-4">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="login-email"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>

        <div className="mb-6">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="login-password"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>

        <div className="flex items-center justify-center">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:bg-green-300"
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
