import { getRoutes } from './client'

export interface RouteData {
  id: number
  number: string
  name: string
  start_point: string
  end_point: string
  document_number?: string
  is_active: boolean
}

export async function getRoutesWithOverrides(): Promise<RouteData[]> {
  const res = await getRoutes()
  return res.data
}
