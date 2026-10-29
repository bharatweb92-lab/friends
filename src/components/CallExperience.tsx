import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Captions,
  Check,
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  RotateCw,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ApiStatus, CallRecord, Friend, Message, Settings } from '../lib/types';
import { LiveCall } from '../lib/liveCall';
import type { LiveResult, LiveUpdate } from '../lib/liveCall';
import { uid } from '../lib/utils';
import { Avatar, IconButton, Modal } from './UI';
import { durationLabel } from './CallsPage';

type Props = {
  friend: Friend;
  mode: 'voice' | 'video';
  status: ApiStatus;
  settings: Settings;
  history: Message[];
  onClose: () => void;
  onSettings: () => void;
  onRecord: (record: CallRecord) => void;
};
export default function CallExperience({
  friend,
  mode,
  status,
  settings,
  history,
  onClose,
  onSettings,
  onRecord,
}: Props) {
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [update, setUpdate] = useState<LiveUpdate>({
    state: 'permission',
    mic: true,
    camera: false,
    cameraBusy: false,
    speaker: true,
    facing: 'user',
    speaking: false,
    message: 'Ready when you are.',
    caption: null,
  });
  const [transcript, setTranscript] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const call = useRef<LiveCall | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultRef = useRef<LiveResult | null>(null);
  const recordDone = useRef(false);
  const startedAt = useRef(Date.now());
  const captionRef = useRef<HTMLDivElement>(null);
  const onRecordRef = useRef(onRecord);
  onRecordRef.current = onRecord;
  const saveRecord = () => {
    if (recordDone.current || !resultRef.current) return;
    recordDone.current = true;
    const result = resultRef.current;
    onRecordRef.current({
      id: uid(),
      friendId: friend.id,
      mode,
      startedAt: startedAt.current,
      duration: result.duration,
      cameraUsed: result.cameraUsed,
      status: result.completed ? 'completed' : result.duration ? 'cancelled' : 'failed',
      ...(settings.saveTranscripts ? { transcript: result.transcript } : {}),
    });
  };
  const close = () => {
    call.current?.stop();
    saveRecord();
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(
    () => () => {
      call.current?.stop();
      saveRecord();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (update.state !== 'connected') return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [update.state]);
  useEffect(() => {
    const caption = update.caption;
    if (!caption) return;
    setTranscript((lines) => {
      const last = lines.at(-1);
      return last?.role === caption.role
        ? [...lines.slice(0, -1), { role: caption.role, text: last.text + caption.text }]
        : [...lines, caption];
    });
  }, [update.caption]);
  useEffect(() => {
    if (localVideo.current && streamRef.current?.getVideoTracks().length)
      localVideo.current.srcObject = streamRef.current;
  }, [update.camera, started]);
  useEffect(() => {
    captionRef.current?.scrollTo({ top: captionRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript, update.caption]);
  useEffect(() => {
    const unload = () => {
      call.current?.stop();
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, []);
  const start = () => {
    startedAt.current = Date.now();
    setStarted(true);
    const instance = new LiveCall(
      friend,
      mode,
      settings.name,
      history,
      (stream) => {
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
      },
      (next) => setUpdate(next),
      (result) => {
        resultRef.current = result;
        setTranscript([...result.transcript]);
      },
    );
    call.current = instance;
    void instance.start();
  };
  if (!started)
    return (
      <Modal
        title={
          mode === 'video'
            ? `A little face-to-face with ${friend.name}`
            : `A little catch-up with ${friend.name}`
        }
        subtitle={
          mode === 'video'
            ? 'Your world, shared with your AI friend.'
            : 'Sometimes a voice says it better.'
        }
        onClose={onClose}
        className="precall-modal"
      >
        <div className="precall-body">
          <div className="precall-avatar">
            <Avatar friend={friend} size={94} />
            <span>{mode === 'video' ? <Video size={18} /> : <Mic size={18} />}</span>
          </div>
          <h3>{friend.name}</h3>
          <p>{friend.role}</p>
          <div className="precall-features">
            <span>
              <Mic size={18} />
              <strong>Live voice</strong>
              <small>Talk naturally, interrupt anytime</small>
            </span>
            <span>
              <Camera size={18} />
              <strong>{mode === 'video' ? 'Camera sharing' : 'Camera optional'}</strong>
              <small>
                {mode === 'video' ? 'Front or rear camera' : 'Turn it on if you’d like'}
              </small>
            </span>
          </div>
          {status.geminiConnected ? (
            <>
              <div className="precall-consent">
                <ShieldCheck size={20} />
                <p>
                  Starting this call asks for microphone{mode === 'video' ? ' and camera' : ''}{' '}
                  permission. Audio and camera frames (about one per second) are sent to Gemini Live
                  while sharing is on. Your friend replies with voice and an illustrated avatar—not
                  a human video feed. No audio or video is recorded. Captions are saved only if
                  enabled in Settings. Google’s usage charges may apply.
                </p>
              </div>
              <label className="precall-transcript-option">
                <input
                  type="checkbox"
                  checked={showTranscript}
                  onChange={(e) => setShowTranscript(e.target.checked)}
                />
                Show live captions
              </label>
              <button className="primary-button full-width" onClick={start}>
                {mode === 'video' ? <Video size={18} /> : <Mic size={18} />}Allow devices & start
                call
                <ArrowRight size={16} />
              </button>
              <span className="precall-limit">
                <Check size={12} />
                You can mute, hide your camera, or hang up anytime.
              </span>
            </>
          ) : (
            <>
              <div className="precall-setup-note">
                <Sparkles size={21} />
                <p>
                  Connect your Gemini API key first. Live calls need a key with Gemini Live API
                  access.
                </p>
              </div>
              <button className="primary-button full-width" onClick={onSettings}>
                Connect Gemini in Settings
                <ArrowRight size={16} />
              </button>
              <span className="precall-limit">
                We won’t request device access until you start a connected call.
              </span>
            </>
          )}
        </div>
      </Modal>
    );
  const ended = update.state === 'ended' || update.state === 'error';
  return (
    <Modal
      title={`${mode === 'video' ? 'Video' : 'Voice'} call with ${friend.name}`}
      subtitle="Gemini Live · AI companion"
      onClose={() => closeRef.current()}
      className={`call-modal ${update.camera ? 'has-camera' : ''}`}
    >
      <div className="active-call">
        <div className="call-top-status">
          <span className={update.state === 'connected' ? 'call-connected-label' : ''}>
            <span className="tiny-dot" />
            {update.state === 'connected' ? 'Connected' : ended ? 'Call ended' : 'Connecting'}
            <span className="call-status-separator">·</span>
            {durationLabel(seconds)}
          </span>
          <span>
            <ShieldCheck size={13} />
            {update.camera ? 'Camera sharing on' : 'Camera off'}
          </span>
        </div>
        <div className="call-stage">
          <div className={`call-avatar-halo ${update.speaking ? 'speaking' : ''}`}>
            <Avatar friend={friend} size={132} />
          </div>
          <h2>{friend.name}</h2>
          <p className="call-state-message" role={update.state === 'error' ? 'alert' : 'status'}>
            {update.message}
          </p>
          <span className="call-ai-disclosure">
            <Sparkles size={12} />
            AI voice · illustrated avatar
          </span>
          {update.camera && (
            <div className="call-local-camera" data-facing={update.facing}>
              <video
                ref={(element) => {
                  localVideo.current = element;
                  call.current?.setPreview(element);
                }}
                autoPlay
                muted
                playsInline
                style={{
                  transform:
                    update.facing === 'user' && settings.mirrorCamera ? 'scaleX(-1)' : undefined,
                }}
              />
              <span>
                <Camera size={12} />
                You · sharing
              </span>
              <IconButton
                label="Switch front and rear camera"
                disabled={update.cameraBusy}
                onClick={() => void call.current?.switchCamera()}
              >
                <SwitchCamera size={17} />
              </IconButton>
            </div>
          )}
          {!update.camera && (update.state === 'permission' || update.state === 'connecting') && (
            <div className="call-permission-hint">
              <Mic size={16} />
              Check your browser’s permission prompt.
            </div>
          )}
        </div>
        {!ended && showTranscript && (
          <div className="live-transcript" ref={captionRef} aria-live="polite">
            <div className="transcript-heading">
              <Captions size={14} />
              Live captions
              <button onClick={() => setShowTranscript(false)} aria-label="Hide live captions">
                <ChevronDown size={15} />
              </button>
            </div>
            {transcript.length === 0 && !update.caption ? (
              <p className="transcript-placeholder">
                Your conversation will appear here as you talk.
              </p>
            ) : (
              transcript.map((line, i) => (
                <p key={i}>
                  <strong>{line.role === 'user' ? 'You' : friend.name}</strong>
                  {line.text}
                </p>
              ))
            )}
          </div>
        )}
        {ended ? (
          <div className="call-ended-actions">
            <button className="secondary-button" onClick={closeRef.current}>
              Back to Yaari
            </button>
            {update.state === 'error' && (
              <button className="primary-button" onClick={onSettings}>
                <X size={16} />
                Close & check settings
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="call-controls">
              <div>
                <IconButton
                  label={update.mic ? 'Mute microphone' : 'Unmute microphone'}
                  className={!update.mic ? 'control-off' : ''}
                  onClick={() => call.current?.toggleMic()}
                >
                  {update.mic ? <Mic size={23} /> : <MicOff size={23} />}
                </IconButton>
                <span>{update.mic ? 'Mute' : 'Unmute'}</span>
              </div>
              <div>
                <IconButton
                  label={update.camera ? 'Turn camera off' : 'Turn camera on'}
                  className={!update.camera ? 'control-off' : ''}
                  disabled={update.cameraBusy || update.state !== 'connected'}
                  onClick={() => void call.current?.toggleCamera()}
                >
                  {update.camera ? <Video size={23} /> : <VideoOff size={23} />}
                </IconButton>
                <span>{update.camera ? 'Camera off' : 'Camera on'}</span>
              </div>
              <div>
                <IconButton
                  label={update.speaker ? 'Mute friend audio' : 'Unmute friend audio'}
                  className={!update.speaker ? 'control-off' : ''}
                  onClick={() => call.current?.toggleSpeaker()}
                >
                  {update.speaker ? <Volume2 size={23} /> : <VolumeX size={23} />}
                </IconButton>
                <span>{update.speaker ? 'Speaker' : 'Muted'}</span>
              </div>
              <div>
                <IconButton
                  label={showTranscript ? 'Hide captions' : 'Show captions'}
                  onClick={() => setShowTranscript(!showTranscript)}
                >
                  <Captions size={23} />
                </IconButton>
                <span>Captions</span>
              </div>
              <div>
                <IconButton
                  label="End call"
                  className="hangup-button"
                  onClick={() => call.current?.stop()}
                >
                  <PhoneOff size={24} />
                </IconButton>
                <span>End call</span>
              </div>
            </div>
            <div className="call-bottom-note">
              <ShieldCheck size={12} />
              {update.mic ? 'Microphone is sharing' : 'Microphone is muted'}
              <span>·</span>
              {update.camera ? 'Camera is sharing' : 'Camera is off'}
              <span>·</span>
              <RotateCw size={11} />
              15-minute session limit
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
