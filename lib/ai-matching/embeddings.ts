/**
 * CLIENT-SIDE FACE EMBEDDING GENERATOR
 * ====================================
 * NOTE: This client-side approach replaces an earlier server-side approach
 * (@vladmandic/face-api + node-canvas) that failed due to Windows native module
 * compilation issues (missing prebuilt binaries for node-canvas / Visual Studio build tools).
 *
 * Runs 100% in the browser using WebGL/WASM backends via @vladmandic/face-api.
 * Models are loaded directly from /public/models when needed.
 */

import * as faceapi from '@vladmandic/face-api';

let modelsLoadedPromise: Promise<void> | null = null;

/**
 * Pre-loads face detection, landmark, and recognition model weights from /public/models.
 * Cached so models load only once in the browser session.
 */
export async function loadClientModels(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (!modelsLoadedPromise) {
    modelsLoadedPromise = (async () => {
      const modelUrl = '/models';
      console.log('[Client FaceAPI] Loading model weights from:', modelUrl);
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      ]);
      console.log('[Client FaceAPI] Models loaded successfully.');
    })();
  }

  return modelsLoadedPromise;
}

export interface ClientEmbeddingResult {
  embedding: number[] | null;
  warning: string | null;
}

/**
 * Detects a face in an image File or HTMLImageElement in the browser and returns
 * a 128-dimensional floating point embedding array.
 *
 * @param imageFile File object or image element
 * @returns ClientEmbeddingResult containing 128 floats or null + optional warning
 */
export async function generateClientEmbeddingFromFile(
  imageFile: File
): Promise<ClientEmbeddingResult> {
  try {
    if (typeof window === 'undefined') {
      return { embedding: null, warning: 'Client-side processing unavailable on server.' };
    }

    // 1. Ensure model weights are loaded
    await loadClientModels();

    // 2. Create HTMLImageElement from File
    const imgUrl = URL.createObjectURL(imageFile);
    const img = new Image();
    img.src = imgUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image into browser canvas.'));
    });

    // 3. Perform face detection + landmarks + descriptor extraction
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Clean up object URL memory
    URL.revokeObjectURL(imgUrl);

    if (!detection) {
      return {
        embedding: null,
        warning: "We couldn't detect a face in this photo clearly — you can still submit, but matching may not work for this entry.",
      };
    }

    // 4. Convert Float32Array descriptor (128 values) to standard JS number array
    const embedding = Array.from(detection.descriptor);

    return {
      embedding,
      warning: null,
    };
  } catch (err: any) {
    console.warn('[Client FaceAPI] Error during face detection:', err);
    return {
      embedding: null,
      warning: "We couldn't detect a face in this photo clearly — you can still submit, but matching may not work for this entry.",
    };
  }
}
