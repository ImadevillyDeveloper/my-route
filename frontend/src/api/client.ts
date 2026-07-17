import axios from 'axios';

// In production, set VITE_API_URL to the deployed backend's origin (e.g. https://my-backend.onrender.com).
// Left unset in local dev — falls back to the Vite dev-server proxy at /api.
export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:8977';

// Uploaded-file URLs are either backend-relative ("/uploads/x.jpg") or, when
// storage is Supabase, already absolute — don't double-prefix those. Local
// object-URL previews (unsent attachments) are passed through unchanged too.
export const resolveAssetUrl = (url: string) =>
  (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) ? url : `${API_ORIGIN}${url}`;

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
    // A 401 from a login endpoint means "wrong credentials", not "session expired" —
    // don't wipe storage / redirect, let the calling screen show its own error.
    const isLoginCall = (error.config?.url ?? '').includes('/auth/login/')
    if (error.response?.status === 401 && !isLoginCall) {
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

export const loginAdmin = (password: string) =>
  api.post('/auth/login/admin', { password });

// Admin
export interface AdminEntrepreneur {
  id: number
  full_name: string
  phone: string | null
  avatar_url: string | null
  created_at: string
  vehicles_count: number
  drivers_count: number
}
export const getAdminEntrepreneurs = () => api.get<AdminEntrepreneur[]>('/admin/entrepreneurs')
export const createAdminEntrepreneur = (full_name: string, phone: string) =>
  api.post<AdminEntrepreneur>('/admin/entrepreneurs', { full_name, phone })
export const deleteAdminEntrepreneur = (id: number) =>
  api.delete(`/admin/entrepreneurs/${id}`)

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
export const getMyVehiclesLive = () => api.get('/tracking/my-vehicles/live')
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
export const postGpsPosition = (lat: number, lng: number, speed: number) =>
  api.post('/tracking/gps', { lat, lng, speed })

// Trips ("рейсы")
export interface NamedStop { name: string; lat: number; lng: number }
export interface TerminalCoords { start: NamedStop | null; end: NamedStop | null }
export interface StopDeparture { route_number: string; eta_min?: number; destination?: string }
export interface StopSchedule { stop_name: string; departures: StopDeparture[]; note?: string }
export interface Trip {
  id: number
  route_number: string
  start_terminal: string
  end_terminal: string | null
  direction: 'forward' | 'back'
  started_at: string
  ended_at: string | null
  close_method: 'gps' | 'manual' | null
}
export const getRouteTerminalCoords = (routeNumber: string) =>
  api.get<TerminalCoords>('/tracking/route-terminals', { params: { route_number: routeNumber } })
export const getNamedStops = (routeNumber: string) =>
  api.get<NamedStop[]>('/tracking/named-stops', { params: { route_number: routeNumber } })
export const getStopSchedule = (stopName: string, lat: number, lng: number) =>
  api.get<StopSchedule>('/tracking/stop-schedule', { params: { stop_name: stopName, lat, lng } })
export const openTrip = (routeNumber: string, startTerminal: string, direction: 'forward' | 'back', shiftStartRef?: string) =>
  api.post<Trip>('/tracking/trips/open', { route_number: routeNumber, start_terminal: startTerminal, direction, shift_start_ref: shiftStartRef })
export const closeTrip = (tripId: number, endTerminal: string, closeMethod: 'gps' | 'manual' = 'gps') =>
  api.post<Trip>(`/tracking/trips/${tripId}/close`, { end_terminal: endTerminal, close_method: closeMethod })
export const getTrips = (params: { report_id?: number; shift_start_ref?: string }) =>
  api.get<Trip[]>('/tracking/trips', { params })

// Chat
export const getChatConversations = () => api.get('/chat/conversations')
export const getChatMessages = (conversationKey: string) =>
  api.get('/chat/messages', { params: { conversation_key: conversationKey } })
export const postChatMessage = (conversationKey: string, text: string, replyToId?: number) =>
  api.post('/chat/messages', { conversation_key: conversationKey, text, reply_to_id: replyToId })
export const getChatRouteMembers = (routeNumber: string) =>
  api.get('/chat/route-members', { params: { route_number: routeNumber } })
export const setChatConversationState = (conversationKey: string, state: { pinned?: boolean; hidden?: boolean }) =>
  api.put('/chat/conversations/state', { conversation_key: conversationKey, ...state })
export const clearChatConversation = (conversationKey: string) =>
  api.put('/chat/conversations/state', { conversation_key: conversationKey, clear: true })
export const editChatMessage = (messageId: number, text: string) =>
  api.put(`/chat/messages/${messageId}`, { text })
export const deleteChatMessage = (messageId: number, forEveryone: boolean) =>
  api.delete(`/chat/messages/${messageId}`, { params: { for_everyone: forEveryone } })
export const getChatGroup = (conversationKey: string) =>
  api.get('/chat/group', { params: { conversation_key: conversationKey } })
export const updateChatGroupTitle = (conversationKey: string, title: string) =>
  api.put('/chat/group', { conversation_key: conversationKey, title })
export const uploadChatGroupAvatar = (conversationKey: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/chat/group/avatar', fd, { params: { conversation_key: conversationKey } })
}
export const addChatGroupAdmin = (conversationKey: string, userId: number) =>
  api.post('/chat/group/admins', { conversation_key: conversationKey, user_id: userId })
export const removeChatGroupAdmin = (conversationKey: string, userId: number) =>
  api.delete(`/chat/group/admins/${userId}`, { params: { conversation_key: conversationKey } })
export const removeChatGroupMember = (conversationKey: string, userId: number) =>
  api.delete(`/chat/group/members/${userId}`, { params: { conversation_key: conversationKey } })
export const uploadChatAttachment = (
  conversationKey: string,
  file: File | Blob,
  kind: 'image' | 'file' | 'voice' | 'video_note',
  opts?: { caption?: string; duration?: number; filename?: string; replyToId?: number }
) => {
  const fd = new FormData()
  fd.append('conversation_key', conversationKey)
  fd.append('kind', kind)
  fd.append('caption', opts?.caption ?? '')
  if (opts?.duration != null) fd.append('duration', String(Math.round(opts.duration)))
  if (opts?.replyToId != null) fd.append('reply_to_id', String(opts.replyToId))
  fd.append('file', file, opts?.filename ?? (file instanceof File ? file.name : 'attachment'))
  return api.post('/chat/messages/upload', fd, { timeout: 60000 })
}

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
export interface RouteVehicle { id: number; plate_number: string; model: string }
export const getMyRouteVehicles = () => api.get<RouteVehicle[]>('/drivers/me/route-vehicles')
export const startShift = (vehiclePlate?: string) =>
  api.post('/drivers/me/start-shift', { vehicle_plate: vehiclePlate })
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
