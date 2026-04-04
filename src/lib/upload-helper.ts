import { adminFetch } from '@/lib/admin-fetch';

export interface UploadResult {
  url: string;
  filename: string;
}

/**
 * Upload a file to the admin upload endpoint.
 * Converts the file to base64 and sends as JSON for VPS compatibility.
 */
export async function uploadFile(file: File, folder = 'general'): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const res = await adminFetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            data: base64,
            folder,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          reject(new Error((err as { error?: string }).error || 'Upload failed'));
          return;
        }
        const result = await res.json() as UploadResult;
        resolve(result);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Upload failed'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
