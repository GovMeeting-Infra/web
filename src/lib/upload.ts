import { apiFetch, ApiError } from './api/client';

interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export class UploadNotConfiguredError extends Error {
  constructor() {
    super(
      'Image upload isn’t configured on the server yet — paste an image URL instead.',
    );
    this.name = 'UploadNotConfiguredError';
  }
}

/**
 * Uploads straight to Cloudinary using a signature minted by our API, so the
 * image bytes never pass through the backend and no API secret reaches the
 * browser. Returns the hosted URL to store on the event.
 */
export async function uploadImage(file: File, folder?: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Only PNG, JPG and WebP images are allowed.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be smaller than 5MB.');
  }

  let signature: UploadSignature;
  try {
    signature = await apiFetch<UploadSignature>(
      `/api/v1/uploads/signature${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`,
    );
  } catch (err) {
    // 503 means the server has no Cloudinary credentials set.
    if (err instanceof ApiError && err.status === 503) {
      throw new UploadNotConfiguredError();
    }
    throw err;
  }

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('folder', signature.folder);
  form.append('signature', signature.signature);

  const response = await fetch(signature.uploadUrl, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    let detail = `Upload failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body?.error?.message ?? detail;
    } catch {
      // non-JSON error body
    }
    throw new Error(detail);
  }

  const body = await response.json();
  if (!body.secure_url) {
    throw new Error('Upload succeeded but no image URL was returned.');
  }

  return body.secure_url as string;
}
