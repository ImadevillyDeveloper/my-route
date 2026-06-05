export type UserRole = 'driver' | 'entrepreneur';

export interface AuthState {
  token: string | null;
  role: UserRole | null;
  userId: number | null;
  fullName: string | null;
}

export interface User {
  id: number;
  driver_id?: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  biometric_enabled: boolean;
  avatar_url?: string;
}

export interface Route {
  id: number;
  number: string;
  name: string;
  start_point: string;
  end_point: string;
  stops?: string;
  document_number?: string;
  is_active: boolean;
}

export interface Vehicle {
  id: number;
  plate_number: string;
  model: string;
  year?: number;
  route_id?: number;
  route_number?: string;
  status: 'on_route' | 'parked' | 'repair';
  lat?: number;
  lng?: number;
  speed: number;
}

export interface Report {
  id: number;
  driver_id: number;
  driver_name?: string;
  route_number?: string;
  plate_number?: string;
  shift_date: string;
  shift_start?: string;
  shift_end?: string;
  total_trips: number;
  total_revenue: number;
  fuel_cost: number;
  notes?: string;
  receipt_image_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'adjusted';
  created_at: string;
  reviewed_at?: string;
}

export interface Repair {
  id: number;
  vehicle_id: number;
  date: string;
  repair_type: string;
  description?: string;
  cost: number;
}

export interface SalaryRecord {
  driver_id: number;
  driver_name: string;
  total: number;
  base_amount: number;
  bonuses: number;
  fines: number;
}

export interface RivalVehicle {
  id: number;
  unit_id?: string;
  lat: number;
  lng: number;
  speed: number;
  direction: string;
  route_number?: string;
  plate_number?: string;
  model?: string;
  status?: string;
}

export interface Position {
  lat: number;
  lng: number;
  speed: number;
}
