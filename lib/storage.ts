import { type UploadSession, type UploadQueueItem } from './types'

class StorageManager {
  private static ACCESS_TOKEN_KEY = 'google_drive_access_token'
  private static REFRESH_TOKEN_KEY = 'google_drive_refresh_token'
  private static UPLOAD_SESSION_KEY = 'upload_session'
  private static UPLOAD_QUEUE_KEY = 'upload_queue'

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

  static clearAuth(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
  }

  // Upload session management
  static setUploadSession(session: UploadSession): void {
    localStorage.setItem(this.UPLOAD_SESSION_KEY, JSON.stringify(session))
  }

  static getUploadSession(): UploadSession | null {
    const data = localStorage.getItem(this.UPLOAD_SESSION_KEY)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ? JSON.parse(data) : null
  }

  static setUploadQueue(queue: UploadQueueItem[]): void {
    localStorage.setItem(this.UPLOAD_QUEUE_KEY, JSON.stringify(queue))
  }

  static getUploadQueue(): UploadQueueItem[] {
    const data = localStorage.getItem(this.UPLOAD_QUEUE_KEY)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ? JSON.parse(data) : []
  }

  static clearUploadData(): void {
    localStorage.removeItem(this.UPLOAD_SESSION_KEY)
    localStorage.removeItem(this.UPLOAD_QUEUE_KEY)
  }
}

export { StorageManager }
