import { type GoogleDriveClientService } from './google-drive-client'
import {
  type FileInfo,
  type UploadSession,
  type UploadQueueItem,
  type UploadStats,
} from './types'
import { generateId } from './utils'

export class UploadManager {
  private driveService: GoogleDriveClientService
  private queue: UploadQueueItem[] = []
  private fileObjects: Map<string, File> = new Map()
  private currentSession: UploadSession | null = null
  private onProgress?: (stats: UploadStats) => void

  constructor(driveService: GoogleDriveClientService) {
    this.driveService = driveService
  }

  /* Get upload queue */
  getQueue(): UploadQueueItem[] {
    return this.queue
  }

  /* Set progress callback */
  setProgressCallback(callback: (stats: UploadStats) => void): void {
    this.onProgress = callback
  }

  /* Add files with actual File objects */
  async addFilesWithObjects(
    files: FileInfo[],
    fileObjects: Map<string, File>,
    sharedDriveId?: string,
  ): Promise<string> {
    const sessionId = generateId()
    const session: UploadSession = {
      id: sessionId,
      files: [],
      totalFiles: this.countTotalFiles(files),
      completedFiles: 0,
      totalBytes: this.calculateTotalBytes(files),
      uploadedBytes: 0,
      status: 'idle',
      createdAt: Date.now(),
      sharedDriveId,
    }

    this.currentSession = session
    this.fileObjects = fileObjects
    this.queue = this.buildQueue(files, sharedDriveId)

    return Promise.resolve(sessionId)
  }

  /* Start upload process */
  async startUpload(): Promise<void> {
    if (!this.currentSession) return

    this.currentSession.status = 'uploading'

    try {
      await this.processQueue()
    } catch (error) {
      if (this.currentSession) {
        this.currentSession.status = 'failed'
      }
    }
  }

  /* Pause upload */
  pauseUpload(): void {
    if (this.currentSession) {
      this.currentSession.status = 'paused'
    }
  }

  async resumeUpload(): Promise<void> {
    if (this.currentSession) {
     await this.startUpload() 
    }
  }

  isPaused(): boolean {
    return this.currentSession?.status === 'paused'
  }

  isUploading(): boolean {
    return this.currentSession?.status === 'uploading'
  }

  isCompleted(): boolean {
    return this.currentSession?.status === 'completed'
  }

  /* Count total files recursively */
  private countTotalFiles(files: FileInfo[]): number {
    let count = 0
    for (const file of files) {
      if (file.isDirectory && file.children) {
        count += this.countTotalFiles(file.children) + 1
      } else {
        count += 1
      }
    }
    return count
  }

  /* Calculate total bytes recursively */
  private calculateTotalBytes(files: FileInfo[]): number {
    let total = 0
    for (const file of files) {
      if (file.isDirectory && file.children) {
        total += this.calculateTotalBytes(file.children)
      } else {
        total += file.size
      }
    }
    return total
  }

  /* Build upload queue from files */
  private buildQueue(files: FileInfo[], parentId?: string): UploadQueueItem[] {
    const queue: UploadQueueItem[] = []
    const processFiles = (fileList: FileInfo[], currentParentId?: string) => {
      for (const file of fileList) {
        if (file.isDirectory) {
          // Create folder first
          const folderItem: UploadQueueItem = {
            id: generateId(),
            file,
            parentId: currentParentId,
            status: 'pending',
            totalBytes: 0,
          }
          queue.push(folderItem)

          // Process children with the folder's queue ID as parent (will be updated later)
          if (file.children) {
            processFiles(file.children, folderItem.id)
          }
        } else {
          const fileItem: UploadQueueItem = {
            id: generateId(),
            file,
            parentId: currentParentId,
            status: 'pending',
            totalBytes: file.size,
          }
          queue.push(fileItem)
        }
      }
    }

    processFiles(files, parentId)
    return queue
  }

  /* Process upload queue */
  private async processQueue(): Promise<void> {
    if (!this.currentSession) return

    for (const item of this.queue) {
      if (this.currentSession.status !== 'uploading' && this.currentSession.status !== 'resumed') break
      if (item.status === 'completed') continue

      if (item.status === 'pending' || item.status === 'failed') {
        await this.uploadItem(item)
      }
    }

    if (this.currentSession.completedFiles === this.currentSession.totalFiles) {
      this.currentSession.status = 'completed'
    }
  }

  /* Upload individual item */
  private async uploadItem(item: UploadQueueItem): Promise<void> {
    if (!this.currentSession) return

    item.status = 'uploading'
    item.startTime = Date.now()
    this.updateProgress()

    try {
      if (item.file.isDirectory) {
        // Create folder
        const folderId = await this.driveService.createFolder(
          item.file.name,
          item.parentId,
          this.currentSession.sharedDriveId
        )

        // Update parent ID for all children that reference this folder's queue ID
        this.updateChildrenParentId(item.id, folderId)
        item.status = 'completed'
      } else {
        // Upload file
        const file = this.fileObjects.get(item.file.name) || null
        if (!file) {
          throw new Error(`File not found: ${item.file.name}`)
        }

        await this.uploadFileWithProgress(file, item)
        item.status = 'completed'
      }

      item.endTime = Date.now()
      this.currentSession.completedFiles++
      this.currentSession.uploadedBytes += item.totalBytes

      this.updateProgress()
    } catch (error) {
      item.status = 'failed'
      item.error = error instanceof Error ? error.message : '不明なエラーが発生しました'
    }
  }

  /* Update progress and trigger callback */
  private updateProgress(): void {
    if (!this.currentSession || !this.onProgress) return

    // Calculate queue progress
    const queueProgress = {
      pending: this.queue.filter((item) => item.status === 'pending').length,
      uploading: this.queue.filter((item) => item.status === 'uploading').length,
      completed: this.queue.filter((item) => item.status === 'completed').length,
      failed: this.queue.filter((item) => item.status === 'failed').length,
    }

    const currentFile = this.queue.find((item) => item.status === 'uploading')

    const stats: UploadStats = {
      totalFiles: this.currentSession.totalFiles,
      completedFiles: this.currentSession.completedFiles,
      totalBytes: this.currentSession.totalBytes,
      uploadedBytes: this.currentSession.uploadedBytes,
      averageSpeed: this.calculateAverageSpeed(),
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(),
      currentFile: currentFile ? {
        name: currentFile.file.name,
        totalBytes: currentFile.totalBytes,
      } : undefined,
      queueProgress,
    }

    this.onProgress(stats)
  }

  /* Upload file with progress tracking */
  private async uploadFileWithProgress(
    file: File,
    item: UploadQueueItem
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadPromise =
        file.size > 5 * 1024 * 1024 // 5MB
          ? this.driveService.uploadLargeFile(
              file,
              item.parentId,
              this.currentSession?.sharedDriveId,
            )
          : this.driveService.uploadFile(
              file,
              item.parentId,
              this.currentSession?.sharedDriveId,
            )

      uploadPromise.then(resolve).catch(reject)
    })
  }

  /* Update children parent ID */
  private updateChildrenParentId(
    parentItemId: string,
    newParentId: string
  ): void {
    // Find all items that have the specified parent ID and update them
    for (const item of this.queue) {
      if (item.parentId === parentItemId) {
        item.parentId = newParentId
      }
    }
  }


  /* Calculate average upload speed */
  private calculateAverageSpeed(): number {
    const completedItems = this.queue.filter(
      (item) => item.status === 'completed' && item.startTime && item.endTime
    )

    if (completedItems.length === 0) return 0

    const totalTime = completedItems.reduce((sum, item) => {
      return sum + (item.endTime! - item.startTime!)
    }, 0)

    const totalBytes = completedItems.reduce(
      (sum, item) => sum + item.totalBytes,
      0
    )

    return totalTime > 0 ? (totalBytes / totalTime) * 1000 : 0 // bytes per second
  }

  /* Calculate estimated time remaining */
  private calculateEstimatedTimeRemaining(): number {
    const averageSpeed = this.calculateAverageSpeed()
    if (averageSpeed === 0) return 0

    const remainingBytes =
      this.currentSession!.totalBytes - this.currentSession!.uploadedBytes
    return remainingBytes / averageSpeed // seconds
  }

  /* Clear cache */
  clearCache(): void {
    this.currentSession = null
    this.queue = []
  }
}
