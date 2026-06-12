import axios, { AxiosError, AxiosRequestConfig } from "axios";

// Flag to track token refresh request status
let isRefreshing = false;
// Queue for API requests awaiting refresh token rotation completion
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Queue callbacks of failed HTTP requests to retry once the refreshed token becomes available.
 */
function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

/**
 * Empty the callback queue, resolving pending requests with the newly minted access token.
 */
function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// Axios instance matching the server API address configured in VITE environment
const api = axios.create({
  baseURL: (import.meta as any).env.VITE_API_URL || window.location.origin,
  withCredentials: true,
});

// Interceptor to automatically attach Bearer Auth tokens stored in localstorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle Token Rotation (retries requests once on 403 Forbidden with refreshed cookies)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalReq = error.config as CustomAxiosRequestConfig;

    if (error.response?.status === 403 && !originalReq._retry) {
      if (isRefreshing) {
        // Queue this request for retry once refresh operation returns
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
        // Trigger silent refresh cookie rotation flow
        const { data } = await axios.get("/api/auth/refresh", {
          baseURL: api.defaults.baseURL,
          withCredentials: true,
        });

        const newAccessToken = data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);
        api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;

        onRefreshed(newAccessToken);
        originalReq.headers = originalReq.headers || {};
        originalReq.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return api(originalReq);
      } catch (refreshError) {
        // Clear expired credentials and boot user back to login screen
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

export default api;
