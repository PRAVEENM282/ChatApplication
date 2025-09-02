import axios, { AxiosError, AxiosRequestConfig } from "axios";

// --- CSRF Token Holder ---
let csrfToken = '';

/**
 * Sets the CSRF token to be used by Axios requests.
 * @param token The CSRF token string.
 */
export const setCsrfToken = (token: string) => {
    csrfToken = token;
};

// --- 🔐 Track refresh state and subscribers ---
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// --- ✅ Extend Axios config to allow _retry flag ---
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// --- 🚀 Create Axios instance ---
const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});

// --- 📦 Attach access token and CSRF token to every request ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  config.headers = config.headers || {}; // 🛡 Ensure headers exist
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  // Attach CSRF token to state-changing methods
  const method = config.method?.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

// --- 🔁 Handle token expiration and refresh ---
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalReq = error.config as CustomAxiosRequestConfig;
    const status = error.response?.status;

    if ((status === 401 || status === 403) && !originalReq._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            originalReq.headers = originalReq.headers || {};
            originalReq.headers["Authorization"] = `Bearer ${newToken}`;
            resolve(api(originalReq));
          });
        });
      }

      originalReq._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.get("/api/auth/refresh");

        const newAccessToken = data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;

        onRefreshed(newAccessToken);

        originalReq.headers = originalReq.headers || {};
        originalReq.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return api(originalReq);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        window.location.href = "/auth";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

api.interceptors.request.use(
  (config) => {
    // Only attach CSRF token if we have one
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;