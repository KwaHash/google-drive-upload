'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GoogleDriveClientService } from '@/lib/google-drive-client'

export default function AuthCallback() {
  const router = useRouter()
  const [driveService, setDriveService] =
    useState<GoogleDriveClientService | null>(null)
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  )
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const service = new GoogleDriveClientService()
    setDriveService(service)
  }, [])

  useEffect(() => {
    const handleAuth = async () => {
      if (!driveService) return

      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        setStatus('error')
        setError(error)
        return
      }

      if (!code) {
        setStatus('error')
        setError('認証コードが受信されませんでした')
        return
      }

      const tokens = await driveService.getTokenFromCode(code)
      setStatus('success')

      if (window.opener) {
        (window.opener as Window).postMessage({ type: 'AUTH_SUCCESS', tokens }, '*')
        window.close()
        router.push('/')
      }
    }

    void handleAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, driveService])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                認証中...
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                GoogleDriveの認証を完了するまでお待ちください。
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                認証が完了しました！
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                GoogleDriveとの認証が正常に完了しました。
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                認証に失敗しました
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                もう一度試す
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
