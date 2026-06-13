import React, { useState } from "react";
import { RegistrationForm } from "../components/RegistrationForm";
import LoginForm from "../components/LoginForm";

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-wa-dark flex flex-col">
      {/* WhatsApp-style top bar */}
      <div className="h-56 bg-wa-teal" />

      <div className="flex-1 flex items-start justify-center -mt-40 px-4 pb-8">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm mb-4">
              <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.78.46 3.45 1.27 4.9L2 22l5.1-1.27C8.55 21.54 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.46 14.12c-.23.64-1.34 1.23-1.85 1.3-.47.07-.84.21-2.82-.59-2.39-0.96-3.9-3.4-4.02-3.56-.12-.16-.95-1.27-.95-2.42s.6-1.72.81-1.95c.22-.23.47-.29.63-.29.16 0 .32 0 .46.01.15.01.35-.06.55.42.2.48.68 1.67.74 1.79.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.24-.1.47.14.23.62 1.03 1.34 1.67.92.82 1.7 1.07 1.93 1.19.24.12.38.1.52-.06.14-.16.59-.69.75-.93.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.56-.17 1.1z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-light text-white tracking-wide">
              Secure Chat
            </h1>
          </div>

          {/* Auth Card */}
          <div className="bg-wa-header rounded-lg shadow-2xl overflow-hidden">
            {/* Tab Switcher */}
            <div className="flex border-b border-wa-border">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3.5 text-sm font-medium tracking-wide transition-smooth
                  ${isLogin
                    ? "text-wa-unread border-b-2 border-wa-unread"
                    : "text-wa-text-secondary hover:text-wa-text-primary"
                  }`}
              >
                SIGN IN
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3.5 text-sm font-medium tracking-wide transition-smooth
                  ${!isLogin
                    ? "text-wa-unread border-b-2 border-wa-unread"
                    : "text-wa-text-secondary hover:text-wa-text-primary"
                  }`}
              >
                REGISTER
              </button>
            </div>

            <div className="p-6">
              {isLogin ? <LoginForm /> : <RegistrationForm />}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-wa-text-secondary text-xs">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              <span>End-to-end encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};