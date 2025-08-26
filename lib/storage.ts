
class StorageManager {
  private static ACCESS_TOKEN_KEY = 'google_drive_access_token'
  private static REFRESH_TOKEN_KEY = 'google_drive_refresh_token'
  private static TOKEN_EXPIRY_KEY = 'google_drive_token_expiry'

  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY)
  }

  static setAccessToken(token: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token)
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY)
  }

  static setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token)
  }

  static getTokenExpiry(): number | null {
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY)
    return expiry ? parseInt(expiry, 10) : null
  }

  static setTokenExpiry(expiry: number): void {
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiry.toString())
  }

  static isTokenExpired(): boolean {
    const expiry = this.getTokenExpiry()
    if (!expiry) return true
    
    // Check if token expires in the next 5 minutes (300 seconds)
    const now = Date.now()
    const bufferTime = 5 * 60 * 1000 // 5 minutes buffer
    return now >= (expiry - bufferTime)
  }

  static clearAuth(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY)
  }
}

export { StorageManager }
