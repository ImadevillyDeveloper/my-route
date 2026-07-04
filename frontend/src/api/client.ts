import axios from 'axios';

// In production, set VITE_API_URL to the deployed backend's origin (e.g. https://my-backend.onrender.com).
// Left unset in local dev — falls back to the Vite dev-server proxy at /api.
export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:8977';

// Uploaded-file URLs are either backend-relative ("/uploads/x.jpg") or, when
// storage is Supabase, already absolute — don't double-prefix those.
export const resolveAssetUrl = (url: string) => (url.startsWith('http') ? url : `${API_ORIGIN}${url}`);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const loginDriver = (driver_id: string) =>
  api.post('/auth/login/driver', { driver_id });

export const loginEntrepreneur = (phone: string) =>
  api.post('/auth/login/entrepreneur', { phone });

export const loginGosuslugi = () =>
  api.post('/auth/login/gosuslugi');

// Users
export const getMe = () => api.get('/users/me');
export const updateMe = (data: object) => api.put('/users/me', data);

// Tracking
export const getPosition = () => api.get('/tracking/position');
export const getRivals = (direction?: string) =>
  api.get('/tracking/rivals', { params: direction ? { direction } : {} });
export const getRivalsLive = (routes: string[], ourRoute?: string, ourDestination?: string) => {
  const params: Record<string, string> = { routes: routes.join(',') }
  if (ourRoute) params.our_route = ourRoute
  if (ourDestination) params.our_destination = ourDestination
  return api.get('/tracking/rivals/live', { params })
}
export const computeCompetitorMapping = (ourRoute: string, competitorRoute: string) =>
  api.post('/tracking/competitor-mapping', null, { params: { our_route: ourRoute, competitor_route: competitorRoute } })
export const getHint = (
  ourRoute: string, ourLat: number, ourLng: number,
  ourSpeed: number, ourDestination: string
) => api.get('/tracking/hint', { params: {
  our_route: ourRoute, our_lat: ourLat, our_lng: ourLng,
  our_speed: ourSpeed, our_destination: ourDestination,
}})
export const requestRecommendation = (direction: string) =>
  api.post('/tracking/request', { direction });
export const getKnownRoutes = () => api.get<string[]>('/tracking/routes')
export const getNearestStop = (routeNumber: string, lat: number, lng: number) =>
  api.get('/tracking/nearest-stop', { params: { route_number: routeNumber, lat, lng } })

// Chat
export const getChatConversations = () => api.get('/chat/conversations')
export const getChatMessages = (conversationKey: string) =>
  api.get('/chat/messages', { params: { conversation_key: conversationKey } })
export const postChatMessage = (conversationKey: string, text: string) =>
  api.post('/chat/messages', { conversation_key: conversationKey, text })

// Reports
export const scanReceipt = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/reports/scan', fd);
};
export const createReport = (data: object) => api.post('/reports', data);
export const getReports = (params?: object) => api.get('/reports', { params });
export const getReport = (id: number) => api.get(`/reports/${id}`);
export const updateReportStatus = (id: number, status: string) =>
  api.put(`/reports/${id}/status`, { status });
export const adjustReport = (id: number, status: string, notes?: string) =>
  api.put(`/reports/${id}/adjust`, { status, notes });
export const deleteReport = (id: number) => api.delete(`/reports/${id}`);

// Routes
export const getRoutes = () => api.get('/routes');
export const createRoute = (data: object) => api.post('/routes', data);
export const updateRoute = (id: number, data: object) => api.put(`/routes/${id}`, data);
export const deleteRoute = (id: number) => api.delete(`/routes/${id}`);

// Vehicles
export const getVehicles = () => api.get('/vehicles');
export const createVehicle = (data: object) => api.post('/vehicles', data);
export const updateVehicle = (id: number, data: object) => api.put(`/vehicles/${id}`, data);
export const deleteVehicle = (id: number) => api.delete(`/vehicles/${id}`);
export const uploadVehiclePhoto = (id: number, file: File) => {
  const fd = new FormData(); fd.append('file', file);
  return api.post(`/vehicles/${id}/photo`, fd);
};
export const uploadMyPhoto = (file: File) => {
  const fd = new FormData(); fd.append('file', file);
  return api.post('/users/me/photo', fd);
};
export const getVehiclesMap = () => api.get('/vehicles/map');
export const getVehicle = (id: number) => api.get(`/vehicles/${id}`);
export const getVehicleRepairs = (id: number) => api.get(`/vehicles/${id}/repairs`);
export const getVehicleInsurance = (id: number) => api.get(`/vehicles/${id}/insurance`);
export const getVehicleMaintenance = (id: number) => api.get(`/vehicles/${id}/maintenance`);
export const updateMaintenance = (id: number, data: object) =>
  api.put(`/vehicles/${id}/maintenance`, data);
export const updateInsurance = (id: number, data: object) =>
  api.put(`/vehicles/${id}/insurance`, data);

// Drivers
export const getDrivers = () => api.get('/drivers');
export const createDriver = (data: object) => api.post('/drivers', data);
export const updateDriver = (id: number, data: object) => api.put(`/drivers/${id}`, data);
export const deleteDriver = (id: number) => api.delete(`/drivers/${id}`);
export const uploadDriverPhoto = (id: number, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/drivers/${id}/photo`, fd);
};

// Repairs
export const createRepair = (data: object) => api.post('/repairs', data);

// Support
export const sendSupport = (data: { topic: string; message: string; contact?: string }) =>
  api.post('/support', data);

// Salary
export const calculateSalary = (period: string) =>
  api.get('/salary/calculate', { params: { period } });
export const exportSalary = (period: string) =>
  api.get('/salary/export', { params: { period }, responseType: 'blob' });
