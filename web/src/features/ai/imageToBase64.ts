// Downscales an image file to a JPEG data URL and returns just the base64
// payload, matching the shape the Cloud Functions (scanBottleLabel,
// removeBottleBackground) expect.
export async function downscaleImageToJpegBase64(file: File, maxDim = 1024): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })

  const scale = Math.min(1, maxDim / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return jpegDataUrl.split(',')[1] ?? ''
}

// Resizes an image file to a JPEG File (not just a base64 string), for
// compressing large camera photos before they go to Storage. Preserves
// aspect ratio; images already smaller than maxDim pass through
// untouched. Not used on images that need to keep transparency (the
// background-cutout PNG) — those are already downscaled by the AI step.
export async function resizeImageFile(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })

  if (Math.max(image.width, image.height) <= maxDim) return file

  const scale = maxDim / Math.max(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
}
