import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReadConfirmer, openCamera } from './decoder'

describe('createReadConfirmer', () => {
  it('accepts a code only after the same valid read repeats', () => {
    const confirmer = createReadConfirmer(2)
    expect(confirmer.offer('036000291452')).toBeNull()
    expect(confirmer.offer('036000291452')).toMatchObject({ gtin13: '0036000291452' })
  })

  it('treats UPC-A and its EAN-13 form as the same read', () => {
    const confirmer = createReadConfirmer(2)
    expect(confirmer.offer('036000291452')).toBeNull()
    expect(confirmer.offer('0036000291452')).toMatchObject({ gtin13: '0036000291452' })
  })

  it('restarts the streak when a different code is read', () => {
    const confirmer = createReadConfirmer(2)
    confirmer.offer('036000291452')
    expect(confirmer.offer('4006381333931')).toBeNull()
    expect(confirmer.offer('4006381333931')).toMatchObject({ gtin13: '4006381333931' })
  })

  it('counts and drops misreads that fail the check digit', () => {
    const confirmer = createReadConfirmer(2)
    confirmer.offer('036000291452')
    expect(confirmer.offer('036000291453')).toBeNull()
    expect(confirmer.offer('036000291452')).toBeNull()
    expect(confirmer.rejected).toBe(1)
  })

  it('needs one extra matching read for UPC-E, which glare can fake from half an EAN-13', () => {
    const confirmer = createReadConfirmer(2)
    expect(confirmer.offer('01234565')).toBeNull()
    expect(confirmer.offer('01234565')).toBeNull()
    expect(confirmer.offer('01234565')).toMatchObject({ symbology: 'UPC_E' })
  })

  it('accepts the first valid read when one confirmation is enough', () => {
    expect(createReadConfirmer(1).offer('036000291452')).toMatchObject({ symbology: 'UPC_A' })
  })
})

// A camera stub: each getUserMedia answer says whether that stream ever
// shows a frame. jsdom has no media pipeline, so the video's readiness is
// driven by the stub.
function fakeCamera(streams: ('picture' | 'black' | Error)[]) {
  const opened: { stopped: boolean }[] = []
  const requests: MediaStreamConstraints[] = []
  const video = document.createElement('video')
  let ready = false
  Object.defineProperty(video, 'readyState', { get: () => (ready ? 4 : 0) })
  Object.defineProperty(video, 'videoWidth', { get: () => (ready ? 1280 : 0) })
  const play = vi.fn().mockResolvedValue(undefined)
  video.play = play
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
        requests.push(constraints)
        const next = streams.shift()
        if (next instanceof Error) throw next
        const track = { stopped: false, stop() { this.stopped = true } }
        opened.push(track)
        ready = next === 'picture'
        return { getTracks: () => [track] } as unknown as MediaStream
      }),
    },
  })
  return { video, opened, requests, play }
}

describe('openCamera', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('sets the attributes iPhone Safari needs to play inline before attaching the stream', async () => {
    const { video, play } = fakeCamera(['picture'])
    await openCamera(video)
    expect(video.getAttribute('playsinline')).toBe('true')
    expect(video.muted).toBe(true)
    expect(video.autoplay).toBe(true)
    expect(play).toHaveBeenCalled()
  })

  it('retries with plainer constraints when a stream shows no picture, releasing the black one', async () => {
    vi.useFakeTimers()
    const { video, opened, requests } = fakeCamera(['black', 'picture'])
    const started = openCamera(video)
    await vi.advanceTimersByTimeAsync(4100)
    await started
    expect(requests).toHaveLength(2)
    expect(requests[1]?.video).toEqual({ facingMode: { ideal: 'environment' } })
    expect(opened[0]?.stopped).toBe(true)
    expect(opened[1]?.stopped).toBe(false)
  })

  it('gives up with CameraNoPictureError after every attempt stays black, holding no camera', async () => {
    vi.useFakeTimers()
    const { video, opened } = fakeCamera(['black', 'black', 'black'])
    const started = openCamera(video).catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(13000)
    expect(((await started) as Error).name).toBe('CameraNoPictureError')
    expect(opened.every((t) => t.stopped)).toBe(true)
  })

  it('stops at a permission refusal instead of retrying', async () => {
    const { video, requests } = fakeCamera([Object.assign(new Error('no'), { name: 'NotAllowedError' })])
    await expect(openCamera(video)).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(requests).toHaveLength(1)
  })

  it('asks for a tap when play() is refused, keeping the stream for it', async () => {
    const { video, play, opened } = fakeCamera(['picture'])
    play.mockRejectedValue(Object.assign(new Error('autoplay'), { name: 'NotAllowedError' }))
    const err = (await openCamera(video).then(
      () => new Error('started'),
      (e: unknown) => e,
    )) as Error & { stream?: MediaStream }
    expect(err.name).toBe('CameraNeedsTapError')
    expect(err.stream).toBeDefined()
    expect(opened[0]?.stopped).toBe(false)
  })

  it('releases a camera that opens after the start was cancelled', async () => {
    const { video, opened } = fakeCamera(['picture'])
    const controller = new AbortController()
    const started = openCamera(video, { signal: controller.signal })
    controller.abort()
    await expect(started).rejects.toMatchObject({ name: 'AbortError' })
    expect(opened.every((t) => t.stopped)).toBe(true)
  })
})
