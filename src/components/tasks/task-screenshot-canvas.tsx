'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Download,
  Eraser,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react'

interface TaskScreenshotCanvasProps {
  taskId: string
  canEdit: boolean
}

type Point = { x: number; y: number }

const MAX_CANVAS_WIDTH = 1400
const MAX_CANVAS_HEIGHT = 1000

function fitDimensions(width: number, height: number): { width: number; height: number } {
  const widthRatio = MAX_CANVAS_WIDTH / width
  const heightRatio = MAX_CANVAS_HEIGHT / height
  const ratio = Math.min(widthRatio, heightRatio, 1)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

export function TaskScreenshotCanvas({ taskId, canEdit }: TaskScreenshotCanvasProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const baseImageRef = useRef<HTMLImageElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<Point | null>(null)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)

  const [lineColor, setLineColor] = useState('#ef4444')
  const [lineWidth, setLineWidth] = useState(4)
  const [sourceFileName, setSourceFileName] = useState<string>('')
  const [description, setDescription] = useState<string>('Annotated screenshot')
  const [isUploading, setIsUploading] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [, setHistoryTick] = useState(0)

  function getCanvasContext(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    return ctx
  }

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function pushHistorySnapshot() {
    const canvas = canvasRef.current
    if (!canvas) return

    const snapshot = canvas.toDataURL('image/png')
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push(snapshot)
    historyRef.current = nextHistory
    historyIndexRef.current = nextHistory.length - 1
    setHistoryTick((tick) => tick + 1)
  }

  function restoreSnapshotAtIndex(index: number) {
    if (index < 0 || index >= historyRef.current.length) return
    const canvas = canvasRef.current
    const ctx = getCanvasContext()
    if (!canvas || !ctx) return

    const snapshotUrl = historyRef.current[index]
    const snapshotImage = new Image()
    snapshotImage.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(snapshotImage, 0, 0, canvas.width, canvas.height)
      historyIndexRef.current = index
      setHistoryTick((tick) => tick + 1)
    }
    snapshotImage.src = snapshotUrl
  }

  async function handleLoadScreenshot(file: File) {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      const canvas = canvasRef.current
      const ctx = getCanvasContext()
      if (!canvas || !ctx) {
        URL.revokeObjectURL(objectUrl)
        return
      }

      const dims = fitDimensions(image.width, image.height)
      canvas.width = dims.width
      canvas.height = dims.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

      baseImageRef.current = image
      setHasImage(true)
      setSourceFileName(file.name)

      historyRef.current = []
      historyIndexRef.current = -1
      pushHistorySnapshot()

      URL.revokeObjectURL(objectUrl)
      toast({
        title: 'Screenshot loaded',
        description: 'Draw on the canvas to annotate this image.',
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      toast({
        title: 'Failed to load image',
        description: 'Please upload a valid screenshot file.',
        variant: 'destructive',
      })
    }

    image.src = objectUrl
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    const point = getCanvasPoint(event)
    if (!point) return

    drawingRef.current = true
    lastPointRef.current = point
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const point = getCanvasPoint(event)
    const previous = lastPointRef.current
    const ctx = getCanvasContext()
    if (!point || !previous || !ctx) return

    ctx.strokeStyle = lineColor
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(previous.x, previous.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    pushHistorySnapshot()
  }

  function handleUndo() {
    if (historyIndexRef.current <= 0) return
    restoreSnapshotAtIndex(historyIndexRef.current - 1)
  }

  function handleResetToOriginal() {
    const base = baseImageRef.current
    const canvas = canvasRef.current
    const ctx = getCanvasContext()
    if (!base || !canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height)
    pushHistorySnapshot()
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    const safeBaseName = sourceFileName
      ? sourceFileName.replace(/\.[^/.]+$/, '')
      : `task-${taskId}-screenshot`
    link.download = `${safeBaseName}-annotated.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function handleUploadAnnotatedScreenshot() {
    if (!canEdit) {
      toast({
        title: 'Upload not allowed',
        description: 'You do not have permission to upload files to this task.',
        variant: 'destructive',
      })
      return
    }

    const canvas = canvasRef.current
    if (!canvas || !hasImage) return

    setIsUploading(true)
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), 'image/png')
      })

      if (!blob) {
        throw new Error('Failed to generate image data from the canvas')
      }

      const timestamp = Date.now()
      const fileName = sourceFileName
        ? `${sourceFileName.replace(/\.[^/.]+$/, '')}-annotated-${timestamp}.png`
        : `annotated-screenshot-${timestamp}.png`
      const storagePath = `tasks/${taskId}/screenshots/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(storagePath, blob, {
          cacheControl: '3600',
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      const metadataResponse = await fetch(`/api/tasks/${taskId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: fileName,
          file_size: blob.size,
          mime_type: 'image/png',
          storage_path: storagePath,
          description: description.trim() || 'Annotated screenshot',
        }),
      })

      if (!metadataResponse.ok) {
        await supabase.storage.from('task-files').remove([storagePath])
        throw new Error('Failed to save file metadata')
      }

      toast({
        title: 'Screenshot saved',
        description: 'Your annotated screenshot has been added to task files.',
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Could not save the annotated screenshot. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screenshot Canvas</CardTitle>
        <CardDescription>
          Upload a screenshot, annotate it directly in the browser, then save it to this task.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void handleLoadScreenshot(file)
            }
            event.currentTarget.value = ''
          }}
        />

        <div className="flex flex-wrap items-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <ImagePlus className="h-4 w-4" />
            Upload Screenshot
          </Button>

          <div className="space-y-1">
            <Label htmlFor="line-color">Color</Label>
            <Input
              id="line-color"
              type="color"
              value={lineColor}
              onChange={(e) => setLineColor(e.target.value)}
              className="h-10 w-16 p-1"
              disabled={!hasImage}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="line-width">Brush</Label>
            <Input
              id="line-width"
              type="number"
              min={1}
              max={40}
              value={lineWidth}
              onChange={(e) => setLineWidth(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              className="h-10 w-24"
              disabled={!hasImage}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleUndo}
            disabled={!hasImage || historyIndexRef.current <= 0}
            className="gap-2"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleResetToOriginal}
            disabled={!hasImage}
            className="gap-2"
          >
            <Eraser className="h-4 w-4" />
            Reset
          </Button>

          <Button type="button" variant="outline" onClick={handleDownload} disabled={!hasImage} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        <div className="rounded-lg border bg-slate-50 p-2">
          <canvas
            ref={canvasRef}
            className="w-full touch-none rounded border border-slate-200 bg-white"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={stopDrawing}
          />
          {!hasImage && (
            <div className="flex h-52 items-center justify-center text-center text-sm text-slate-500">
              Upload a screenshot to start annotating.
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="annotation-description">File description</Label>
          <Input
            id="annotation-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Annotated screenshot"
            disabled={!hasImage}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleUploadAnnotatedScreenshot}
            disabled={!hasImage || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save to Task Files
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
