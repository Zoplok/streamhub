// Client-side scene compositor used by the Browser Studio.
//
// Takes a camera MediaStream + optional screen MediaStream, composites them
// on a <canvas> each frame (screen as background, camera as PiP overlay),
// mixes audio (mic + optional system audio) through a WebAudio graph, and
// exposes a single MediaStream via `captureStream()` that MediaRecorder
// consumes.
//
// Framework-free so it can be reused by any client component.

export type SceneMode = 'camera' | 'screen' | 'pip'
export type PipPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
export type PipShape = 'rect' | 'circle'
export type PipSize = 'sm' | 'md' | 'lg'

export interface Resolution {
  width: number
  height: number
  fps: number
  label: string
}

export const RESOLUTIONS: Record<string, Resolution> = {
  '720p': { width: 1280, height: 720, fps: 30, label: '720p30' },
  '1080p': { width: 1920, height: 1080, fps: 30, label: '1080p30' },
  '720p60': { width: 1280, height: 720, fps: 60, label: '720p60' }
}

export interface CompositorOptions {
  mode: SceneMode
  resolution: Resolution
  pipPosition: PipPosition
  pipShape: PipShape
  pipSize: PipSize
}

function pipSizeFraction(size: PipSize): number {
  return size === 'sm' ? 0.18 : size === 'md' ? 0.25 : 0.33
}

export class SceneCompositor {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private cameraVideo: HTMLVideoElement | null = null
  private screenVideo: HTMLVideoElement | null = null

  private cameraStream: MediaStream | null = null
  private screenStream: MediaStream | null = null

  private audioCtx: AudioContext | null = null
  private audioDest: MediaStreamAudioDestinationNode | null = null
  private micNode: MediaStreamAudioSourceNode | null = null
  private systemNode: MediaStreamAudioSourceNode | null = null

  private rafId: number | null = null
  private lastFrameAt = 0
  private options: CompositorOptions

  constructor(options: CompositorOptions) {
    this.options = options
    this.canvas = document.createElement('canvas')
    this.canvas.width = options.resolution.width
    this.canvas.height = options.resolution.height
    const ctx = this.canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('canvas 2d not supported')
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
  }

  updateOptions(patch: Partial<CompositorOptions>) {
    this.options = { ...this.options, ...patch }
    if (patch.resolution) {
      this.canvas.width = patch.resolution.width
      this.canvas.height = patch.resolution.height
    }
  }

  getOptions(): CompositorOptions {
    return this.options
  }

  async setCameraStream(stream: MediaStream | null) {
    if (this.cameraStream === stream) return
    this.cameraStream = stream
    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null
      this.cameraVideo.remove()
      this.cameraVideo = null
    }
    if (stream) {
      this.cameraVideo = await this.makeVideoEl(stream)
    }
    this.rebuildAudio()
  }

  async setScreenStream(stream: MediaStream | null) {
    if (this.screenStream === stream) return
    this.screenStream = stream
    if (this.screenVideo) {
      this.screenVideo.srcObject = null
      this.screenVideo.remove()
      this.screenVideo = null
    }
    if (stream) {
      this.screenVideo = await this.makeVideoEl(stream)
    }
    this.rebuildAudio()
  }

  private async makeVideoEl(stream: MediaStream): Promise<HTMLVideoElement> {
    const v = document.createElement('video')
    v.srcObject = stream
    v.muted = true
    v.playsInline = true
    v.autoplay = true
    // keep off-DOM but attached so Safari plays
    v.style.position = 'fixed'
    v.style.width = '1px'
    v.style.height = '1px'
    v.style.opacity = '0'
    v.style.pointerEvents = 'none'
    document.body.appendChild(v)
    await v.play().catch(() => {})
    return v
  }

  private rebuildAudio() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContext()
        this.audioDest = this.audioCtx.createMediaStreamDestination()
      } catch {
        return
      }
    }
    // Disconnect existing sources
    try { this.micNode?.disconnect() } catch {}
    try { this.systemNode?.disconnect() } catch {}
    this.micNode = null
    this.systemNode = null

    const ctx = this.audioCtx!
    const dest = this.audioDest!

    if (this.cameraStream && this.cameraStream.getAudioTracks().length > 0) {
      const only = new MediaStream(this.cameraStream.getAudioTracks())
      const src = ctx.createMediaStreamSource(only)
      const gain = ctx.createGain()
      gain.gain.value = 1.0
      src.connect(gain).connect(dest)
      this.micNode = src
    }
    if (this.screenStream && this.screenStream.getAudioTracks().length > 0) {
      const only = new MediaStream(this.screenStream.getAudioTracks())
      const src = ctx.createMediaStreamSource(only)
      const gain = ctx.createGain()
      gain.gain.value = 0.8
      src.connect(gain).connect(dest)
      this.systemNode = src
    }
  }

  start() {
    if (this.rafId !== null) return
    const tick = () => {
      this.renderFrame()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  dispose() {
    this.stop()
    this.cameraVideo?.remove()
    this.screenVideo?.remove()
    try { this.micNode?.disconnect() } catch {}
    try { this.systemNode?.disconnect() } catch {}
    try { this.audioCtx?.close() } catch {}
  }

  captureStream(): MediaStream {
    const videoStream = (this.canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream })
      .captureStream(this.options.resolution.fps)
    const audioTracks = this.audioDest?.stream.getAudioTracks() ?? []
    const out = new MediaStream()
    videoStream.getVideoTracks().forEach((t) => out.addTrack(t))
    audioTracks.forEach((t) => out.addTrack(t))
    return out
  }

  private renderFrame() {
    const { ctx } = this
    const { width, height } = this.canvas
    const { mode, pipPosition, pipShape, pipSize } = this.options

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    const cam = this.cameraVideo && this.cameraVideo.readyState >= 2 ? this.cameraVideo : null
    const scr = this.screenVideo && this.screenVideo.readyState >= 2 ? this.screenVideo : null

    if (mode === 'camera' && cam) {
      drawCover(ctx, cam, 0, 0, width, height)
    } else if (mode === 'screen' && scr) {
      drawContain(ctx, scr, 0, 0, width, height)
    } else if (mode === 'pip') {
      const bg = scr ?? cam
      if (bg) drawContain(ctx, bg, 0, 0, width, height)

      if (scr && cam) {
        const pipW = Math.round(width * pipSizeFraction(pipSize))
        const pipH = Math.round(pipW * (9 / 16))
        const margin = Math.round(width * 0.018)
        let x = width - pipW - margin
        let y = height - pipH - margin
        if (pipPosition === 'bottom-left') { x = margin; y = height - pipH - margin }
        if (pipPosition === 'top-right') { x = width - pipW - margin; y = margin }
        if (pipPosition === 'top-left') { x = margin; y = margin }

        ctx.save()
        if (pipShape === 'circle') {
          const r = Math.min(pipW, pipH) / 2
          const cx = x + pipW / 2
          const cy = y + pipH / 2
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          // background shadow
          ctx.shadowColor = 'rgba(0,0,0,0.55)'
          ctx.shadowBlur = 18
          const cropW = Math.min(cam.videoWidth, cam.videoHeight)
          const sx = (cam.videoWidth - cropW) / 2
          const sy = (cam.videoHeight - cropW) / 2
          ctx.drawImage(cam, sx, sy, cropW, cropW, cx - r, cy - r, r * 2, r * 2)
          ctx.restore()
          // ring
          ctx.save()
          ctx.strokeStyle = '#00e29c'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(cx, cy, r + 1, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.55)'
          ctx.shadowBlur = 18
          drawCover(ctx, cam, x, y, pipW, pipH)
          ctx.restore()
          // border
          ctx.save()
          ctx.strokeStyle = '#00e29c'
          ctx.lineWidth = 2
          ctx.strokeRect(x + 0.5, y + 0.5, pipW - 1, pipH - 1)
          ctx.restore()
        }
      }
    }

    this.lastFrameAt = performance.now()
  }
}

function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const vw = v.videoWidth || w
  const vh = v.videoHeight || h
  const srcAspect = vw / vh
  const dstAspect = w / h
  let sx = 0, sy = 0, sw = vw, sh = vh
  if (srcAspect > dstAspect) {
    sw = vh * dstAspect
    sx = (vw - sw) / 2
  } else {
    sh = vw / dstAspect
    sy = (vh - sh) / 2
  }
  ctx.drawImage(v, sx, sy, sw, sh, x, y, w, h)
}

function drawContain(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const vw = v.videoWidth || w
  const vh = v.videoHeight || h
  if (!vw || !vh) return
  const srcAspect = vw / vh
  const dstAspect = w / h
  let dw = w, dh = h, dx = x, dy = y
  if (srcAspect > dstAspect) {
    dh = w / srcAspect
    dy = y + (h - dh) / 2
  } else {
    dw = h * srcAspect
    dx = x + (w - dw) / 2
  }
  ctx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh)
}
