import { HouseSigmaAuthResponse } from '../types';

class HouseSigmaAuthService {
  private accessToken: string | null = null;
  private tokenExpiration: number | null = null;
  private secretKey: string | null = null;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiration && Date.now() / 1000 < this.tokenExpiration) {
      return this.accessToken;
    }

    await this.authenticate();
    
    if (!this.accessToken) {
      throw new Error('Failed to obtain access token');
    }

    return this.accessToken;
  }

  async getSecretKey(): Promise<string> {
    if (this.secretKey && this.tokenExpiration && Date.now() / 1000 < this.tokenExpiration) {
      return this.secretKey;
    }

    await this.authenticate();
    
    if (!this.secretKey) {
      throw new Error('Failed to obtain secret key');
    }

    return this.secretKey;
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await fetch('https://housesigma.com/bkv2/api/init/accesstoken/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lang: 'en_US',
          province: 'ON'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as HouseSigmaAuthResponse;

      if (!data.status) {
        throw new Error(`Authentication failed: ${data.error.message}`);
      }

      this.accessToken = data.data.access_token;
      this.tokenExpiration = data.data.secret.expired_at;
      this.secretKey = data.data.secret.secret_key;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  isTokenValid(): boolean {
    return this.accessToken !== null && 
           this.tokenExpiration !== null && 
           Date.now() / 1000 < this.tokenExpiration;
  }
}

export const houseSigmaAuth = new HouseSigmaAuthService();