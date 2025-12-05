// Generic client-side image processing utilities for resizing/compression.
// These functions avoid adding heavy dependencies (sharp, etc.) on the frontend.
// They rely on Canvas APIs and gracefully fall back to the original file if processing fails.

export interface ProcessImageOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number; // 0..1 (for jpeg/webp)
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png';
  rotateDeg?: number; // Optional rotation (clockwise degrees)
  preserveTransparency?: boolean; // If true and source has alpha, prefer png/webp
}

// Load image into HTMLImageElement (fallback) or createImageBitmap when available.
const loadImageElement = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
};

export const processImage = async (file: File, opts: ProcessImageOptions): Promise<File> => {
  try {
    const {
      maxWidth,
      maxHeight,
      quality = 0.85,
      outputType,
      rotateDeg = 0,
      preserveTransparency = false,
    } = opts;

    const img = await loadImageElement(file);
    let srcW = img.naturalWidth || img.width;
    let srcH = img.naturalHeight || img.height;

    // Compute target size (don't upscale)
    const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
    let targetW = Math.round(srcW * scale);
    let targetH = Math.round(srcH * scale);

    const needsRotation = rotateDeg % 360 !== 0;
    const rad = (rotateDeg * Math.PI) / 180;

    // If rotating 90/270 swap canvas dimensions
    const rotateSwap = needsRotation && (rotateDeg % 180 !== 0);
    const canvas = document.createElement('canvas');
    canvas.width = rotateSwap ? targetH : targetW;
    canvas.height = rotateSwap ? targetW : targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file; // Fallback

    if (needsRotation) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    } else {
      ctx.drawImage(img, 0, 0, targetW, targetH);
    }

    // Decide output type
    let finalType: string = outputType || file.type;
    const isSupportedType = ['image/jpeg', 'image/png', 'image/webp'].includes(finalType);
    if (!isSupportedType) {
      // Convert unknown types to jpeg by default (unless preserving transparency)
      finalType = preserveTransparency ? 'image/png' : 'image/jpeg';
    }
    if (preserveTransparency && finalType === 'image/jpeg') {
      finalType = 'image/png';
    }

    const blob: Blob | null = await new Promise(resolve => {
      // PNG ignores quality param; for jpeg/webp it applies
      canvas.toBlob(b => resolve(b), finalType, quality);
    });
    if (!blob) return file;

    // If compression accidentally enlarges file, keep original.
    if (blob.size > file.size) {
      return file;
    }

    const newNameBase = file.name.replace(/\.[^.]+$/, '');
    const extension = finalType === 'image/jpeg' ? 'jpg' : finalType.split('/')[1];
    const processedFile = new File([blob], `${newNameBase}-optimized.${extension}`, { type: finalType, lastModified: Date.now() });
    return processedFile;
  } catch (err) {
    console.warn('Image processing failed, using original file:', err);
    return file;
  }
};

// Adaptive compression: try a quality ladder until below maxBytes (or ladder exhausted)
export const adaptiveCompress = async (file: File, opts: Omit<ProcessImageOptions, 'quality'> & { qualitySteps?: number[]; maxBytes: number; }): Promise<File> => {
  const { qualitySteps = [0.85, 0.75, 0.65, 0.55, 0.45], maxBytes, ...base } = opts;
  for (const q of qualitySteps) {
    const f = await processImage(file, { ...base, quality: q });
    if (f.size <= maxBytes) return f;
  }
  // Return smallest attempt (last iteration) even if still large
  const last = await processImage(file, { ...base, quality: qualitySteps[qualitySteps.length - 1] });
  return last;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

export interface CropRect { x: number; y: number; width: number; height: number; }

// Crop the image based on a rectangle (in pixels relative to intrinsic size), then optionally rotate & compress.
export const cropImage = async (
  file: File,
  crop: CropRect,
  opts: Omit<ProcessImageOptions, 'maxWidth' | 'maxHeight'> & { targetMaxWidth?: number; targetMaxHeight?: number }
): Promise<File> => {
  try {
    const img = await loadImageElement(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Ensure crop within bounds
    const sx = Math.max(0, crop.x);
    const sy = Math.max(0, crop.y);
    const sw = Math.min(crop.width, img.width - sx);
    const sh = Math.min(crop.height, img.height - sy);

    // Optional scale down after crop
    let dw = sw;
    let dh = sh;
    if (opts.targetMaxWidth || opts.targetMaxHeight) {
      const maxW = opts.targetMaxWidth || sw;
      const maxH = opts.targetMaxHeight || sh;
      const scale = Math.min(1, maxW / sw, maxH / sh);
      dw = Math.round(sw * scale);
      dh = Math.round(sh * scale);
    }

    const needsRotation = (opts.rotateDeg || 0) % 360 !== 0;
    const rotateSwap = needsRotation && (opts.rotateDeg || 0) % 180 !== 0;
    canvas.width = rotateSwap ? dh : dw;
    canvas.height = rotateSwap ? dw : dh;

    if (needsRotation) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(((opts.rotateDeg || 0) * Math.PI) / 180);
      ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    }

    let outType = opts.outputType || file.type;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(outType)) outType = 'image/jpeg';
    if (opts.preserveTransparency && outType === 'image/jpeg') outType = 'image/png';
    const quality = opts.quality ?? 0.85;

    const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), outType, quality));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, '');
    const ext = outType === 'image/jpeg' ? 'jpg' : outType.split('/')[1];
    const cropped = new File([blob], `${base}-cropped.${ext}`, { type: outType, lastModified: Date.now() });
    return cropped.size > file.size ? file : cropped; // Keep smaller
  } catch (e) {
    console.warn('cropImage failed, returning original', e);
    return file;
  }
};
