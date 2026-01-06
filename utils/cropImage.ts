
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
    image.src = url
  })

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/**
 * This function was adapted from the one in the ReadMe of https://github.com/DominicTobias/react-image-crop
 */
export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<string | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const rotRad = getRadianAngle(rotation)

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // draw rotated image
  ctx.drawImage(image, 0, 0)

  // croppedAreaPixels values are bounding box relative
  // extract the cropped image using these values
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // paste generated rotate image at the top left corner
  ctx.putImageData(data, 0, 0)

  // --- TỐI ƯU DUNG LƯỢNG ẢNH ĐỂ TRÁNH LỖI FIREBASE PAYLOAD LIMIT ---
  // Giới hạn kích thước tối đa (ví dụ 960px) để giảm dung lượng base64
  const MAX_SIZE = 960; 
  let outputCanvas = canvas;

  if (canvas.width > MAX_SIZE || canvas.height > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / canvas.width, MAX_SIZE / canvas.height);
      const newWidth = Math.round(canvas.width * ratio);
      const newHeight = Math.round(canvas.height * ratio);
      
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = newWidth;
      resizedCanvas.height = newHeight;
      const resizedCtx = resizedCanvas.getContext('2d');
      
      if (resizedCtx) {
          resizedCtx.imageSmoothingEnabled = true;
          resizedCtx.imageSmoothingQuality = 'high';
          resizedCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
          outputCanvas = resizedCanvas;
      }
  }

  // Giảm chất lượng xuống 0.7 (70%) - Vẫn đủ đẹp cho web mobile nhưng giảm size đáng kể
  return outputCanvas.toDataURL('image/jpeg', 0.7);
}
