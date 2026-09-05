import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { ExternalApisConfig } from '../../../config/configuration';

const REQUEST_TIMEOUT_MS = 5000;
const MIN_INTERVAL_MS = 1100; // Nominatim usage policy: max 1 req/sec

export interface GeocodeResult {
  lat: number;
  lng: number;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
}

/**
 * Nominatim (RF-09). Manual throttling respects Nominatim's usage policy —
 * only relevant when a user registers a new store; the seed uses
 * pre-loaded coordinates so `docker compose up` never depends on this
 * client (RNF-04/RNF-02).
 */
@Injectable()
export class NominatimClient {
  private readonly logger = new Logger(NominatimClient.name);
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private lastRequestAt = 0;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    const config = configService.get<ExternalApisConfig>('externalApis')!;
    this.baseUrl = config.nominatimBaseUrl;
    this.userAgent = config.nominatimUserAgent;
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    await this.throttle();
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<NominatimSearchResult[]>(
          `${this.baseUrl}/search`,
          {
            params: { q: address, format: 'json', limit: 1 },
            headers: { 'User-Agent': this.userAgent },
            timeout: REQUEST_TIMEOUT_MS,
          },
        ),
      );
      const first = data[0];
      if (!first) return null;
      return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
    } catch (error) {
      this.logger.warn(
        `Nominatim geocoding failed for "${address}": ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_INTERVAL_MS - elapsed),
      );
    }
    this.lastRequestAt = Date.now();
  }
}
