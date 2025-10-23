/**
 * Image Upload Utility
 * Handles image file validation, compression, and base64 conversion
 */

export interface ImageUploadResult {
  success: boolean;
  data?: string; // base64 encoded image
  error?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

export interface ImageUploadOptions {
  maxSizeInMB?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 for JPEG/WebP
  acceptedFormats?: string[]; // e.g., ['image/jpeg', 'image/png', 'image/webp']
}

const DEFAULT_OPTIONS: Required<ImageUploadOptions> = {
  maxSizeInMB: 10,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.9,
  acceptedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
};

/**
 * Validates and processes an image file
 */
export async function processImageUpload(
  file: File,
  options: ImageUploadOptions = {}
): Promise<ImageUploadResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate file type
  if (!opts.acceptedFormats.includes(file.type)) {
    return {
      success: false,
      error: `Invalid file type. Accepted formats: ${opts.acceptedFormats.join(', ')}`,
    };
  }

  // Validate file size
  const fileSizeInMB = file.size / (1024 * 1024);
  if (fileSizeInMB > opts.maxSizeInMB) {
    return {
      success: false,
      error: `File size (${fileSizeInMB.toFixed(2)}MB) exceeds maximum allowed size (${opts.maxSizeInMB}MB)`,
    };
  }

  try {
    // Load and potentially resize the image
    const processedImage = await loadAndResizeImage(file, opts);
    
    return {
      success: true,
      data: processedImage.base64,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        dimensions: processedImage.dimensions,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Loads an image and resizes it if necessary
 */
function loadAndResizeImage(
  file: File,
  options: Required<ImageUploadOptions>
): Promise<{ base64: string; dimensions: { width: number; height: number } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions if resizing is needed
        if (width > options.maxWidth || height > options.maxHeight) {
          const ratio = Math.min(options.maxWidth / width, options.maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64
        const base64 = canvas.toDataURL(file.type, options.quality);
        
        resolve({
          base64,
          dimensions: { width, height },
        });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a base64 string to a Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeType });
}

/**
 * Gets image dimensions from a File
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}
