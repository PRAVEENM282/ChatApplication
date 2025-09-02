import React, { useState } from "react";
import { RegistrationForm } from "../components/RegistrationForm";
import LoginForm from "../components/LoginForm";

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        {isLogin ? <LoginForm /> : <RegistrationForm />}
        <div className="mt-6 text-center text-gray-600">
          {isLogin ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setIsLogin(false)}
                className="text-blue-600 hover:underline focus:outline-none"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setIsLogin(true)}
                className="text-blue-600 hover:underline focus:outline-none"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
