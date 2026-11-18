import { db } from './store'
import { addressLine } from './util'

/** Busca as coordenadas reais do endereço cadastrado (OpenStreetMap/Nominatim) e salva no cliente. */
export async function geocodeClient(id: number, c: any): Promise<'ok' | 'notfound' | 'error'> {
  try {
    const hit = await window.api.geo.lookup(c)
    if (hit) {
      await db.update('clients', id, { lat: hit.lat, lng: hit.lng, geo_status: 'ok' })
      return 'ok'
    }
    await db.update('clients', id, { lat: null, lng: null, geo_status: 'notfound' })
    return 'notfound'
  } catch {
    return 'error' // provavelmente sem internet; tenta de novo depois pelo Mapa de Clientes
  }
}

export const fullAddress = (c: any) => [c.street, c.number, c.neighborhood, c.city, c.state].filter(Boolean).join(', ') || addressLine(c)
