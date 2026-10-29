import type { Friend, Message, Role } from './types';
import { sessionToken } from './connection';

export type LiveState = 'permission' | 'connecting' | 'connected' | 'ended' | 'error';
export type LiveUpdate = {
  state: LiveState;
  mic: boolean;
  camera: boolean;
  cameraBusy: boolean;
  speaker: boolean;
  facing: 'user' | 'environment';
  speaking: boolean;
  message: string;
  caption: { role: Role; text: string } | null;
};
export type LiveResult = {
  duration: number;
  cameraUsed: boolean;
  transcript: { role: Role; text: string }[];
  completed: boolean;
};
const encode = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};

/** Media is sent only after the user starts a call and Gemini reports ready. */
export class LiveCall {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioContext | null = null;
  private playback: AudioContext | null = null;
  private output: GainNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextAudio = 0;
  private startedAt = 0;
  private stopped = false;
  private starting = false;
  private cameraBusy = false;
  private ready = false;
  private cameraUsed = false;
  private transcript: { role: Role; text: string }[] = [];
  private canvas = document.createElement('canvas');
  private video = document.createElement('video');
  private preview: HTMLVideoElement | null = null;
  private state: LiveUpdate = {
    state: 'permission',
    mic: true,
    camera: false,
    cameraBusy: false,
    speaker: true,
    facing: 'user',
    speaking: false,
    message: 'Waiting for device permission…',
    caption: null,
  };
  constructor(
    private friend: Friend,
    private mode: 'voice' | 'video',
    private userName: string,
    private history: Message[],
    private onStream: (stream: MediaStream | null) => void,
    private onUpdate: (update: LiveUpdate) => void,
    private onEnd: (result: LiveResult) => void,
  ) {
    this.video.muted = true;
    this.video.playsInline = true;
  }
  setPreview(element: HTMLVideoElement | null) {
    this.preview = element;
  }
  private update(patch: Partial<LiveUpdate>, force = false) {
    this.state = { ...this.state, ...patch };
    if (!this.stopped || force) this.onUpdate(this.state);
  }
  private send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 500_000)
      this.ws.send(JSON.stringify(data));
  }
  private mediaState() {
    this.send({ type: 'mediaState', mic: this.state.mic, camera: this.state.camera });
  }
  async start() {
    if (this.starting || this.stopped) return;
    this.starting = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera and microphone need HTTPS and a supported browser.');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video:
          this.mode === 'video'
            ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            : false,
      });
      if (this.stopped) {
        this.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.onStream(this.stream);
      this.state.camera = this.mode === 'video';
      this.cameraUsed = this.state.camera;
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
      this.update({
        state: 'connecting',
        message: 'Connecting to Gemini Live…',
        camera: this.state.camera,
      });
      this.playback = new AudioContext({ sampleRate: 24000 });
      await this.playback.resume();
      if (this.stopped) return;
      this.output = this.playback.createGain();
      this.output.gain.value = this.state.speaker ? 1 : 0;
      this.output.connect(this.playback.destination);
      this.capture = new AudioContext();
      await this.capture.resume();
      if (this.stopped) return;
      await this.capture.audioWorklet.addModule('/pcm-capture.js');
      if (this.stopped) return;
      this.worklet = new AudioWorkletNode(this.capture, 'pcm-capture');
      this.source = this.capture.createMediaStreamSource(this.stream);
      const silent = this.capture.createGain();
      silent.gain.value = 0;
      this.source.connect(this.worklet);
      this.worklet.connect(silent);
      silent.connect(this.capture.destination);
      this.worklet.port.onmessage = (event) => {
        if (this.ready && this.state.mic) this.send({ type: 'audio', data: encode(event.data) });
      };
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}/api/live`);
      this.connectTimeout = setTimeout(
        () =>
          this.finish(
            'Gemini took too long to connect. Check your key and Live model access.',
            false,
          ),
        25_000,
      );
      this.ws.onopen = () =>
        this.send({
          type: 'start',
          token: sessionToken(),
          friendId: this.friend.id,
          userName: this.userName,
          video: this.state.camera,
          history: this.history
            .filter((m) => !m.sample && m.text)
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text })),
        });
      this.ws.onmessage = (event) => {
        if (this.stopped) return;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === 'ready') {
          if (this.connectTimeout) clearTimeout(this.connectTimeout);
          this.ready = true;
          this.startedAt = Date.now();
          this.update({ state: 'connected', message: 'Listening. Say a little hello.' });
          this.mediaState();
          this.captureFrame();
          this.timer = setInterval(() => this.captureFrame(), 1000);
        } else if (data.type === 'audio' && typeof data.data === 'string') this.play(data.data);
        else if (data.type === 'interrupted') this.clearAudio();
        else if (
          data.type === 'transcript' &&
          typeof data.text === 'string' &&
          ['user', 'assistant'].includes(data.role)
        ) {
          const last = this.transcript.at(-1);
          if (last && last.role === data.role)
            this.transcript[this.transcript.length - 1] = {
              role: data.role,
              text: last.text + data.text,
            };
          else this.transcript.push({ role: data.role, text: data.text });
          if (this.transcript.length > 200) this.transcript.shift();
          this.update({
            caption: { role: data.role, text: data.text },
            message:
              data.role === 'assistant' ? `${this.friend.name} is speaking` : 'Listening to you…',
          });
        } else if (data.type === 'turnComplete')
          this.update({ message: 'Listening. Take your time.' });
        else if (data.type === 'notice') this.update({ message: String(data.message) });
        else if (data.type === 'error' || data.type === 'ended')
          this.finish(String(data.message || 'The call ended.'), data.type === 'ended');
      };
      this.ws.onerror = () =>
        this.finish('The live connection failed. Check your network and try again.', false);
      this.ws.onclose = () => {
        if (!this.stopped)
          this.finish(
            this.ready
              ? 'The call was disconnected.'
              : 'Gemini Live could not connect. Check Settings and try again.',
            this.ready,
          );
      };
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      const message =
        name === 'NotAllowedError'
          ? 'Permission wasn’t granted. Allow microphone and camera access in your browser, then try again.'
          : name === 'NotFoundError'
            ? 'No microphone or camera was found. Check your device and try again.'
            : name === 'NotReadableError'
              ? 'Your camera or microphone is busy in another app. Close it and try again.'
              : error instanceof Error
                ? error.message
                : 'This call could not start.';
      this.finish(message, false);
    }
  }
  private captureFrame() {
    const video =
      this.preview?.isConnected && this.preview.readyState >= 2 ? this.preview : this.video;
    if (!this.ready || !this.state.camera || video.readyState < 2 || !video.videoWidth) return;
    const scale = Math.min(1, 640 / video.videoWidth);
    this.canvas.width = Math.round(video.videoWidth * scale);
    this.canvas.height = Math.round(video.videoHeight * scale);
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    const data = this.canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    if (data.length < 220_000) this.send({ type: 'video', data });
  }
  private play(base64: string) {
    const ctx = this.playback;
    if (!ctx || !this.output || this.stopped) return;
    try {
      const binary = atob(base64);
      if (binary.length % 2) return;
      const buffer = ctx.createBuffer(1, binary.length / 2, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) {
        const value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
        channel[i] = (value > 32767 ? value - 65536 : value) / 32768;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.output);
      const start = Math.max(ctx.currentTime + 0.02, this.nextAudio);
      this.nextAudio = start + buffer.duration;
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        if (!this.sources.size) this.update({ speaking: false });
      };
      source.start(start);
      this.update({ speaking: true });
    } catch {
      /* Ignore an incomplete/interrupted audio frame. */
    }
  }
  private clearAudio() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.sources.clear();
    this.nextAudio = this.playback?.currentTime ?? 0;
    this.update({ speaking: false });
  }
  toggleMic() {
    const mic = !this.state.mic;
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = mic;
    });
    this.worklet?.port.postMessage(mic);
    this.update({ mic });
    this.mediaState();
  }
  toggleSpeaker() {
    const speaker = !this.state.speaker;
    if (this.output) this.output.gain.value = speaker ? 1 : 0;
    this.update({ speaker });
  }
  async toggleCamera() {
    if (this.stopped || this.cameraBusy) return;
    if (this.state.camera) {
      this.stream?.getVideoTracks().forEach((t) => {
        t.stop();
        this.stream?.removeTrack(t);
      });
      this.video.pause();
      this.video.srcObject = null;
      this.update({ camera: false });
      this.mediaState();
      return;
    }
    await this.acquireCamera(this.state.facing);
  }
  private async acquireCamera(facing: 'user' | 'environment') {
    this.cameraBusy = true;
    this.update({ cameraBusy: true });
    try {
      const video = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (this.stopped || !this.stream) {
        video.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = video.getVideoTracks()[0];
      // Some devices/browser fakes can hand back the same track; never stop the new one.
      this.stream
        .getVideoTracks()
        .filter((t) => t !== track)
        .forEach((t) => {
          t.stop();
          this.stream?.removeTrack(t);
        });
      if (!this.stream.getVideoTracks().includes(track)) this.stream.addTrack(track);
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
      if (this.stopped) {
        track.stop();
        return;
      }
      this.cameraUsed = true;
      this.onStream(this.stream);
      this.update({ camera: true, facing });
      this.mediaState();
    } catch {
      this.update({ message: 'Camera access wasn’t available. You can continue with voice.' });
    } finally {
      this.cameraBusy = false;
      this.update({ cameraBusy: false });
    }
  }
  async switchCamera() {
    if (!this.state.camera || this.cameraBusy || this.stopped) return;
    await this.acquireCamera(this.state.facing === 'user' ? 'environment' : 'user');
  }
  stop() {
    this.finish('Call ended. Your camera and microphone are off.', this.ready);
  }
  private finish(message: string, completed: boolean) {
    if (this.stopped) return;
    this.stopped = true;
    this.ready = false;
    if (this.timer) clearInterval(this.timer);
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.ws?.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.onStream(null);
    this.video.pause();
    this.video.srcObject = null;
    this.worklet?.disconnect();
    this.output?.disconnect();
    this.worklet?.port.close();
    this.source?.disconnect();
    void this.capture?.close().catch(() => {});
    this.clearAudio();
    void this.playback?.close().catch(() => {});
    // Resource cleanup sets stopped first; force the final notification through.
    this.update(
      {
        state: completed ? 'ended' : 'error',
        message,
        camera: false,
        cameraBusy: false,
        mic: false,
        speaking: false,
      },
      true,
    );
    this.onEnd({
      duration: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
      cameraUsed: this.cameraUsed,
      transcript: this.transcript,
      completed,
    });
  }
}
