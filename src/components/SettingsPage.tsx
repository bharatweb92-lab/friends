import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mic,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Unplug,
  Volume2,
  Video,
  X,
} from 'lucide-react';
import type { Settings } from '../lib/types';
import type { GeminiConnection } from '../lib/connection';
import { Toggle } from './UI';

type Props = {
  settings: Settings;
  connection: GeminiConnection;
  onSave: (settings: Settings) => void;
  onReset: () => void;
  onClearCalls: () => void;
  onToast: (message: string) => void;
};
export default function SettingsPage({
  settings,
  connection,
  onSave,
  onReset,
  onClearCalls,
  onToast,
}: Props) {
  const [draft, setDraft] = useState(settings);
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [deviceBusy, setDeviceBusy] = useState(false);
  const deviceRequest = useRef(0);
  const [deviceStream, setDeviceStream] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const { status, busy, error } = connection;
  useEffect(() => {
    setDraft(settings);
  }, [settings]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      deviceRequest.current++;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (video.current) video.current.srcObject = deviceStream;
  }, [deviceStream]);
  const stopTest = () => {
    deviceRequest.current++;
    setDeviceBusy(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setDeviceStream(null);
    setTesting(false);
  };
  const testDevices = async () => {
    if (deviceBusy) return;
    const request = ++deviceRequest.current;
    setDeviceBusy(true);
    setDeviceError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Device access needs HTTPS and a supported browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (!mounted.current || request !== deviceRequest.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setDeviceStream(stream);
      setTesting(true);
    } catch (e) {
      setDeviceError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Permission was denied. Allow camera and microphone in your browser’s site settings.'
          : e instanceof Error
            ? e.message
            : 'Could not access your camera and microphone.',
      );
    } finally {
      if (mounted.current && request === deviceRequest.current) setDeviceBusy(false);
    }
  };
  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = key.trim();
    if (await connection.connect(value)) {
      setKey('');
      onToast('Gemini connected. Your friends are ready to chat and call.');
    }
  };
  return (
    <main className="page settings-page">
      <header className="page-topbar">
        <span className="mobile-wordmark">yaari.</span>
        <span className="topbar-label">Make yourself at home</span>
        <span className="topbar-label">Your app. Your way.</span>
      </header>
      <div className="page-content settings-content">
        <div className="page-greeting">
          <span className="eyebrow">THE LITTLE DETAILS</span>
          <h1>Settings, made personal.</h1>
          <p>Your profile, your AI connection, and the things that make Yaari feel like you.</p>
        </div>
        <div className="settings-grid">
          <div className="settings-main-column">
            <section className="settings-card gemini-settings-card">
              <div className="settings-card-heading">
                <span className="settings-section-icon">
                  <Sparkles size={22} />
                </span>
                <div>
                  <h2>Gemini connection</h2>
                  <p>The voice and mind behind your AI friends.</p>
                </div>
                <span className={`status-label ${status.geminiConnected ? 'is-connected' : ''}`}>
                  {status.geminiConnected ? (
                    <>
                      <CheckCircle2 size={13} />
                      Connected
                    </>
                  ) : (
                    'Not connected'
                  )}
                </span>
              </div>
              {status.geminiConnected ? (
                <div className="connected-panel">
                  <span className="connected-check">
                    <Check size={25} />
                  </span>
                  <h3>You’re connected to Gemini.</h3>
                  <p>
                    Chat is connected. Voice/video calls also need Live API access and may incur
                    usage charges.
                  </p>
                  <div className="model-details">
                    <span>
                      Chat model<strong>{status.chatModel}</strong>
                    </span>
                    <span>
                      Live model<strong>{status.liveModel}</strong>
                    </span>
                  </div>
                  <p className="session-expiry">
                    {status.source === 'session'
                      ? `This browser’s key session expires ${new Date(status.expiresAt!).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}. Reconnect after expiry or a server restart.`
                      : 'Using the server’s configured Gemini key.'}
                  </p>
                  {status.source === 'session' && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={async () => {
                        if (await connection.disconnect())
                          onToast('Gemini disconnected. The key was removed from server memory.');
                      }}
                    >
                      {busy ? <LoaderCircle size={16} className="spin" /> : <Unplug size={16} />}
                      Disconnect & remove key
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={connect} className="gemini-key-form">
                  <div className="connection-intro">
                    <KeyRound size={19} />
                    <p>
                      Bring your own Gemini API key to unlock chat, voice calls, and camera sharing.
                    </p>
                  </div>
                  <label className="field-label" htmlFor="gemini-key">
                    GEMINI API KEY
                  </label>
                  <div className="key-input-wrap">
                    <input
                      id="gemini-key"
                      type={showKey ? 'text' : 'password'}
                      placeholder="Paste your Gemini API key"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={200}
                      required
                      disabled={busy}
                    />
                    <button
                      type="button"
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="key-form-footer">
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                      Get a key from Google AI Studio
                      <ArrowUpRight size={13} />
                    </a>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy || key.trim().length < 20}
                    >
                      {busy ? (
                        <>
                          <LoaderCircle size={16} className="spin" />
                          Checking key…
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} />
                          Connect Gemini
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
              <div className="key-security-note">
                <LockKeyhole size={16} />
                <p>
                  Your key is sent to this app’s server, not saved in browser storage. A random
                  session ID keeps your browser connected; the key stays in server memory and is
                  removed on disconnect or restart. Chat text, photos you send, and call media are
                  shared with Gemini. Google’s usage charges and privacy terms apply.
                </p>
              </div>
            </section>
            <section className="settings-card">
              <div className="settings-card-heading">
                <span className="settings-section-icon">
                  <Video size={21} />
                </span>
                <div>
                  <h2>Camera & microphone</h2>
                  <p>Check your setup before a call.</p>
                </div>
              </div>
              {testing ? (
                <div className="device-test">
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={video}
                    style={{ transform: draft.mirrorCamera ? undefined : 'none' }}
                  />
                  <span className="device-test-live">
                    <span className="tiny-dot" />
                    Local preview · not shared
                  </span>
                  <div className="device-test-details">
                    <span>
                      <Mic size={16} />
                      Microphone available
                    </span>
                    <span>
                      <Camera size={16} />
                      Camera available
                    </span>
                  </div>
                  <button className="secondary-button" onClick={stopTest}>
                    <X size={15} />
                    Stop camera & microphone
                  </button>
                </div>
              ) : (
                <div className="device-test-empty">
                  <div>
                    <Camera size={27} />
                    <Mic size={22} />
                  </div>
                  <p>
                    See a local preview and check permissions. Nothing is sent to Gemini during this
                    test.
                  </p>
                  <button
                    className="secondary-button"
                    disabled={deviceBusy}
                    onClick={() => void testDevices()}
                  >
                    {deviceBusy ? 'Checking devices…' : 'Test my camera & mic'}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {deviceError && (
                <p className="form-error" role="alert">
                  {deviceError}
                </p>
              )}
              <div className="settings-row">
                <div>
                  <strong>Mirror my front camera</strong>
                  <p>A familiar, mirror-like preview. Sharing is unaffected.</p>
                </div>
                <Toggle
                  label="Mirror my front camera"
                  checked={draft.mirrorCamera}
                  onChange={() => setDraft({ ...draft, mirrorCamera: !draft.mirrorCamera })}
                />
              </div>
              <div className="settings-row">
                <div>
                  <strong>Save call transcripts on this device</strong>
                  <p>Off by default. Audio and video are never recorded.</p>
                </div>
                <Toggle
                  label="Save call transcripts on this device"
                  checked={draft.saveTranscripts}
                  onChange={() => setDraft({ ...draft, saveTranscripts: !draft.saveTranscripts })}
                />
              </div>
            </section>
            <section className="settings-card privacy-settings">
              <div className="settings-card-heading">
                <span className="settings-section-icon">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <h2>Your data, your choice</h2>
                  <p>Simple, transparent, and in your hands.</p>
                </div>
              </div>
              <p>
                Chats, attachments, and call history are stored in this browser. They are not
                end-to-end encrypted. Anyone using this browser profile can read them. Export
                important conversations from their chat menu.
              </p>
              <p>
                During a call, microphone audio and camera frames go to Gemini only while sharing is
                on. Muting stops audio sharing; turning off the camera releases it. Hanging up
                releases both.
              </p>
              <div className="data-actions">
                <button className="secondary-button" onClick={onClearCalls}>
                  <Trash2 size={15} />
                  Clear call history
                </button>
                <button className="secondary-button danger-text" onClick={onReset}>
                  <Trash2 size={15} />
                  Reset conversations
                </button>
              </div>
            </section>
          </div>
          <aside className="settings-side-column">
            <section className="settings-card">
              <div className="settings-card-heading">
                <h2>Your profile</h2>
              </div>
              <div className="settings-profile-avatar">
                {draft.name === 'You' ? 'Y' : draft.name.slice(0, 1).toUpperCase()}
              </div>
              <label className="field-label" htmlFor="profile-name">
                WHAT SHOULD WE CALL YOU?
              </label>
              <input
                id="profile-name"
                className="text-input"
                value={draft.name}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Your name or nickname"
              />
              <p className="field-hint">Just a name for your little corner. No account needed.</p>
            </section>
            <section className="settings-card">
              <div className="settings-card-heading">
                <h2>Look & feel</h2>
              </div>
              <div className="theme-options">
                <button
                  className={draft.theme === 'light' ? 'selected' : ''}
                  onClick={() => setDraft({ ...draft, theme: 'light' })}
                >
                  <Sun size={20} />
                  <span>Daylight</span>
                  {draft.theme === 'light' && <Check size={14} />}
                </button>
                <button
                  className={draft.theme === 'dark' ? 'selected' : ''}
                  onClick={() => setDraft({ ...draft, theme: 'dark' })}
                >
                  <Moon size={20} />
                  <span>After hours</span>
                  {draft.theme === 'dark' && <Check size={14} />}
                </button>
              </div>
              <div className="settings-row">
                <Volume2 size={19} />
                <div>
                  <strong>Message sound</strong>
                  <p>A gentle note for new replies.</p>
                </div>
                <Toggle
                  label="Message sound"
                  checked={draft.sound}
                  onChange={() => setDraft({ ...draft, sound: !draft.sound })}
                />
              </div>
            </section>
            <div className="settings-save">
              <button
                className="primary-button full-width"
                onClick={() => onSave({ ...draft, name: draft.name.trim() || 'You' })}
              >
                <Check size={17} />
                Save preferences
              </button>
              <span>Looking good. Just like you.</span>
            </div>
            <div className="settings-safety-note">
              <ShieldCheck size={21} />
              <h3>A friend, not a professional.</h3>
              <p>
                Yaari’s friends are fictional AI companions, not therapists or emergency services.
                For urgent help in India, call 112. For mental health support, call TELE-MANAS at
                14416.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
