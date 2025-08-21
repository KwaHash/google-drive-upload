export interface TokenData {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export interface GoogleSharedDrive {
  id: string;
  name: string;
  capabilities: {
    canAddChildren: boolean;
    canDelete: boolean;
    canDownload: boolean;
    canEdit: boolean;
    canListChildren: boolean;
    canManageMembers: boolean;
    canReadRevisions: boolean;
    canRename: boolean;
    canShare: boolean;
  };
}

// Upload Management Types
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  isDirectory: boolean;
  children?: FileInfo[];
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  error?: string;
  uploadedBytes: number;
  totalBytes: number;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface UploadSession {
  id: string;
  files: UploadProgress[];
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  status: 'idle' | 'uploading' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  lastUpdated: number;
  sharedDriveId?: string;
  parentFolderId?: string;
}

export interface UploadQueueItem {
  id: string;
  file: FileInfo;
  parentId?: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  progress: number;
  error?: string;
  uploadedBytes: number;
  totalBytes: number;
  startTime?: number;
  endTime?: number;
}

export interface UploadStats {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  averageSpeed: number;
  estimatedTimeRemaining: number;
  currentFile?: {
    name: string;
    progress: number;
    uploadedBytes: number;
    totalBytes: number;
    speed: number;
    estimatedTimeRemaining: number;
  };
  queueProgress: {
    pending: number;
    uploading: number;
    completed: number;
    failed: number;
  };
}
