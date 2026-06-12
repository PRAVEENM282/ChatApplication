import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * Root React engine bootstrap script.
 * Binds React render tree to the #root DOM element.
 */
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root HTML container #root not found in document");

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
