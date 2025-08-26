import axios from 'axios'
import { StorageManager } from './storage'
import { type GoogleSharedDrive, type TokenData } from './types'

/* Handles client-side Google Drive API operations */
class GoogleDriveClientService {
  private accessToken: string | null = null

  constructor() {
    this.accessToken = StorageManager.getAccessToken()
  }

  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken
    StorageManager.setAccessToken(accessToken)
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  /* Validate and refresh token if needed */
  async validateToken(): Promise<boolean> {
    if (!this.accessToken) return false
    const refreshToken = StorageManager.getRefreshToken()
    if (refreshToken) return await this.refreshAccessToken(refreshToken)

    try {
      const { status } = await axios.get('/api/drives', {
        params: {
          accessToken: this.accessToken,
        },
      })
      if (status === 200) return true
      if (status === 401 || status === 403) this.clearAuth()

      return false
    } catch (error) {
      console.error('Token validation failed:', error)
      return false
    }
  }

  /* Refresh access token using refresh token */
  async refreshAccessToken(refreshToken: string): Promise<boolean> {
    try {
      const {
        data: { tokens },
        status,
      } = await axios.post<{ tokens: TokenData }>('/api/auth/refresh', {
        refresh_token: refreshToken,
      })

      if (status !== 200) return false

      this.setAccessToken(tokens.access_token)
      StorageManager.setAccessToken(tokens.access_token)
      StorageManager.setRefreshToken(tokens.refresh_token || '')
      StorageManager.setTokenExpiry(tokens.expiry_date || 0)

      return true
    } catch (error) {
      console.error('Failed to refresh access token: ', error)
      return false
    }
  }

  async getTokenFromCode(code: string): Promise<TokenData> {
    const {
      data: { tokens, error },
      status,
    } = await axios.post<{ tokens: TokenData, error: string }>('/api/auth/google', { code })
    if (status !== 200) {
      throw new Error(error || '認証に失敗しました')
    }

    this.setAccessToken(tokens.access_token)
    StorageManager.setAccessToken(tokens.access_token)
    StorageManager.setRefreshToken(tokens.refresh_token || '')
    StorageManager.setTokenExpiry(tokens.expiry_date || 0)

    return tokens
  }

  /* Generate OAuth2 authorization URL */
  async getAuthUrl(): Promise<string> {
    const { data: { authUrl }, status } = await axios.get<{ authUrl: string }>('/api/auth/google/url')
    if (status !== 200) {
      throw new Error('Failed to get authorization URL')
    }
    return authUrl
  }

  /* List shared drives */
  async listSharedDrives(): Promise<{
    drives: GoogleSharedDrive[];
    status: number;
  }> {
    if (StorageManager.isTokenExpired()) {
      await this.refreshAccessToken(StorageManager.getRefreshToken() || '')
    }

    const {
      data: { drives },
      status,
    } = await axios.get<{ drives: GoogleSharedDrive[], status: number }>('/api/drives', {
      params: {
        accessToken: this.accessToken,
      },
    })

    return {
      drives: drives || [],
      status,
    }
  }

  /* Create folder in Google Drive */
  async createFolder(
    name: string,
    parentId?: string,
    sharedDriveId?: string
  ): Promise<string> {
    if (StorageManager.isTokenExpired()) {
      await this.refreshAccessToken(StorageManager.getRefreshToken() || '')
    }

    const { data: { folderId }, status } = await axios.post<{ folderId: string }>('/api/folders', {
      name,
      parentId,
      sharedDriveId,
      accessToken: this.accessToken,
    })

    if (status !== 200) {
      throw new Error('フォルダの作成に失敗しました')
    }

    return folderId
  }

  /* Upload file to Google Drive */
  async uploadFile(
    file: File,
    parentId?: string,
    sharedDriveId?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    if (StorageManager.isTokenExpired()) {
      await this.refreshAccessToken(StorageManager.getRefreshToken() || '')
    }

    const formData = new FormData()
    formData.append('file', file)
    if (parentId) formData.append('parentId', parentId)
    if (sharedDriveId) formData.append('sharedDriveId', sharedDriveId)
    formData.append('accessToken', this.accessToken || '')

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText) as { fileId: string }
            resolve(response.fileId)
          } catch (error) {
            reject(new Error('Invalid response format'))
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'))
      })

      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    })
  }

  /* Upload large file with chunked upload */
  async uploadLargeFile(
    file: File,
    parentId?: string,
    sharedDriveId?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // For large files, use the same endpoint but with chunked upload
    return this.uploadFile(file, parentId, sharedDriveId, onProgress)
  }

  /* Clear authentication */
  clearAuth(): void {
    this.accessToken = null
    StorageManager.clearAuth()
  }
}

export { GoogleDriveClientService }
