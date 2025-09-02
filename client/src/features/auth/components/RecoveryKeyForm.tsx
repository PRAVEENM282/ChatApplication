import React, { useState } from "react";
import { savePrivateKey } from "../../../utils/KeyStorage";
import { useAuth } from "../../../context/AuthProvider";

interface RecoveryKeyFormProps {
  username: string;
  onSuccess: () => void; // Callback to proceed after key is saved
}

const RecoveryKeyForm: React.FC<RecoveryKeyFormProps> = ({ username, onSuccess }) => {
  const [recoveryKey, setRecoveryKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKey.trim()) {
      setError("Recovery key cannot be empty.");
      return;
    }
    try {
      // Simply save the provided key to IndexedDB for this session
      await savePrivateKey(username, recoveryKey);
      onSuccess(); // Proceed to chat page
    } catch (err) {
      setError("Failed to save recovery key. Please ensure your browser supports IndexedDB.");
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg px-8 pt-6 pb-8 mb-4">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Enter Recovery Key</h2>
        <p className="text-center text-gray-600 mb-6">You've logged in on a new device. Please enter the recovery key you saved during registration.</p>
        
        {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center">{error}</p>}

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="recovery-key">
            Recovery Key
          </label>
          <textarea
            id="recovery-key"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
            required
            placeholder="Paste your saved key here..."
          />
        </div>

        <div className="flex items-center justify-center">
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
          >
            Unlock & Continue
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecoveryKeyForm;