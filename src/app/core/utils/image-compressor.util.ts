/**
 * Utility for client-side image compression & optimization before uploading to Firebase Storage.
 * Drastically reduces file storage usage and bandwidth cost while preserving visual clarity.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.80)
  mimeType?: 'image/webp' | 'image/jpeg';
}

export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // Only compress image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Do not compress SVG or animated GIF
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality || 0.80;
  const targetMimeType = options.mimeType || 'image/webp';

  return new Promise<File>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event: any) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate scaled dimensions keeping aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // Fallback to original if canvas context unavailable
        }

        // Draw image onto canvas with smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }

            // If compressed file turns out larger than original (rare), keep original
            if (blob.size >= file.size && file.type === targetMimeType) {
              return resolve(file);
            }

            const extension = targetMimeType === 'image/webp' ? '.webp' : '.jpg';
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + extension;

            const compressedFile = new File([blob], cleanName, {
              type: targetMimeType,
              lastModified: Date.now()
            });

            console.log(
              `[ImageCompressor] Reduced "${file.name}" from ${(file.size / 1024).toFixed(1)} KB to ${(compressedFile.size / 1024).toFixed(1)} KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% savings)`
            );

            resolve(compressedFile);
          },
          targetMimeType,
          quality
        );
      };

      img.onerror = (err) => {
        console.warn('[ImageCompressor] Image load failed, using original file:', err);
        resolve(file);
      };

      img.src = event.target.result;
    };

    reader.onerror = (err) => {
      console.warn('[ImageCompressor] FileReader failed, using original file:', err);
      resolve(file);
    };

    reader.readAsDataURL(file);
  });
}
