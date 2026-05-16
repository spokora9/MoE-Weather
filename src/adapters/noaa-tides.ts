import { createLogger } from '../lib/logger.js';
const logger = createLogger('adapter:noaa-tides');

export interface TidePrediction {
  time: Date;
  height: number;
  type: 'high' | 'low';
}

class NOAATidesAdapter {
  private stationCache = new Map<string, { stationId: string; name: string; expires: number }>();

  isUSLocation(lat: number, lon: number): boolean {
    const isContiguous = lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66;
    const isAlaska = lat >= 51 && lat <= 72 && lon >= -180 && lon <= -130;
    const isHawaii = lat >= 18 && lat <= 29 && lon >= -161 && lon <= -154;
    return isContiguous || isAlaska || isHawaii;
  }

  private coordKey(lat: number, lon: number): string {
    return `${Math.round(lat * 10) / 10},${Math.round(lon * 10) / 10}`;
  }

  private async findNearestStation(lat: number, lon: number): Promise<string | null> {
    const key = this.coordKey(lat, lon);
    const cached = this.stationCache.get(key);
    if (cached && Date.now() < cached.expires) return cached.stationId;

    const url = `https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=metric&radius=50&lat=${lat}&lon=${lon}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json() as { stations?: Array<{ id: string; name: string }> };
      const station = data.stations?.[0];
      if (!station) return null;
      this.stationCache.set(key, { stationId: station.id, name: station.name, expires: Date.now() + 86400000 });
      return station.id;
    } catch {
      return null;
    }
  }

  async getTidePredictions(lat: number, lon: number): Promise<TidePrediction[]> {
    if (!this.isUSLocation(lat, lon)) return [];
    const stationId = await this.findNearestStation(lat, lon);
    if (!stationId) {
      logger.warn({ lat, lon }, 'No NOAA tide station found nearby');
      return [];
    }
    const today = new Date();
    const beginDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${beginDate}&range=48&station=${stationId}&product=predictions&datum=MLLW&time_zone=lst_lmt&interval=hilo&units=metric&application=moe_weather&format=json`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json() as { predictions?: Array<{ t: string; v: string; type: string }> };
      return (data.predictions || []).map(p => ({
        time: new Date(p.t),
        height: parseFloat(p.v),
        type: p.type === 'H' ? 'high' : 'low',
      }));
    } catch (err) {
      logger.warn({ err, stationId }, 'NOAA tide fetch failed');
      return [];
    }
  }
}

export const noaaTidesAdapter = new NOAATidesAdapter();
