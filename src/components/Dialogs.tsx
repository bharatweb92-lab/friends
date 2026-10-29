import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  LockKeyhole,
  Mic,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Volume2,
  Wifi,
  FlaskConical,
  Trash2,
  MessageCircle,
  Phone,
  Video,
} from 'lucide-react';
import { FRIENDS } from '../lib/store';
import type { ApiStatus, Friend, Settings } from '../lib/types';
import { Avatar, BrandMark, Modal, Toggle } from './UI';

export function SettingsDialog({
  settings,
  apiStatus,
  onSave,
  onReset,
  onClose,
}: {
  settings: Settings;
  apiStatus: ApiStatus;
  onSave: (settings: Settings) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  return (
    <Modal
      title="Make yourself at home"
      subtitle="Your little corner, just the way you like it."
      onClose={onClose}
      className="settings-modal"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...draft, name: draft.name.trim() || 'You' });
        }}
      >
        <div className="modal-body">
          <label className="field-label" htmlFor="display-name">
            WHAT SHOULD WE CALL YOU?
          </label>
          <input
            id="display-name"
            className="text-input"
            maxLength={40}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Your name or a nickname"
            autoComplete="given-name"
          />
          <div className="settings-row">
            <div>
              <strong>A little light or a little dark?</strong>
              <p>Choose your conversation backdrop.</p>
            </div>
          </div>
          <div className="theme-options">
            <button
              type="button"
              className={draft.theme === 'light' ? 'selected' : ''}
              onClick={() => setDraft({ ...draft, theme: 'light' })}
            >
              <Sun size={21} />
              <span>Daylight</span>
              {draft.theme === 'light' && <Check size={16} />}
            </button>
            <button
              type="button"
              className={draft.theme === 'dark' ? 'selected' : ''}
              onClick={() => setDraft({ ...draft, theme: 'dark' })}
            >
              <Moon size={21} />
              <span>After hours</span>
              {draft.theme === 'dark' && <Check size={16} />}
            </button>
          </div>
          <div className="settings-row">
            <Volume2 size={21} />
            <div>
              <strong>A gentle notification</strong>
              <p>A little sound when a reply arrives.</p>
            </div>
            <Toggle
              label="Notification sound"
              checked={draft.sound}
              onChange={() => setDraft({ ...draft, sound: !draft.sound })}
            />
          </div>
          <div className="ai-connection">
            <div className="connection-icon">
              {apiStatus.mode === 'live' ? <Wifi size={21} /> : <FlaskConical size={21} />}
            </div>
            <div>
              <strong>
                {apiStatus.mode === 'live' ? 'Live AI is connected' : 'You’re in demo mode'}
              </strong>
              <p>
                {apiStatus.mode === 'live'
                  ? 'Your conversations use the configured AI provider.'
                  : 'Try the vibe with handcrafted, context-aware sample replies. No API key needed.'}
              </p>
            </div>
            <span className="connection-badge">{apiStatus.mode === 'live' ? 'LIVE' : 'DEMO'}</span>
          </div>
          <details className="ai-setup">
            <summary>
              Want more spontaneous conversations?
              <ChevronRight size={15} />
            </summary>
            <p>
              Set <code>AI_API_KEY</code>, <code>AI_BASE_URL</code>, and <code>AI_MODEL</code> in
              the server’s <code>.env</code> file, then restart. Any OpenAI-compatible chat provider
              works. Keys stay on the server.
            </p>
            <p>
              In live mode, your display name and recent chat text are sent to that provider.
              Attachments remain local. See the project README for setup.
            </p>
          </details>
          <div className="settings-privacy">
            <LockKeyhole size={16} />
            <p>
              Chats are saved in this browser, not in a cloud account. Anyone using this browser
              profile can read them. Clear shared-device chats when you’re done.
            </p>
          </div>
          <button type="button" className="text-button danger-text" onClick={onReset}>
            <Trash2 size={15} />
            Reset all conversations
          </button>
        </div>
        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Not now
          </button>
          <button type="submit" className="primary-button">
            Save my preferences
            <Check size={16} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function NewChatDialog({
  onSelect,
  onClose,
}: {
  onSelect: (friend: Friend) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Who’s your people today?"
      subtitle="Different energies. The same warm welcome."
      onClose={onClose}
    >
      <div className="new-chat-list">
        {FRIENDS.map((friend) => (
          <button key={friend.id} onClick={() => onSelect(friend)}>
            <Avatar friend={friend} size={53} />
            <span>
              <strong>
                {friend.name}
                <small>{friend.city}</small>
              </strong>
              <p>{friend.role}</p>
            </span>
            <ArrowRight size={19} />
          </button>
        ))}
      </div>
      <div className="modal-note">
        <Heart size={15} />
        You don’t need a reason. Just pick a friend.
      </div>
    </Modal>
  );
}
export function AboutDialog({
  onClose,
  onSettings,
}: {
  onClose: () => void;
  onSettings: () => void;
}) {
  return (
    <Modal
      title="A little about yaari"
      subtitle="Your people, always. A little AI, a lot of heart."
      onClose={onClose}
    >
      <div className="modal-body about-dialog">
        <BrandMark />
        <p>
          Four fictional Indian friends, each with a different way of showing up. A space for the
          everyday things you feel like sharing.
        </p>
        <div className="about-feature">
          <Sparkles size={21} />
          <div>
            <strong>Personality, not pretending</strong>
            <p>
              These are AI companions, not real people. Demo mode uses sample replies; live mode
              uses your configured AI provider.
            </p>
          </div>
        </div>
        <div className="about-feature">
          <ShieldCheck size={21} />
          <div>
            <strong>A companion, not a professional</strong>
            <p>
              Yaari isn’t medical, legal, or crisis support. For urgent help in India, call 112. For
              mental health support, call TELE-MANAS at 14416.
            </p>
          </div>
        </div>
        <div className="about-feature">
          <MessageCircle size={21} />
          <div>
            <strong>Your chats, your device</strong>
            <p>
              Conversations and attachments are stored in this browser. They aren’t end-to-end
              encrypted. Export anything you’d like to keep.
            </p>
          </div>
        </div>
        <button className="primary-button full-width" onClick={onSettings}>
          See chat & AI settings
          <ArrowRight size={16} />
        </button>
        <small className="about-credit">
          An independent, WhatsApp-inspired interface. Not affiliated with WhatsApp or Meta.
        </small>
      </div>
    </Modal>
  );
}
export function CallDialog({
  friend,
  onClose,
  onVoiceNote,
}: {
  friend: Friend;
  onClose: () => void;
  onVoiceNote: () => void;
}) {
  return (
    <Modal title="A different kind of catching up" onClose={onClose}>
      <div className="modal-body call-dialog">
        <Avatar friend={friend} size={98} />
        <h3>Less ringing. More sharing.</h3>
        <p>
          {friend.name} is an AI friend, so live phone and video calls aren’t available. But you can
          send a voice note, or listen to any reply using “Read aloud” in its message menu.
        </p>
        <button className="primary-button" onClick={onVoiceNote}>
          <Mic size={18} />
          Leave a voice note
        </button>
        <div className="call-availability">
          <span>
            <Phone size={14} />
            Live calls unavailable
          </span>
          <span>
            <Video size={14} />
            Video unavailable
          </span>
        </div>
      </div>
    </Modal>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  label = 'Clear conversation',
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  label?: string;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body confirm-body">
        <span className="confirm-icon">
          <Trash2 size={25} />
        </span>
        <p>{description}</p>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" onClick={onClose}>
          Keep it
        </button>
        <button className="danger-button" onClick={onConfirm}>
          {label}
        </button>
      </footer>
    </Modal>
  );
}
