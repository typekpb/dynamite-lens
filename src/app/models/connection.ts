export interface ConnectionProfile {
  id: string;
  name: string;
  /** 'local' uses a custom endpoint (DynamoDB Local); 'aws' targets real AWS. */
  mode: 'local' | 'aws';
  region: string;
  /**
   * For 'local' this is the DynamoDB Local endpoint (e.g. http://localhost:8000).
   * For 'aws' this is optional; when the app is served behind the bundled nginx
   * CORS proxy, set this to '/aws' so requests are proxied to AWS.
   */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export function emptyProfile(): ConnectionProfile {
  return {
    id: crypto.randomUUID(),
    name: '',
    mode: 'local',
    region: 'us-east-1',
    // When served via the bundled proxy, use '/local'. For direct dev against
    // DynamoDB Local (with CORS enabled) you can use 'http://localhost:8000'.
    endpoint: '/local',
    accessKeyId: 'local',
    secretAccessKey: 'local',
  };
}
