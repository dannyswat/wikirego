/**
 * Image Upload Module
 * Handles image file uploads to the server
 */

interface UploadImageResponse {
  url: string
  filename: string
}

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageUploadError'
  }
}

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/webp'
]

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageUploadError(
      'Invalid file type. Please upload jpg, jpeg, png, gif, svg, or webp images.'
    )
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new ImageUploadError(
      `File size too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`
    )
  }
}

/**
 * Upload image file to server
 */
export async function uploadImage(file: File): Promise<UploadImageResponse> {
  validateImageFile(file)

  const formData = new FormData()
  formData.append('upload', file)

  const response = await fetch('/api/editor/upload/image', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }))
    throw new ImageUploadError(error.message || 'Failed to upload image')
  }

  const data = await response.json()
  return { url: data.url, filename: file.name }
}

/**
 * Create file input and handle file selection
 */
export function createImageFileInput(
  onSelect: (file: File) => void,
  onError: (error: Error) => void
): void {
  const input = document.createElement('input')
  input.setAttribute('type', 'file')
  input.setAttribute('accept', ALLOWED_IMAGE_TYPES.join(','))
  
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return

    try {
      validateImageFile(file)
      onSelect(file)
    } catch (error) {
      onError(error as Error)
    }
  }

  input.click()
}
