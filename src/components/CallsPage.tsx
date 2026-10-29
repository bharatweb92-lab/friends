import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  Video,
  Clock3,
  ShieldCheck,
  Sparkles,
  Trash2,
  Mic,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { FRIENDS } from '../lib/store';
import type { ApiStatus, CallRecord, Friend } from '../lib/types';
import { Avatar } from './UI';
export const durationLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type Props = {
  calls: CallRecord[];
  status: ApiStatus;
  onCall: (friend: Friend, mode: 'voice' | 'video') => void;
  onSettings: () => void;
  onClear: () => void;
};
export default function CallsPage({ calls, status, onCall, onSettings, onClear }: Props) {
  const [tab, setTab] = useState<'all' | 'video' | 'voice'>('all');
  const filtered = calls.filter((c) => tab === 'all' || c.mode === tab);
  return (
    <main className="page calls-page">
      <header className="page-topbar">
        <span className="mobile-wordmark">yaari.</span>
        <span className="topbar-label">A little closer, one call at a time</span>
        <span className={`connection-pill ${status.geminiConnected ? 'connected' : ''}`}>
          <span className="tiny-dot" />
          {status.geminiConnected ? 'Gemini connected' : 'Gemini not connected'}
        </span>
      </header>
      <div className="page-content">
        <div className="page-greeting">
          <span className="eyebrow">BEYOND THE TEXT</span>
          <h1>Sometimes, it’s better to talk.</h1>
          <p>A familiar voice, a shared view, a real-time conversation with your AI friend.</p>
        </div>
        <div className="call-page-grid">
          <section>
            <div className="section-title">
              <h2>Start a conversation</h2>
              <span className="subtle-label">4 friends available</span>
            </div>
            <div className="call-friends-list">
              {FRIENDS.map((friend) => (
                <article key={friend.id}>
                  <Avatar friend={friend} size={53} online />
                  <div>
                    <h3>
                      {friend.name}
                      <span>AI</span>
                    </h3>
                    <p>{friend.role}</p>
                  </div>
                  <button
                    className="round-action"
                    aria-label={`Voice call ${friend.name}`}
                    onClick={() => onCall(friend, 'voice')}
                  >
                    <Phone size={19} />
                  </button>
                  <button
                    className="round-action filled"
                    aria-label={`Video call ${friend.name}`}
                    onClick={() => onCall(friend, 'video')}
                  >
                    <Video size={20} />
                  </button>
                </article>
              ))}
            </div>
            <div className="call-history-heading">
              <div className="section-title">
                <h2>Recent calls</h2>
                {calls.length > 0 && (
                  <button className="text-button danger-text" onClick={onClear}>
                    <Trash2 size={14} />
                    Clear history
                  </button>
                )}
              </div>
              <div className="chat-filters">
                {(['all', 'video', 'voice'] as const).map((value) => (
                  <button
                    key={value}
                    className={tab === value ? 'active' : ''}
                    onClick={() => setTab(value)}
                  >
                    {value === 'all' ? 'All calls' : value === 'video' ? 'Video' : 'Voice'}
                  </button>
                ))}
              </div>
              {filtered.length ? (
                <div className="call-history-list">
                  {filtered.map((call) => {
                    const friend = FRIENDS.find((f) => f.id === call.friendId)!;
                    return (
                      <article key={call.id}>
                        <Avatar friend={friend} size={43} />
                        <div>
                          <h3>{friend.name}</h3>
                          <p className={call.status === 'failed' ? 'danger-text' : ''}>
                            {call.status === 'failed' ? (
                              <ArrowDownLeft size={13} />
                            ) : (
                              <ArrowUpRight size={13} />
                            )}
                            {call.mode === 'video' ? 'Video' : 'Voice'} ·{' '}
                            {call.status === 'failed'
                              ? 'Not connected'
                              : durationLabel(call.duration)}
                            {call.cameraUsed && <Camera size={12} />}
                          </p>
                          {call.transcript?.length ? (
                            <details className="saved-transcript">
                              <summary>View saved transcript</summary>
                              {call.transcript.map((line, i) => (
                                <p key={i}>
                                  <strong>{line.role === 'user' ? 'You' : friend.name}: </strong>
                                  {line.text}
                                </p>
                              ))}
                            </details>
                          ) : null}
                        </div>
                        <time>
                          {new Date(call.startedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          <small>
                            {new Date(call.startedAt).toLocaleTimeString('en-IN', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </small>
                        </time>
                        <button
                          className="round-action"
                          aria-label={`Call ${friend.name} again`}
                          onClick={() => onCall(friend, call.mode)}
                        >
                          {call.mode === 'video' ? <Video size={18} /> : <Phone size={18} />}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-call-history">
                  <span>
                    <Clock3 size={27} strokeWidth={1.4} />
                  </span>
                  <h3>
                    {calls.length
                      ? 'No calls in this view yet.'
                      : 'Your first catch-up is waiting.'}
                  </h3>
                  <p>
                    {calls.length
                      ? 'Try another filter or start a new call.'
                      : 'Pick a friend above. Call history will appear here.'}
                  </p>
                </div>
              )}
            </div>
          </section>
          <aside className="call-info-column">
            <div className="call-feature-card">
              <span className="feature-icon">
                <Video size={29} strokeWidth={1.5} />
              </span>
              <span className="eyebrow">SHARE A LITTLE OF YOUR WORLD</span>
              <h2>
                “Look at this!”
                <br />
                Now, they can.
              </h2>
              <p>
                Show your friend the book you’re reading, the view from your window, or what you’re
                making for dinner.
              </p>
              <div className="camera-illustration">
                <div className="camera-frame">
                  <span className="camera-corner tl" />
                  <span className="camera-corner tr" />
                  <span className="camera-corner bl" />
                  <span className="camera-corner br" />
                  <span className="illustrated-plant">🪴</span>
                  <span className="camera-live">
                    <span />
                    Your camera
                  </span>
                </div>
                <span className="camera-chat">Oh, I can see it! 🌿</span>
              </div>
              <div className="call-feature-points">
                <span>
                  <Mic size={16} />
                  Natural, interruptible voice
                </span>
                <span>
                  <Camera size={16} />
                  Front or rear camera
                </span>
                <span>
                  <ShieldCheck size={16} />
                  Share only when you choose
                </span>
              </div>
            </div>
            <div className="call-connection-card">
              <Sparkles size={21} />
              <h3>
                {status.geminiConnected
                  ? 'Ready when you are.'
                  : 'One step before your first call.'}
              </h3>
              <p>
                {status.geminiConnected && status.liveAvailable
                  ? 'Gemini Live powers your calls. Provider usage charges may apply.'
                  : status.geminiConnected
                    ? status.liveUnavailableReason ||
                      'This deployment supports Gemini chat, but live calls need the Yaari Node WebSocket server.'
                    : 'Connect a Gemini API key with Live API access to start voice and video calls.'}
              </p>
              <button className="text-button" onClick={onSettings}>
                {status.geminiConnected ? 'Call settings' : 'Open Settings'}
                <ArrowRight size={14} />
              </button>
            </div>
            <p className="call-ai-note">
              Your friends are AI, not people on a video feed. Their illustrated avatar stays on
              screen while your camera is shared with Gemini. No call audio or video is recorded by
              Yaari.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
