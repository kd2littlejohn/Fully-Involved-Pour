import { downscaleImageToJpegBase64 } from '../ai/imageToBase64'
import { removeBottleBackground } from '../../data/repositories/ai'
import type { ImageProcessingStatus } from '../../data/types'

export interface StandardizedBottlePhoto {
  // The standardized 4:5 FIP display image — always a real, fully-opaque
  // JPEG (never throws, never blocks bottle creation).
  displayFile: File
  // The user's original file, completely untouched by this module.
  originalFile: File
  status: ImageProcessingStatus
}

// Output canvas — a fixed 4:5 portrait so every bottle card gets the exact
// same proportions regardless of the source photo's shape. 960x1200 is
// generous enough for a crisp card image on a retina phone without being
// wasteful to store/download.
export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 1200
// Breathing room around the bottle — leaves the neck clear of the top edge
// and the base clear of the bottom edge at any bottle proportions.
const MARGIN_RATIO = 0.12
// A cutout whose surviving content covers less than this fraction of the
// source frame is treated as "nothing usable came back" (e.g. the model
// wiped the whole photo) rather than a real bottle silhouette.
const MIN_CONTENT_AREA_RATIO = 0.01
const ALPHA_THRESHOLD = 12

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      loadImageFromDataUrl(reader.result as string).then(resolve, reject)
    }
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

// Pure pixel-scanning core of trimTransparentPadding below, split out so the
// actual bounding-box algorithm can be unit tested directly against a
// Uint8ClampedArray without needing a working <canvas> in the test
// environment. Finds the bounding box of every non-transparent pixel —
// @imgly/background-removal-node returns a full-frame PNG with the bottle's
// real pixels surrounded by transparency, not a tightly cropped bottle, so
// this is what actually lets the bottle be centered and scaled correctly.
// Returns null when there's essentially nothing there (background removal
// failed or wiped the photo), which is the signal to fall back to
// compositing the plain original instead.
export function findBoundingBox(data: Uint8ClampedArray, width: number, height: number): BoundingBox | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) return null
  const box = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  const contentArea = (box.width * box.height) / (width * height)
  if (contentArea < MIN_CONTENT_AREA_RATIO) return null
  return box
}

function trimTransparentPadding(image: HTMLImageElement): BoundingBox | null {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return findBoundingBox(data, width, height)
}

export interface FitRect {
  dx: number
  dy: number
  drawWidth: number
  drawHeight: number
}

// Pure scale/center math, split out from compositeOntoFipCanvas below for
// the same testability reason as findBoundingBox — given a source region of
// any shape (tall bottle, wide/landscape source photo, etc.) and the fixed
// output canvas size, computes where to draw it so the whole thing fits,
// centered, with even breathing room on every side. Never upscales past the
// margin box, so nothing is ever cropped regardless of the source's aspect
// ratio.
export function computeFitRect(sourceBox: { width: number; height: number }, canvasWidth: number, canvasHeight: number): FitRect {
  const maxDrawWidth = canvasWidth * (1 - 2 * MARGIN_RATIO)
  const maxDrawHeight = canvasHeight * (1 - 2 * MARGIN_RATIO)
  const scale = Math.min(maxDrawWidth / sourceBox.width, maxDrawHeight / sourceBox.height)
  const drawWidth = sourceBox.width * scale
  const drawHeight = sourceBox.height * scale
  return {
    dx: (canvasWidth - drawWidth) / 2,
    dy: (canvasHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  }
}

// Draws the given region of `source` centered and scaled (never cropped)
// onto a fixed 4:5 canvas with the FIP dark-oak backdrop and a soft warm
// amber vignette — real, deterministic image compositing, not an
// AI-generated scene, so the real bottle, label, and proportions are always
// exactly what the camera captured.
function compositeOntoFipCanvas(source: CanvasImageSource, sourceBox: BoundingBox): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  const gradient = ctx.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT * 0.4,
    CANVAS_HEIGHT * 0.08,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT * 0.45,
    CANVAS_HEIGHT * 0.75,
  )
  gradient.addColorStop(0, '#2e1e10')
  gradient.addColorStop(0.55, '#1b140f')
  gradient.addColorStop(1, '#0a0705')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  const { dx, dy, drawWidth, drawHeight } = computeFitRect(sourceBox, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.drawImage(source, sourceBox.x, sourceBox.y, sourceBox.width, sourceBox.height, dx, dy, drawWidth, drawHeight)
  return canvas
}

function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export the standardized image.'))
          return
        }
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  })
}

function displayFileName(originalName: string): string {
  const base = originalName.replace(/\.\w+$/, '') || 'bottle'
  return `${base}-fip.jpg`
}

// The whole standardization pipeline for one bottle photo. Never throws and
// never blocks bottle creation: background removal failing, the model
// wiping the photo, or even canvas support being unavailable all fall
// through to a still-usable result — worst case the plain original file is
// returned untouched as the display image too.
export async function standardizeBottlePhoto(file: File): Promise<StandardizedBottlePhoto> {
  try {
    const base64 = await downscaleImageToJpegBase64(file, 1024)

    try {
      const cutoutBase64 = await removeBottleBackground(base64)
      const cutoutImage = await loadImageFromDataUrl(`data:image/png;base64,${cutoutBase64}`)
      const box = trimTransparentPadding(cutoutImage)
      if (!box) throw new Error('No bottle content survived background removal.')
      const canvas = compositeOntoFipCanvas(cutoutImage, box)
      const displayFile = await canvasToJpegFile(canvas, displayFileName(file.name))
      return { displayFile, originalFile: file, status: 'ready' }
    } catch (err) {
      console.error('Bottle photo standardization fell back to the plain original', err)
      const originalImage = await loadImageFromFile(file)
      const canvas = compositeOntoFipCanvas(originalImage, {
        x: 0,
        y: 0,
        width: originalImage.naturalWidth,
        height: originalImage.naturalHeight,
      })
      const displayFile = await canvasToJpegFile(canvas, displayFileName(file.name))
      return { displayFile, originalFile: file, status: 'failed' }
    }
  } catch (err) {
    console.error('Bottle photo standardization failed entirely; using the original photo as-is', err)
    return { displayFile: file, originalFile: file, status: 'failed' }
  }
}
