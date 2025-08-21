import { type GoogleDriveClientService } from './google-drive-client'
import { StorageManager } from './storage'
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
  private currentSession: UploadSession | null = null
  private isUploading = false
  private onProgress?: (stats: UploadStats) => void
  private onSessionUpdate?: (session: UploadSession) => void
  private fileObjects: Map<string, File> = new Map()

  constructor(driveService: GoogleDriveClientService) {
    this.driveService = driveService
    this.loadFromCache()
  }

  /* Get current session */
  getCurrentSession(): UploadSession | null {
    return this.currentSession
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
    parentFolderId?: string
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
      lastUpdated: Date.now(),
      sharedDriveId,
      parentFolderId,
    }

    this.currentSession = session
    this.queue = this.buildQueue(files, sharedDriveId)

    // Store file objects for later use
    this.fileObjects = fileObjects

    this.saveToCache()

    if (this.onSessionUpdate) {
      this.onSessionUpdate(session)
    }

    return Promise.resolve(sessionId)
  }

  /* Start upload process */
  async startUpload(): Promise<void> {
    if (this.isUploading || !this.currentSession) {
      return
    }

    this.isUploading = true
    this.currentSession.status = 'uploading'

    try {
      await this.processQueue()
    } catch (error) {
      console.error('Upload error:', error)
      if (this.currentSession) {
        this.currentSession.status = 'failed'
      }
    } finally {
      this.isUploading = false
    }
  }

  /* Pause upload */
  pauseUpload(): void {
    this.isUploading = false
    if (this.currentSession) {
      this.currentSession.status = 'paused'
      this.saveToCache()
    }
  }

  /* Resume upload */
  resumeUpload(): Promise<void> {
    return this.startUpload()
  }

  /* Check if upload is paused */
  isPaused(): boolean {
    return this.currentSession?.status === 'paused'
  }

  /* Get current upload status */
  getUploadStatus(): {
    isUploading: boolean;
    currentFile?: UploadQueueItem;
    queueProgress: {
      pending: number;
      uploading: number;
      completed: number;
      failed: number;
    };
  } {
    const currentFile = this.queue.find((item) => item.status === 'uploading')
    const queueProgress = {
      pending: this.queue.filter((item) => item.status === 'pending').length,
      uploading: this.queue.filter((item) => item.status === 'uploading')
        .length,
      completed: this.queue.filter((item) => item.status === 'completed')
        .length,
      failed: this.queue.filter((item) => item.status === 'failed').length,
    }

    return {
      isUploading: this.isUploading,
      currentFile,
      queueProgress,
    }
  }

  /* Clear cache */
  clearCache(): void {
    StorageManager.clearUploadData()
    this.currentSession = null
    this.queue = []
  }

  /* Count total files recursively */
  private countTotalFiles(files: FileInfo[]): number {
    let count = 0
    for (const file of files) {
      if (file.isDirectory && file.children) {
        count += this.countTotalFiles(file.children)
      } else {
        count++
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
            progress: 0,
            uploadedBytes: 0,
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
            progress: 0,
            uploadedBytes: 0,
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
      if (!this.isUploading) break

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
        item.progress = 100
      } else {
        // Upload file
        const file = this.getFileFromName(item.file.name)
        if (!file) {
          throw new Error(`File not found: ${item.file.name}`)
        }

        await this.uploadFileWithProgress(file, item)
        item.status = 'completed'
        item.progress = 100
      }

      item.endTime = Date.now()
      this.currentSession.completedFiles++
      this.currentSession.uploadedBytes += item.totalBytes

      this.updateProgress()
      this.saveToCache()
    } catch (error) {
      console.error(`Error uploading ${item.file.name}:`, error)
      item.status = 'failed'
      item.error = error instanceof Error ? error.message : 'Unknown error'
    }
  }

  /* Upload file with progress tracking */
  private async uploadFileWithProgress(
    file: File,
    item: UploadQueueItem
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let lastUpdateTime = 0
      const updateInterval = 100 // Update every 100ms for smoother progress

      const onProgress = (progress: number) => {
        const now = Date.now()
        item.progress = progress
        item.uploadedBytes = (progress / 100) * item.totalBytes

        // Update progress more frequently for real-time feel
        if (now - lastUpdateTime >= updateInterval) {
          this.updateProgress()
          lastUpdateTime = now
        }
      }

      const uploadPromise =
        file.size > 5 * 1024 * 1024 // 5MB
          ? this.driveService.uploadLargeFile(
              file,
              item.parentId,
              this.currentSession?.sharedDriveId,
              onProgress
            )
          : this.driveService.uploadFile(
              file,
              item.parentId,
              this.currentSession?.sharedDriveId,
              onProgress
            )

      uploadPromise.then(resolve).catch(reject)
    })
  }

  /* Get file from path using stored file objects */
  private getFileFromName(name: string): File | null {
    return this.fileObjects.get(name) || null
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

  /* Update progress and trigger callback */
  private updateProgress(): void {
    if (!this.currentSession || !this.onProgress) return

    // Get current uploading file
    const currentUploadingItem = this.queue.find(
      (item) => item.status === 'uploading'
    )

    // Calculate queue progress
    const queueProgress = {
      pending: this.queue.filter((item) => item.status === 'pending').length,
      uploading: this.queue.filter((item) => item.status === 'uploading')
        .length,
      completed: this.queue.filter((item) => item.status === 'completed')
        .length,
      failed: this.queue.filter((item) => item.status === 'failed').length,
    }

    const stats: UploadStats = {
      totalFiles: this.currentSession.totalFiles,
      completedFiles: this.currentSession.completedFiles,
      failedFiles: this.queue.filter((item) => item.status === 'failed').length,
      totalBytes: this.currentSession.totalBytes,
      uploadedBytes: this.currentSession.uploadedBytes,
      averageSpeed: this.calculateAverageSpeed(),
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(),
      currentFile: currentUploadingItem
        ? {
            name: currentUploadingItem.file.name,
            progress: currentUploadingItem.progress,
            uploadedBytes: currentUploadingItem.uploadedBytes,
            totalBytes: currentUploadingItem.totalBytes,
            speed: this.calculateCurrentFileSpeed(currentUploadingItem),
            estimatedTimeRemaining:
              this.calculateCurrentFileETA(currentUploadingItem),
          }
        : undefined,
      queueProgress,
    }

    this.onProgress(stats)
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
      (sum, item) => sum + item.uploadedBytes,
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

  /* Calculate current file upload speed */
  private calculateCurrentFileSpeed(item: UploadQueueItem): number {
    if (!item.startTime || item.progress === 0) return 0

    const elapsedTime = (Date.now() - item.startTime) / 1000 // seconds
    if (elapsedTime === 0) return 0

    return item.uploadedBytes / elapsedTime // bytes per second
  }

  /* Calculate current file ETA */
  private calculateCurrentFileETA(item: UploadQueueItem): number {
    const speed = this.calculateCurrentFileSpeed(item)
    if (speed === 0) return 0

    const remainingBytes = item.totalBytes - item.uploadedBytes
    return remainingBytes / speed // seconds
  }
  

  /* Save to cache */
  private saveToCache(): void {
    if (!this.currentSession) return

    try {
      StorageManager.setUploadSession(this.currentSession)
      StorageManager.setUploadQueue(this.queue)
    } catch (error) {
      console.error('Error saving to cache:', error)
    }
  }

  /* Load from cache */
  private loadFromCache(): void {
    try {
      const session = StorageManager.getUploadSession()
      const queue = StorageManager.getUploadQueue()

      if (session) {
        this.currentSession = session
        this.queue = queue
      }
    } catch (error) {
      console.error('Error loading cache: ', error)
    }
  }
}
