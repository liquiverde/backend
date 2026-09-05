export interface StoreSeed {
  name: string;
  chain: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Fictional store chain, real Santiago comuna coordinates (approximate
 * neighborhood centers) so the RF-09 route optimizer has a geographically
 * plausible, non-overlapping set of points to route between — without
 * seeding fabricated address data under a real supermarket brand.
 */
export const STORE_SEEDS: StoreSeed[] = [
  {
    name: 'EcoMarket Santiago Centro',
    chain: 'EcoMarket',
    address: "Av. Libertador Bernardo O'Higgins 1200, Santiago",
    lat: -33.4489,
    lng: -70.6693,
  },
  {
    name: 'EcoMarket Providencia',
    chain: 'EcoMarket',
    address: 'Av. Providencia 2200, Providencia',
    lat: -33.4269,
    lng: -70.6034,
  },
  {
    name: 'Verde&Fresco Las Condes',
    chain: 'Verde&Fresco',
    address: 'Av. Apoquindo 4500, Las Condes',
    lat: -33.4089,
    lng: -70.5661,
  },
  {
    name: 'Verde&Fresco Ñuñoa',
    chain: 'Verde&Fresco',
    address: 'Av. Irarrázaval 2900, Ñuñoa',
    lat: -33.4558,
    lng: -70.5989,
  },
  {
    name: 'BioTienda Vitacura',
    chain: 'BioTienda',
    address: 'Av. Vitacura 6100, Vitacura',
    lat: -33.3931,
    lng: -70.5651,
  },
  {
    name: 'BioTienda La Reina',
    chain: 'BioTienda',
    address: 'Av. Larraín 5500, La Reina',
    lat: -33.4407,
    lng: -70.5361,
  },
  {
    name: 'EcoMarket Maipú',
    chain: 'EcoMarket',
    address: 'Av. Pajaritos 2000, Maipú',
    lat: -33.5167,
    lng: -70.75,
  },
  {
    name: 'Verde&Fresco San Miguel',
    chain: 'Verde&Fresco',
    address: 'Gran Av. José Miguel Carrera 4200, San Miguel',
    lat: -33.4958,
    lng: -70.65,
  },
];
