'use client'

import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { BsFillCloudUploadFill } from 'react-icons/bs'
import LoadingIndicator from '@/components/loading-indicator'
import UploadInterface from '@/components/upload-interface'
import { GoogleDriveClientService } from '@/lib/google-drive-client'
import { UploadManager } from '@/lib/upload-manager'

export default function Home() {
  const [driveService, setDriveService] =
    useState<GoogleDriveClientService | null>(null)
  const [uploadManager, setUploadManager] = useState<UploadManager | null>(
    null
  )
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const service = new GoogleDriveClientService()
    const manager = new UploadManager(service)

    setDriveService(service)
    setUploadManager(manager)
  }, [])

  useEffect(() => {
    if (driveService) {
      void checkAuthStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveService])

  /* Check authentication status */
  const checkAuthStatus = async () => {
    if (!driveService) return

    try {
      const authenticated = await driveService.validateToken()
      setIsAuthenticated(authenticated)
    } catch (error) {
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  /* Handle authentication */
  const handleAuth = async () => {
    if (!driveService) return

    try {
      const authUrl = await driveService.getAuthUrl()

      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        authUrl,
        '_blank',
        `width=${width}, height=${height}, left=${left}, top=${top}`
      )

      // Listen for authentication success
      const handleMessage = (event: MessageEvent) => {
        const { type, tokens } = event.data as { type: string; tokens: { access_token: string } }
        if (type === 'AUTH_SUCCESS') {
          setIsAuthenticated(true)
          window.removeEventListener('message', handleMessage)
          driveService.setAccessToken(tokens.access_token)
          if (popup) popup.close()
        }
      }

      window.addEventListener('message', handleMessage)
    } catch (error) {
      console.error('Error starting authentication:', error)
    }
  }

  const handleLogout = () => {
    if (driveService) {
      driveService.clearAuth()
    }
    setIsAuthenticated(false)
  }

  if (isLoading || !driveService || !uploadManager) {
    return <LoadingIndicator />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-white/80 via-blue-50/80 to-indigo-50/80 dark:from-gray-900/80 dark:via-blue-900/80 dark:to-indigo-900/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BsFillCloudUploadFill className="text-white text-sm animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                GoogleDriveアップローダー
              </h1>
            </div>

            {/* Auth Section */}
            <div className="flex items-center space-x-3">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-full shadow-inner">
                    <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium bg-gradient-to-r from-green-700 to-emerald-700 dark:from-green-300 dark:to-emerald-300 bg-clip-text text-transparent">
                      接続済み
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm bg-gradient-to-r from-gray-500 to-gray-600 dark:from-gray-400 dark:to-gray-300 bg-clip-text text-transparent hover:from-gray-700 hover:to-gray-800 dark:hover:from-gray-200 dark:hover:to-gray-100 transition-all duration-200 hover:underline"
                  >
                    切断する
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAuth}
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 active:scale-95"
                >
                  GoogleDriveに接続する
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAuthenticated ? (
          <UploadInterface
            driveService={driveService}
            uploadManager={uploadManager}
          />
        ) : (
          <div className="text-center py-16">
            <div className="max-w-2xl mx-auto">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center mx-auto mb-10 animate-pulse">
                <BsFillCloudUploadFill
                  className="text-blue-500 dark:text-blue-400"
                  size={64}
                />
              </div>
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 mb-8">
                GoogleDriveに接続
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-12 leading-relaxed">
                ファイルをアップロードするには、Googleアカウントで認証してください
              </p>
              <button
                onClick={handleAuth}
                className="group relative bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white text-xl px-12 py-5 rounded-full font-bold transition-all duration-300 transform hover:shadow-2xl shadow-lg"
              >
                <span className="relative z-10">接続する</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  )
}
