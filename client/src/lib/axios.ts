import axios, { AxiosError, AxiosRequestConfig } from "axios";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}
const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalReq = error.config as CustomAxiosRequestConfig;

    if (error.response?.status === 403 && !originalReq._retry) {
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
        api.defaults.headers.common["Authorization"] =
          `Bearer ${newAccessToken}`;

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

export default api;