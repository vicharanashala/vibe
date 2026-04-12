// Type definitions for gesture worker messages
export interface GestureWorkerMessage {
  type: 'INIT' | 'PROCESS_FRAME' | 'STOP';
  imageData?: ImageData;
  timestamp?: number;
}

export interface GestureWorkerResponse {
  type: 'INIT_SUCCESS' | 'INIT_ERROR' | 'GESTURE_RESULT' | 'ERROR';
  gesture?: string;
  confidence?: number;
  timestamp?: number;
  error?: string;
}

// Worker instance type for better TypeScript support
export interface GestureWorkerInstance extends Worker {
  postMessage(message: GestureWorkerMessage): void;
}
