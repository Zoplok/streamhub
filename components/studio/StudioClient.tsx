'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorX,
  Play,
  Square,
  Circle,
  AlertTriangle,
  Wifi,
  WifiOff,
  ExternalLink,
  Camera,
  Layers,
  Settings2,
  Pause,
  Volume2,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Sparkles,
  Copy
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ChatSidebar } from '@/components/live/ChatSidebar'
import {
  SceneCompositor,
  RESOLUTIONS,
  type PipPosition,
  type PipShape,
  type PipSize,
  type Resolution,
  type SceneMode
} from '@/lib/studio/compositor'

type ConnState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error' | 'ended'

interface Props {
  streamId: string
  streamKey: string
  title: string
  channelName: string
  initialStatus: string
  userId: string | null
  username: string | null
  rtmpIngestUrl: string | null
}

const BITRATE_PRESETS = [
  { id: 'low', label: 'Low · 2 Mbps', video: 2_000_000, audio: 96_000 },
  { id: 'medium', label: 'Medium · 3.5 Mbps', video: 3_500_000, audio: 128_000 },
  { id: 'high', label: 'High · 5 Mbps', video: 5_000_000, audio: 160_000 },
  { id: 'ultra', label: 'Ultra · 8 Mbps', video: 8_000_000, audio: 192_000 }
] as const

type BitratePreset = (typeof BITRATE_PRESETS)[number]['id']

function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264,opus',
    'video/webm'
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return 'video/webm'
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

function fmtBps(bps: number): string {
  if (bps < 1024) return `${bps | 0} b/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} Kb/s`
  return `${(bps / (1024 * 1024)).toFixed(2)} Mb/s`
}

function getIngestWsUrl(streamKey: string): string | null {
  const external = process.env.NEXT_PUBLIC_INGEST_WS_URL?.trim().replace(/\/$/, '')
  if (external) return `${external}?key=${encodeURIComponent(streamKey)}`
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/ws/stream?key=${encodeURIComponent(streamKey)}`
}

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = () => {
      if (pc.iceGatheringState !== 'complete') return
      pc.removeEventListener('icegatheringstatechange', done)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', done)
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', done)
      resolve()
    }, 2500)
  })
}

export function StudioClient({ streamId, streamKey, title, channelName, userId, username, rtmpIngestUrl }: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null)
  const compositorRef = useRef<SceneCompositor | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const p2pPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const handledOffersRef = useRef<Set<string>>(new Set())
  const bytesRef = useRef(0)
  const lastBytesRef = useRef(0)
  const lastTickRef = useRef(0)

  // Scene config
  const [mode, setMode] = useState<SceneMode>('camera')
  const [pipPosition, setPipPosition] = useState<PipPosition>('bottom-right')
  const [pipShape, setPipShape] = useState<PipShape>('rect')
  const [pipSize, setPipSize] = useState<PipSize>('md')
  const [resolutionId, setResolutionId] = useState<keyof typeof RESOLUTIONS>('720p')
  const [bitratePreset, setBitratePreset] = useState<BitratePreset>('medium')

  // Track availability
  const [cameraOn, setCameraOn] = useState(false)
  const [screenOn, setScreenOn] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [paused, setPaused] = useState(false)

  // Devices
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState<string>('')
  const [micId, setMicId] = useState<string>('')

  // Status
  const [permError, setPermError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [ingestAvailable, setIngestAvailable] = useState(true)
  const [conn, setConn] = useState<ConnState>('idle')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [bitrate, setBitrate] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const [statusOnlyLive, setStatusOnlyLive] = useState(false)

  const resolution: Resolution = RESOLUTIONS[resolutionId]

  useEffect(() => {
    setIngestAvailable(true)
  }, [])

  // Initialise compositor and attach canvas to preview on mount
  useEffect(() => {
    const comp = new SceneCompositor({
      mode,
      resolution,
      pipPosition,
      pipShape,
      pipSize
    })
    compositorRef.current = comp
    comp.canvas.className = 'h-full w-full bg-black object-contain'
    comp.canvas.style.width = '100%'
    comp.canvas.style.height = '100%'
    comp.canvas.style.objectFit = 'contain'
    if (previewRef.current) {
      previewRef.current.innerHTML = ''
      previewRef.current.appendChild(comp.canvas)
    }
    comp.start()

    // Auto-start the camera on first load
    void startCamera()

    return () => {
      try { recorderRef.current?.state === 'recording' && recorderRef.current.stop() } catch {}
      try { wsRef.current?.close() } catch {}
      stopCamera()
      stopScreen()
      comp.dispose()
      compositorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push option changes into the compositor (no restart required)
  useEffect(() => {
    compositorRef.current?.updateOptions({ mode, pipPosition, pipShape, pipSize, resolution })
  }, [mode, pipPosition, pipShape, pipSize, resolution])

  // Derive scene auto: if both streams are on, prefer pip; else single source
  useEffect(() => {
    if (cameraOn && screenOn) setMode('pip')
    else if (screenOn) setMode('screen')
    else if (cameraOn) setMode('camera')
  }, [cameraOn, screenOn])

  // Elapsed + bitrate ticker
  useEffect(() => {
    if (conn !== 'live') return
    const iv = setInterval(() => {
      const nowMs = Date.now()
      setNow(nowMs)
      const delta = (bytesRef.current - lastBytesRef.current) * 8
      const secs = lastTickRef.current ? (nowMs - lastTickRef.current) / 1000 : 1
      setBitrate(delta / Math.max(secs, 0.001))
      lastBytesRef.current = bytesRef.current
      lastTickRef.current = nowMs
    }, 1000)
    return () => clearInterval(iv)
  }, [conn])

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setCameras(list.filter((d) => d.kind === 'videoinput'))
      setMics(list.filter((d) => d.kind === 'audioinput'))
    } catch {
      /* ignore */
    }
  }, [])

  // Camera + mic
  const startCamera = useCallback(async () => {
    try {
      setPermError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: micId ? { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true } : true
      })
      stream.getVideoTracks().forEach((t) => (t.enabled = true))
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn))

      if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = stream
      await compositorRef.current?.setCameraStream(stream)
      setCameraOn(true)
      refreshDevices()
    } catch (err) {
      setPermError((err as Error).message || 'Camera access denied')
    }
  }, [cameraId, micId, micOn, refreshDevices])

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current = null
    void compositorRef.current?.setCameraStream(null)
    setCameraOn(false)
  }, [])

  // Screen share
  const startScreen = useCallback(async () => {
    try {
      setPermError(null)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true
      })
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        screenStreamRef.current = null
        void compositorRef.current?.setScreenStream(null)
        setScreenOn(false)
      })
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = stream
      await compositorRef.current?.setScreenStream(stream)
      setScreenOn(true)
    } catch (err) {
      setPermError((err as Error).message || 'Screen share denied')
    }
  }, [])

  const stopScreen = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    void compositorRef.current?.setScreenStream(null)
    setScreenOn(false)
  }, [])

  // Apply mic on/off to the underlying mic track
  useEffect(() => {
    cameraStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn))
  }, [micOn])

  // Rebuild camera stream when device id changes while live
  useEffect(() => {
    if (!cameraOn) return
    void startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, micId])

  const updateStreamStatus = useCallback(async (status: 'live' | 'ended') => {
    const res = await fetch(`/api/streams/${streamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: unknown } | null
      throw new Error(typeof body?.error === 'string' ? body.error : `Could not mark stream ${status}`)
    }
  }, [streamId])

  const startStatusOnlyLive = useCallback(async () => {
    await updateStreamStatus('live')
    setConn('live')
    setStartedAt(Date.now())
    setPaused(false)
    setStatusOnlyLive(true)
    setErrorMsg(null)
  }, [updateStreamStatus])

  const goLive = useCallback(async () => {
    const comp = compositorRef.current
    if (!comp) return
    if (!cameraOn && !screenOn) {
      setErrorMsg('Enable at least one source (camera or screen) before going live.')
      return
    }
    setErrorMsg(null)
    setConn('connecting')
    bytesRef.current = 0
    lastBytesRef.current = 0
    lastTickRef.current = 0

    const wsUrl = getIngestWsUrl(streamKey)
    if (!wsUrl) {
      try {
        await startStatusOnlyLive()
      } catch (err) {
        setErrorMsg((err as Error).message)
        setConn('error')
      }
      return
    }
    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    const preset = BITRATE_PRESETS.find((b) => b.id === bitratePreset)!

    ws.onopen = () => {
      const mimeType = pickMimeType()
      const output = comp.captureStream()
      let mr: MediaRecorder
      try {
        mr = new MediaRecorder(output, {
          mimeType,
          videoBitsPerSecond: preset.video,
          audioBitsPerSecond: preset.audio
        })
      } catch (err) {
        setErrorMsg(`MediaRecorder failed: ${(err as Error).message}`)
        setConn('error')
        ws.close()
        return
      }
      recorderRef.current = mr

      mr.ondataavailable = async (ev) => {
        if (!ev.data || ev.data.size === 0) return
        if (ws.readyState !== WebSocket.OPEN) return
        const buf = await ev.data.arrayBuffer()
        bytesRef.current += buf.byteLength
        ws.send(buf)
      }
      mr.onerror = (e) => {
        console.error('recorder error', e)
        setErrorMsg('Recorder error — stopping')
        stopStream()
      }
      mr.start(250)
      setConn('live')
      setStartedAt(Date.now())
      setPaused(false)
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
        if (msg?.type === 'error') setErrorMsg(msg.message ?? 'Server error')
      } catch {
        /* ignore */
      }
    }

    ws.onerror = () => {
      setErrorMsg('Could not reach the ingest service.')
      setConn('error')
    }

    ws.onclose = (ev) => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop() } catch {}
      }
      setConn((prev) => (prev === 'live' || prev === 'connecting' ? 'ended' : prev))
      if (ev.code !== 1000 && ev.reason) setErrorMsg(ev.reason)
    }
  }, [cameraOn, screenOn, streamKey, bitratePreset, startStatusOnlyLive])

  const stopStream = useCallback(() => {
    try { recorderRef.current?.state === 'recording' && recorderRef.current.stop() } catch {}
    try { wsRef.current?.close(1000, 'client stop') } catch {}
    if (statusOnlyLive) {
      void updateStreamStatus('ended').catch((err) => {
        setErrorMsg((err as Error).message)
      })
      setStatusOnlyLive(false)
    }
    setConn('ended')
    setPaused(false)
  }, [statusOnlyLive, updateStreamStatus])

  const togglePause = useCallback(() => {
    const mr = recorderRef.current
    if (!mr) return
    if (mr.state === 'recording') {
      mr.pause()
      setPaused(true)
    } else if (mr.state === 'paused') {
      mr.resume()
      setPaused(false)
    }
  }, [])

  useEffect(() => {
    if (conn !== 'live' || !statusOnlyLive) return

    let cancelled = false
    const peers = p2pPeersRef.current
    const handledOffers = handledOffersRef.current
    async function answerOffers() {
      const comp = compositorRef.current
      if (!comp) return
      try {
        const res = await fetch(`/api/streams/${streamId}/webrtc?role=host`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const json = await res.json() as {
          data?: Array<{ id: string; viewer_id: string; payload: string }>
        }

        for (const offer of json.data ?? []) {
          if (handledOffers.has(offer.id)) continue
          handledOffers.add(offer.id)

          peers.get(offer.viewer_id)?.close()
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          })
          peers.set(offer.viewer_id, pc)

          const media = comp.captureStream()
          media.getTracks().forEach((track) => pc.addTrack(track, media))
          await pc.setRemoteDescription(JSON.parse(offer.payload) as RTCSessionDescriptionInit)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await waitForIceGathering(pc)

          await fetch(`/api/streams/${streamId}/webrtc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              viewerId: offer.viewer_id,
              type: 'host-answer',
              payload: pc.localDescription
            })
          })
        }
      } catch (err) {
        console.error('[webrtc host]', err)
      }
    }

    void answerOffers()
    const timer = window.setInterval(answerOffers, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      peers.forEach((pc) => pc.close())
      peers.clear()
      handledOffers.clear()
    }
  }, [conn, statusOnlyLive, streamId])

  const elapsed = startedAt ? now - startedAt : 0
  const canUseObs = Boolean(rtmpIngestUrl)

  const copyValue = useCallback(async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1600)
  }, [])

  const statusPill = useMemo(() => {
    switch (conn) {
      case 'live':
        return paused
          ? { label: 'PAUSED', cls: 'bg-amber-500/20 text-amber-300 ring-amber-500/40', icon: <Pause className="h-3 w-3" /> }
          : { label: 'LIVE', cls: 'bg-red-500/20 text-red-300 ring-red-500/40', icon: <Circle className="h-2 w-2 animate-pulse fill-red-400 text-red-400" /> }
      case 'connecting':
        return { label: 'CONNECTING', cls: 'bg-amber-500/20 text-amber-300 ring-amber-500/40', icon: <Wifi className="h-3 w-3" /> }
      case 'error':
        return { label: 'ERROR', cls: 'bg-red-500/20 text-red-300 ring-red-500/40', icon: <WifiOff className="h-3 w-3" /> }
      case 'ended':
        return { label: 'ENDED', cls: 'bg-neutral-500/20 text-neutral-300 ring-neutral-500/40', icon: <Square className="h-3 w-3" /> }
      default:
        return { label: 'OFFLINE', cls: 'bg-neutral-500/10 text-neutral-400 ring-neutral-500/30', icon: <Circle className="h-2 w-2" /> }
    }
  }, [conn, paused])

  const sceneLocked = conn === 'live' || conn === 'connecting'

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-0 lg:grid-cols-[280px_1fr_360px]">
      {/* ── LEFT RAIL · Scenes + Settings ── */}
      <aside className="flex flex-col gap-4 border-r border-surface-3 bg-surface-1 p-4 overflow-y-auto">
        {/* Sources */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <Layers className="h-3.5 w-3.5" />
            Sources
          </h3>
          <div className="flex flex-col gap-2">
            <SourceToggle
              label="Camera"
              icon={Video}
              activeIcon={Video}
              inactiveIcon={VideoOff}
              on={cameraOn}
              onEnable={startCamera}
              onDisable={stopCamera}
            />
            <SourceToggle
              label="Screen share"
              icon={Monitor}
              activeIcon={Monitor}
              inactiveIcon={MonitorX}
              on={screenOn}
              onEnable={startScreen}
              onDisable={stopScreen}
            />
          </div>
        </section>

        {/* Scene mode */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <Sparkles className="h-3.5 w-3.5" />
            Scene
          </h3>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1 ring-1 ring-surface-3">
            <SceneChip active={mode === 'camera'} disabled={!cameraOn} onClick={() => setMode('camera')} label="Cam" />
            <SceneChip active={mode === 'screen'} disabled={!screenOn} onClick={() => setMode('screen')} label="Screen" />
            <SceneChip active={mode === 'pip'} disabled={!cameraOn || !screenOn} onClick={() => setMode('pip')} label="PiP" />
          </div>

          {mode === 'pip' && (
            <div className="mt-3 space-y-3 rounded-lg border border-surface-3 bg-surface-2/60 p-3">
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Camera position</div>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      { id: 'top-left', icon: CornerUpLeft },
                      { id: 'top-right', icon: CornerUpRight },
                      { id: 'bottom-left', icon: CornerDownLeft },
                      { id: 'bottom-right', icon: CornerDownRight }
                    ] as const
                  ).map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPipPosition(id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ring-1 transition-colors ${
                        pipPosition === id ? 'bg-brand-500 text-black ring-brand-500' : 'bg-surface-1 text-neutral-300 ring-surface-3 hover:bg-surface-3'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Size</div>
                <div className="grid grid-cols-3 gap-1">
                  {(['sm', 'md', 'lg'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPipSize(s)}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase ring-1 ${
                        pipSize === s ? 'bg-brand-500 text-black ring-brand-500' : 'bg-surface-1 text-neutral-300 ring-surface-3 hover:bg-surface-3'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Shape</div>
                <div className="grid grid-cols-2 gap-1">
                  {(['rect', 'circle'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPipShape(s)}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase ring-1 ${
                        pipShape === s ? 'bg-brand-500 text-black ring-brand-500' : 'bg-surface-1 text-neutral-300 ring-surface-3 hover:bg-surface-3'
                      }`}
                    >
                      {s === 'rect' ? 'Square' : 'Circle'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Devices */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <Camera className="h-3.5 w-3.5" />
            Devices
          </h3>
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Camera</span>
              <select
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
                className="block w-full truncate rounded-md bg-surface-2 px-2 py-1.5 text-xs text-neutral-200 ring-1 ring-surface-3 hover:bg-surface-3"
              >
                <option value="">Default camera</option>
                {cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Microphone</span>
              <select
                value={micId}
                onChange={(e) => setMicId(e.target.value)}
                className="block w-full truncate rounded-md bg-surface-2 px-2 py-1.5 text-xs text-neutral-200 ring-1 ring-surface-3 hover:bg-surface-3"
              >
                <option value="">Default mic</option>
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Output */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            <Settings2 className="h-3.5 w-3.5" />
            Output
          </h3>
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Resolution</span>
              <select
                value={resolutionId}
                onChange={(e) => setResolutionId(e.target.value as keyof typeof RESOLUTIONS)}
                disabled={sceneLocked}
                className="block w-full rounded-md bg-surface-2 px-2 py-1.5 text-xs text-neutral-200 ring-1 ring-surface-3 hover:bg-surface-3 disabled:opacity-50"
              >
                {Object.entries(RESOLUTIONS).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Bitrate</span>
              <select
                value={bitratePreset}
                onChange={(e) => setBitratePreset(e.target.value as BitratePreset)}
                disabled={sceneLocked}
                className="block w-full rounded-md bg-surface-2 px-2 py-1.5 text-xs text-neutral-200 ring-1 ring-surface-3 hover:bg-surface-3 disabled:opacity-50"
              >
                {BITRATE_PRESETS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </aside>

      {/* ── CENTER · Preview + transport ── */}
      <div className="flex flex-col bg-black">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-3 bg-surface-1 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 ring-1 ring-brand-500/40">
              <Radio className="h-4 w-4 text-brand-400" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{title || 'Untitled stream'}</div>
              <div className="text-[11px] text-neutral-500">{channelName}</div>
            </div>
          </div>

          <div className={`ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${statusPill.cls}`}>
            {statusPill.icon}
            {statusPill.label}
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-neutral-400">
            {conn === 'live' && (
              <>
                <span className="tabular-nums">{fmtDuration(elapsed)}</span>
                <span className="hidden sm:inline">·</span>
                <span className="tabular-nums">{fmtBps(bitrate)}</span>
                <span className="hidden sm:inline">·</span>
                <span className="uppercase">{resolution.label}</span>
              </>
            )}
            <Link href={`/live/${streamId}`} target="_blank" className="inline-flex items-center gap-1 text-neutral-400 hover:text-white">
              <ExternalLink className="h-3.5 w-3.5" />
              View live
            </Link>
          </div>
        </div>

        {/* Preview (canvas goes here) */}
        <div className="relative flex-1 overflow-hidden">
          <div ref={previewRef} className="flex h-full w-full items-center justify-center" />
          {!cameraOn && !screenOn && !permError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
              <Camera className="h-10 w-10 text-brand-400" />
              <p className="max-w-sm text-sm text-neutral-300">
                Enable a source to get started — turn on your camera or share your screen.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={startCamera} className="gap-2">
                  <Video className="h-4 w-4" />
                  Camera
                </Button>
                <Button size="sm" variant="secondary" onClick={startScreen} className="gap-2">
                  <Monitor className="h-4 w-4" />
                  Screen
                </Button>
              </div>
            </div>
          )}
          {permError && (
            <div className="absolute left-4 right-4 top-4 flex items-start gap-2 rounded-lg border border-amber-900/60 bg-amber-950/70 px-3 py-2 text-sm text-amber-200 backdrop-blur">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{permError}</span>
            </div>
          )}
          {errorMsg && (
            <div className="absolute left-4 right-4 top-4 flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/70 px-3 py-2 text-sm text-red-200 backdrop-blur">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {statusOnlyLive && !errorMsg && (
            <div className="absolute left-4 right-4 top-4 flex items-start gap-2 rounded-lg border border-amber-900/60 bg-amber-950/70 px-3 py-2 text-sm text-amber-100 backdrop-blur">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Browser live is active. Keep this Studio tab open so viewers can connect to your camera.</span>
            </div>
          )}
        </div>

        {/* Transport bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-surface-3 bg-surface-1 px-4 py-3">
          <button
            type="button"
            onClick={() => setMicOn((v) => !v)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-colors ${
              micOn ? 'bg-surface-2 text-neutral-200 ring-surface-3 hover:bg-surface-3' : 'bg-red-500/15 text-red-300 ring-red-500/30'
            }`}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => (cameraOn ? stopCamera() : startCamera())}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-colors ${
              cameraOn ? 'bg-surface-2 text-neutral-200 ring-surface-3 hover:bg-surface-3' : 'bg-red-500/15 text-red-300 ring-red-500/30'
            }`}
            title={cameraOn ? 'Stop camera' : 'Start camera'}
          >
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => (screenOn ? stopScreen() : startScreen())}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-colors ${
              screenOn ? 'bg-surface-2 text-neutral-200 ring-surface-3 hover:bg-surface-3' : 'bg-surface-2 text-neutral-400 ring-surface-3 hover:bg-surface-3'
            }`}
            title={screenOn ? 'Stop screen share' : 'Start screen share'}
          >
            {screenOn ? <Monitor className="h-4 w-4" /> : <MonitorX className="h-4 w-4" />}
          </button>

          <div className="mx-2 h-6 w-px bg-surface-3" />

          {conn === 'live' && (
            <Button variant="secondary" size="sm" onClick={togglePause} className="gap-2">
              <Pause className="h-4 w-4" />
              {paused ? 'Resume' : 'Pause'}
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {conn !== 'live' && conn !== 'connecting' ? (
              <div className="flex flex-col items-end gap-1">
                {!ingestAvailable && (
                  <div className="mb-1 max-w-sm rounded-lg border border-amber-900/60 bg-amber-950/40 p-3 text-left text-[11px] leading-tight text-amber-100">
                    <div className="mb-2 font-bold uppercase tracking-wider text-amber-300">Video ingest not connected</div>
                    <p className="mb-2 text-amber-100/80">
                      You can go live now for chat/status. Connect RTMP/WebSocket ingest later for video.
                    </p>
                    {canUseObs ? (
                      <div className="space-y-2">
                        <CopyRow label="RTMP URL" value={rtmpIngestUrl!} copied={copied === 'rtmp'} onCopy={() => copyValue('rtmp', rtmpIngestUrl!)} />
                        <CopyRow label="Stream key" value={streamKey} copied={copied === 'key'} onCopy={() => copyValue('key', streamKey)} secret />
                      </div>
                    ) : (
                      <p className="text-amber-100/80">
                        Set NEXT_PUBLIC_RTMP_INGEST_URL for OBS, or NEXT_PUBLIC_INGEST_WS_URL for browser Go Live.
                      </p>
                    )}
                  </div>
                )}
                <Button
                  variant="primary"
                  size="md"
                  onClick={goLive}
                  disabled={!cameraOn && !screenOn}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Go Live
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="md" onClick={stopStream} className="gap-2 !bg-red-500 !text-white hover:!bg-red-600">
                <Square className="h-4 w-4 fill-white" />
                End stream
              </Button>
            )}
          </div>
        </div>

        {/* Helper strip */}
        <div className="border-t border-surface-3 bg-surface-1/60 px-4 py-2 text-[11px] text-neutral-500">
          <Volume2 className="mr-1 inline h-3 w-3" />
          Audio mix: mic{screenOn ? ' + system (from screen share)' : ''}.
          <span className="ml-2">· Stream ID: <code className="font-mono text-neutral-400">{streamId.slice(0, 8)}</code></span>
        </div>
      </div>

      {/* ── RIGHT · Chat ── */}
      <div className="hidden border-l border-surface-3 bg-surface-1 lg:block">
        <ChatSidebar streamId={streamId} userId={userId} username={username} />
      </div>
    </div>
  )
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  secret = false
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
  secret?: boolean
}) {
  return (
    <div className="grid grid-cols-[72px_1fr_auto] items-center gap-2 rounded-md bg-black/20 px-2 py-1.5 ring-1 ring-amber-900/40">
      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">{label}</span>
      <code className="truncate font-mono text-[11px] text-amber-50">
        {secret ? `${value.slice(0, 6)}...${value.slice(-4)}` : value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-6 items-center gap-1 rounded-md bg-amber-400/15 px-2 text-[10px] font-bold uppercase text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-400/25"
      >
        <Copy className="h-3 w-3" />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function SourceToggle({
  label,
  icon: Icon,
  activeIcon: ActiveIcon,
  inactiveIcon: InactiveIcon,
  on,
  onEnable,
  onDisable
}: {
  label: string
  icon: typeof Video
  activeIcon: typeof Video
  inactiveIcon: typeof VideoOff
  on: boolean
  onEnable: () => void
  onDisable: () => void
}) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${on ? 'border-brand-500/40 bg-brand-500/10' : 'border-surface-3 bg-surface-2/60'}`}>
      <div className="flex items-center gap-2">
        {on ? <ActiveIcon className="h-4 w-4 text-brand-300" /> : <InactiveIcon className="h-4 w-4 text-neutral-500" />}
        <span className={`text-xs font-semibold ${on ? 'text-brand-200' : 'text-neutral-300'}`}>{label}</span>
      </div>
      <button
        type="button"
        onClick={on ? onDisable : onEnable}
        className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 transition-colors ${
          on ? 'bg-brand-500 text-black ring-brand-500 hover:bg-brand-400' : 'bg-surface-1 text-neutral-200 ring-surface-3 hover:bg-surface-3'
        }`}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  )
}

function SceneChip({ active, disabled, onClick, label }: { active: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-brand-500 text-black' : 'text-neutral-300 hover:text-white'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
    </button>
  )
}
