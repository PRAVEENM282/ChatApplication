import React, { useState } from "react";
import { useAuth } from "../../../context/AuthProvider";
import { registerUser } from "../../../services/auth.service";

export const RegistrationForm = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (confirmPassword !== password) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const data = await registerUser({ username, email, password });
      if (data.accessToken) {
        login(data.accessToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-wa-danger/10 border border-wa-danger/30 text-wa-danger px-4 py-2.5 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <div>
        <label
          className="block text-wa-text-secondary text-xs font-medium mb-2 uppercase tracking-wider"
          htmlFor="username"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2.5 bg-wa-dark border border-wa-border rounded-lg text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread focus:ring-1 focus:ring-wa-unread/30 transition-smooth"
          placeholder="Choose a username"
          required
        />
      </div>

      <div>
        <label
          className="block text-wa-text-secondary text-xs font-medium mb-2 uppercase tracking-wider"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 bg-wa-dark border border-wa-border rounded-lg text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread focus:ring-1 focus:ring-wa-unread/30 transition-smooth"
          placeholder="Enter your email"
          required
        />
      </div>

      <div>
        <label
          className="block text-wa-text-secondary text-xs font-medium mb-2 uppercase tracking-wider"
          htmlFor="reg-password"
        >
          Password
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 bg-wa-dark border border-wa-border rounded-lg text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:border-wa-unread focus:ring-1 focus:ring-wa-unread/30 transition-smooth"
          placeholder="Create a password"
          required
        />
      </div>

      <div>
        <label
          className="block text-wa-text-secondary text-xs font-medium mb-2 uppercase tracking-wider"
          htmlFor="confirm-password"
        >
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={`w-full px-4 py-2.5 bg-wa-dark border rounded-lg text-wa-text-primary placeholder-wa-text-secondary/50 focus:outline-none focus:ring-1 transition-smooth
            ${confirmPassword && confirmPassword !== password
              ? "border-wa-danger focus:border-wa-danger focus:ring-wa-danger/30"
              : "border-wa-border focus:border-wa-unread focus:ring-wa-unread/30"
            }`}
          placeholder="Confirm your password"
          required
        />
        {confirmPassword && confirmPassword !== password && (
          <p className="text-wa-danger text-xs mt-1.5">Passwords do not match</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 bg-wa-unread hover:bg-wa-unread/90 text-white font-medium rounded-lg transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating Account...
          </span>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
};