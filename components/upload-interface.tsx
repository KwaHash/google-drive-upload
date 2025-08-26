'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
  Upload,
  Folder,
  File,
  Play,
  Pause,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Trash,
  Cloud,
  HardDrive,
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-hot-toast'
import { type GoogleDriveClientService } from '@/lib/google-drive-client'
import { type FileInfo, type UploadStats , type GoogleSharedDrive } from '@/lib/types'
import { type UploadManager } from '@/lib/upload-manager'

// TypeScript declarations for File System Access API
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      multiple?: boolean;
    }): Promise<FileSystemDirectoryHandle[]>;
    showOpenFilePicker(options?: {
      multiple?: boolean;
      types?: {
        description: string;
        accept: Record<string, string[]>;
      }[];
    }): Promise<FileSystemFileHandle[]>;
  }
}

interface UploadInterfaceProps {
  driveService: GoogleDriveClientService;
  uploadManager: UploadManager;
}

export default function UploadInterface({
  driveService,
  uploadManager,
}: UploadInterfaceProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([])
  const [fileObjects, setFileObjects] = useState<Map<string, File>>(new Map())
  const [isProcessingFolders, setIsProcessingFolders] = useState(false)

  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  const [sharedDrives, setSharedDrives] = useState<GoogleSharedDrive[]>([])
  const [selectedDrive, setSelectedDrive] = useState<string>('')
  const [isLoadingDrives, setIsLoadingDrives] = useState(false)

  useEffect(() => {
    if (uploadManager) {
      uploadManager.setProgressCallback(setUploadStats)
    }
  }, [uploadManager])

  useEffect(() => {
    if (driveService) {
      void loadSharedDrives()
    }
  }, [driveService])

  const loadSharedDrives = async () => {
    setIsLoadingDrives(true)
    const { drives, status } = await driveService.listSharedDrives()
    if (status === 200) setSharedDrives(drives)
    else setShowAuthDialog(true)
    setIsLoadingDrives(false)
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

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const fileInfos: FileInfo[] = acceptedFiles.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        isDirectory: false,
      }))

      // Store file objects
      const newFileObjects = new Map(fileObjects)
      acceptedFiles.forEach((file, index) => {
        const fileInfo = fileInfos[index]
        newFileObjects.set(fileInfo.name, file)
      })
      setFileObjects(newFileObjects)

      setSelectedFiles((prev) => [...prev, ...fileInfos])
      toast.success(`${acceptedFiles.length}ファイルを追加しました`)
    },
    [fileObjects]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  })

  // Helper function to process directory recursively
  const processDirectory = async (
    handle: any,
    basePath: string,
    fileObjects: Map<string, File>
  ): Promise<FileInfo> => {
    // Create the directory entry
    const directoryInfo: FileInfo = {
      name: handle.name,
      size: 0,
      type: 'folder',
      isDirectory: true,
      children: [],
    }

    // Process all entries in the directory
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile()
        const fileInfo: FileInfo = {
          name: entry.name,
          size: file.size,
          type: file.type,
          isDirectory: false,
        }
        directoryInfo.children!.push(fileInfo)
        fileObjects.set(fileInfo.name, file)
      } else if (entry.kind === 'directory') {
        // Recursively process subdirectories
        const subDirectoryInfo = await processDirectory(
          entry,
          `${basePath}/${entry.name}`,
          fileObjects
        )
        directoryInfo.children!.push(subDirectoryInfo)
      }
    }

    return directoryInfo
  }

  const handleFolderSelection = useCallback(async () => {
    try {
      // Check if File System Access API is available
      if (!('showDirectoryPicker' in window)) {
        // Fallback to file input with directory support
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        input.webkitdirectory = true
        input.onchange = (e) => {
          const target = e.target as HTMLInputElement
          if (target.files) {
            const files = Array.from(target.files)
            const fileInfos: FileInfo[] = files.map((file) => ({
              name: file.name,
              size: file.size,
              type: file.type,
              isDirectory: false,
            }))

            // Store file objects
            const newFileObjects = new Map(fileObjects)
            files.forEach((file, index) => {
              const fileInfo = fileInfos[index]
              newFileObjects.set(fileInfo.name, file)
            })
            setFileObjects(newFileObjects)

            setSelectedFiles((prev) => [...prev, ...fileInfos])
            toast.success(`選択したフォルダから${files.length}個のアイテムを追加しました`)
          }
        }
        input.click()
        return
      }

      setIsProcessingFolders(true)

      // Use a custom approach for mixed selection
      // First, try to get files
      let fileHandles: FileSystemFileHandle[] = []
      try {
        const result = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'All Files',
              accept: {
                '*/*': ['.*'],
              },
            },
          ],
        })
        // Ensure fileHandles is always an array
        fileHandles = Array.isArray(result) ? result : [result]
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.log('No files selected or file picker cancelled')
        }
      }

      // Then, try to get folders
      let folderHandles: FileSystemDirectoryHandle[] = []
      try {
        const result = await window.showDirectoryPicker({ multiple: true })
        // Ensure folderHandles is always an array
        folderHandles = Array.isArray(result) ? result : [result]
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.log('No folders selected or folder picker cancelled')
        }
      }

      // If neither files nor folders were selected, return
      if (fileHandles.length === 0 && folderHandles.length === 0) {
        toast('フォルダが選択されていません')
        return
      }

      const files: FileInfo[] = []
      const newFileObjects = new Map(fileObjects)

      // Process selected files
      for (const fileHandle of fileHandles) {
        const file = await fileHandle.getFile()
        const fileInfo = {
          name: file.name,
          size: file.size,
          type: file.type,
          isDirectory: false,
        }
        files.push(fileInfo)
        newFileObjects.set(fileInfo.name, file)
      }

      // Process selected folders
      for (const folderHandle of folderHandles) {
        const directoryInfo = await processDirectory(
          folderHandle,
          folderHandle.name,
          newFileObjects
        )
        files.push(directoryInfo) // Add the directory entry to the list
      }

      setFileObjects(newFileObjects)
      setSelectedFiles((prev) => [...prev, ...files])

      toast.success("フォルダを追加しました")
    } catch (error) {
      console.error('Error selecting files/folders: ', error)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('選択がキャンセルされました')
        } else if (error.name === 'SecurityError') {
          toast.error('権限が拒否されました。ファイル/フォルダへのアクセスを許可してください。')
        } else {
          toast.error('フォルダの選択に失敗しました')
        }
      } else {
        toast.error('フォルダの選択に失敗しました')
      }
    } finally {
      setIsProcessingFolders(false)
    }
  }, [fileObjects])

  const handleStartUpload = async () => {
    await uploadManager.addFilesWithObjects(
      selectedFiles,
      fileObjects,
      selectedDrive
    )
    await uploadManager.startUpload()
  }

  const handleToggleUpload = async () => {
    if (uploadManager.isPaused()) {
      toast.success('アップロードを再開しました')
      await uploadManager.resumeUpload()
    } else {
      toast.success('アップロードを一時停止しました')
      uploadManager.pauseUpload()
    }
  }

  const handleClearCache = () => {
    uploadManager.clearCache()
    setUploadStats(null)
    setFileObjects(new Map())
    setSelectedFiles([])
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  const formatTime = (seconds: number) => {
    if (seconds === 0) return '不明'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours}h ${minutes}m ${secs}s`
  }

  const getProgressPercentage = () => {
    if (!uploadStats) return 0
    return (uploadStats.uploadedBytes / uploadStats.totalBytes) * 100
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-10">
          GoogleDriveアップローダー
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Cloud className="w-6 h-6" />
            共有ドライブを選択
          </h3>
          {isLoadingDrives ? (
            <div className="flex items-center justify-center p-4">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : sharedDrives.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                共有ドライブが見つかりません
              </p>
              <button
                onClick={loadSharedDrives}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                再読み込み
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedDrive}
                onChange={(e) => setSelectedDrive(e.target.value)}
                className="w-full p-3 text-lg rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-blue-900 dark:focus:border-blue-700 bg-white dark:bg-gray-800 transition-all appearance-none"
              >
                <option value="">ドライブを選択してください</option>
                {sharedDrives.map((drive) => (
                  <option key={drive.id} value={drive.id}>
                    {drive.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <div className="w-5 h-5 text-gray-400">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* File Upload Area */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {isDragActive
                ? 'ここにファイルをドロップ'
                : 'ここにファイルをドラッグ＆ドロップ'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              またはクリックしてファイルを選択
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void handleFolderSelection()
                }}
                disabled={isProcessingFolders}
                className={`bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  isProcessingFolders ? 'cursor-not-allowed' : ''
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isProcessingFolders ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>処理中...</span>
                    </div>
                  ) : (
                    <span>フォルダを選択</span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Files or Folders */}
        {selectedFiles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                選択したファイルまたはフォルダ ({selectedFiles.length})
              </h3>
              <button
                onClick={() => {
                  setSelectedFiles([])
                  setFileObjects(new Map())
                }}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                すべて削除
              </button>
            </div>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {(() => {
                const folders = selectedFiles.filter((f) => f.isDirectory)
                const files = selectedFiles.filter((f) => !f.isDirectory)
                return (
                  <p>
                    <span className="font-medium">ファイル:</span>{' '}
                    {files.length} |
                    <span className="font-medium ml-2">フォルダ:</span>{' '}
                    {folders.length}
                  </p>
                )
              })()}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  {file.isDirectory ? (
                    <Folder className="w-5 h-5 text-blue-500" />
                  ) : (
                    <File className="w-5 h-5 text-gray-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {file.isDirectory ? 'Folder' : formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFiles((files) =>
                        files.filter((_, i) => i !== index)
                      )
                      const newFileObjects = new Map(fileObjects)
                      newFileObjects.delete(file.name)
                      setFileObjects(newFileObjects)
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Controls */}
        {selectedFiles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  アップロードコントロール
                </h3>
                {selectedDrive && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    対象ドライブ:{' '}
                    {sharedDrives.find((d) => d.id === selectedDrive)?.name ||
                      '選択したドライブ'}
                  </p>
                )}
              </div>
              <div className="flex space-x-3">
                {uploadManager.isCompleted() ? (
                  <button
                    onClick={handleClearCache}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <Trash className="w-4 h-4" />
                    <span>クリア</span>
                  </button>
                ) : (
                  uploadManager.isUploading() || uploadManager.isPaused() ? (
                    <button
                      onClick={handleToggleUpload}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <Pause className="w-4 h-4" />
                      <span>{uploadManager.isPaused() ? '再開' : '一時停止'}</span>
                    </button> 
                  ) : (
                    <button
                      onClick={handleStartUpload}
                      disabled={!selectedDrive}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>
                        {selectedDrive
                          ? 'アップロード'
                          : 'ドライブを選択してください'}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              アップロード進捗
            </h3>

            {/* Upload Queue Details */}
            <div className="mb-6">
              {uploadStats.currentFile && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">現在アップロード中</h4>
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {uploadStats.currentFile.name}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatBytes(uploadStats.currentFile.totalBytes)}
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              )}
            </div>

            {/* Overall Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  全体の進捗
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {uploadStats.completedFiles} / {uploadStats.totalFiles} ファイル
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span>
                  {formatBytes(uploadStats.uploadedBytes)} /{' '}
                  {formatBytes(uploadStats.totalBytes)}
                </span>
                <span>{getProgressPercentage().toFixed(1)}%</span>
              </div>
            </div>

            {/* Queue Status */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                キュー状況
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {uploadStats.queueProgress.pending}
                  </div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">
                    待機中
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {uploadStats.queueProgress.uploading}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    アップロード中
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {uploadStats.queueProgress.completed}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300">
                    完了
                  </div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {uploadStats.queueProgress.failed}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-300">
                    失敗
                  </div>
                </div>
              </div>
            </div>

            {/* Speed and ETA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <HardDrive className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    アップロード速度
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatSpeed(uploadStats.averageSpeed)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    予想所要時間
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatTime(uploadStats.estimatedTimeRemaining)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Dialog */}
        {showAuthDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                GoogleDrive認証
              </h3>
              <p className="text-gray-600 leading-relaxed dark:text-gray-300">
                下のボタンをクリックしてGoogleDrive認証を行います。
                <br />
                認証ページにリダイレクトされます。
              </p>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleAuth}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  認証する
                </button>
                <button
                  onClick={() => setShowAuthDialog(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
