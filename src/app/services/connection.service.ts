import { Injectable, signal } from '@angular/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConnectionProfile } from '../models/connection';

const STORAGE_KEY = 'dl.profiles';
const ACTIVE_KEY = 'dl.activeProfileId';

@Injectable({ providedIn: 'root' })
export class ConnectionService {
  readonly profiles = signal<ConnectionProfile[]>(this.loadProfiles());
  readonly activeProfileId = signal<string | null>(localStorage.getItem(ACTIVE_KEY));

  private lowLevelClient: DynamoDBClient | null = null;
  private docClient: DynamoDBDocumentClient | null = null;
  private clientForProfileId: string | null = null;

  get activeProfile(): ConnectionProfile | null {
    const id = this.activeProfileId();
    return this.profiles().find((p) => p.id === id) ?? null;
  }

  private loadProfiles(): ConnectionProfile[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ConnectionProfile[]) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles()));
  }

  saveProfile(profile: ConnectionProfile): void {
    const existing = this.profiles();
    const idx = existing.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      const next = [...existing];
      next[idx] = profile;
      this.profiles.set(next);
    } else {
      this.profiles.set([...existing, profile]);
    }
    this.persist();
    // Invalidate cached client if the active profile changed.
    if (profile.id === this.activeProfileId()) {
      this.resetClient();
    }
  }

  deleteProfile(id: string): void {
    this.profiles.set(this.profiles().filter((p) => p.id !== id));
    this.persist();
    if (this.activeProfileId() === id) {
      this.setActive(null);
    }
  }

  setActive(id: string | null): void {
    this.activeProfileId.set(id);
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
    this.resetClient();
  }

  private resetClient(): void {
    this.lowLevelClient?.destroy();
    this.lowLevelClient = null;
    this.docClient = null;
    this.clientForProfileId = null;
  }

  /**
   * Resolve the configured endpoint to an absolute URL. The AWS SDK requires an
   * absolute endpoint, but we let users enter relative proxy paths like `/local`
   * or `/aws` (served by the bundled nginx). Those are resolved against the
   * current page origin so they "just work" when the SPA is served by nginx.
   */
  private resolveEndpoint(raw: string | undefined): string | undefined {
    const value = raw?.trim();
    if (!value) return undefined;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/') && typeof window !== 'undefined') {
      return new URL(value, window.location.origin).toString();
    }
    return value;
  }

  private buildClient(profile: ConnectionProfile): DynamoDBClient {
    const endpoint = this.resolveEndpoint(profile.endpoint);
    return new DynamoDBClient({
      region: profile.region,
      endpoint,
      credentials: {
        accessKeyId: profile.accessKeyId,
        secretAccessKey: profile.secretAccessKey,
        sessionToken: profile.sessionToken || undefined,
      },
    });
  }

  getClient(): DynamoDBClient {
    const profile = this.activeProfile;
    if (!profile) {
      throw new Error('No active connection profile selected.');
    }
    if (!this.lowLevelClient || this.clientForProfileId !== profile.id) {
      this.resetClient();
      this.lowLevelClient = this.buildClient(profile);
      this.docClient = DynamoDBDocumentClient.from(this.lowLevelClient, {
        marshallOptions: { removeUndefinedValues: true },
      });
      this.clientForProfileId = profile.id;
    }
    return this.lowLevelClient;
  }

  getDocClient(): DynamoDBDocumentClient {
    this.getClient();
    return this.docClient!;
  }
}
