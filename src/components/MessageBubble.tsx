import { useState } from 'react';
import {
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Download,
  FileText,
  SmilePlus,
  Volume2,
  Square,
} from 'lucide-react';
import type { Message } from '../lib/types';
import { formatSize, formatTime } from '../lib/utils';
import { IconButton } from './UI';

type Props = {
  message: Message;
  onReact: (reaction: string) => void;
  onImage: () => void;
  onToast: (text: string) => void;
  highlight?: string;
  speakingId: string | null;
  onSpeak: () => void;
};
const reactions = ['❤️', '😂', '👍', '🥹', '🙌'];
export default function MessageBubble({
  message,
  onReact,
  onImage,
  onToast,
  highlight = '',
  speakingId,
  onSpeak,
}: Props) {
  const [menu, setMenu] = useState<'reactions' | 'actions' | null>(null);
  const own = message.role === 'user';
  const a = message.attachment;
  const renderText = () => {
    if (!highlight.trim()) return message.text;
    const index = message.text.toLowerCase().indexOf(highlight.toLowerCase());
    if (index === -1) return message.text;
    return (
      <>
        {message.text.slice(0, index)}
        <mark>{message.text.slice(index, index + highlight.length)}</mark>
        {message.text.slice(index + highlight.length)}
      </>
    );
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      onToast('Message copied.');
    } catch {
      onToast('Your browser couldn’t copy this message. You can select the text instead.');
    }
    setMenu(null);
  };
  return (
    <article
      className={`message-row ${own ? 'outgoing' : 'incoming'} ${menu ? 'menu-open' : ''}`}
      data-message-id={message.id}
      aria-label={`${own ? 'You' : 'Friend'} at ${formatTime(message.createdAt)}`}
    >
      <div className="message-bubble">
        {a?.kind === 'image' && (
          <button className="message-image" onClick={onImage} aria-label={`Open photo ${a.name}`}>
            <img src={a.dataUrl} alt={a.name} />
          </button>
        )}
        {a?.kind === 'audio' && (
          <div className="voice-note">
            <span className="voice-note-icon">
              <Volume2 size={21} />
            </span>
            <div>
              <span>Voice note</span>
              <audio
                controls
                src={a.dataUrl}
                preload="metadata"
                aria-label="Play your voice note"
              />
            </div>
          </div>
        )}
        {a?.kind === 'file' && (
          <a className="message-file" href={a.dataUrl} download={a.name}>
            <FileText size={27} />
            <span>
              <strong>{a.name}</strong>
              <small>{formatSize(a.size)}</small>
            </span>
            <Download size={18} />
          </a>
        )}
        {message.text && <p className="message-text">{renderText()}</p>}
        <span className="message-meta">
          <time dateTime={new Date(message.createdAt).toISOString()}>
            {formatTime(message.createdAt)}
          </time>
          {own &&
            (message.status === 'read' ? (
              <CheckCheck size={16} className="read-ticks" aria-label="Seen in demo" />
            ) : (
              <Check size={15} aria-label="Sent" />
            ))}
        </span>
        {message.reaction && (
          <button
            className="message-reaction"
            onClick={() => onReact(message.reaction!)}
            aria-label={`Remove ${message.reaction} reaction`}
          >
            {message.reaction}
          </button>
        )}
        <div className="message-tools">
          <IconButton
            label="React to message"
            onClick={() => setMenu(menu === 'reactions' ? null : 'reactions')}
          >
            <SmilePlus size={15} />
          </IconButton>
          <IconButton
            label="Message options"
            onClick={() => setMenu(menu === 'actions' ? null : 'actions')}
          >
            <ChevronDown size={15} />
          </IconButton>
        </div>
        {menu === 'reactions' && (
          <div className="reaction-picker">
            {reactions.map((reaction) => (
              <button
                key={reaction}
                onClick={() => {
                  onReact(reaction);
                  setMenu(null);
                }}
                aria-label={`React ${reaction}`}
              >
                {reaction}
              </button>
            ))}
          </div>
        )}
        {menu === 'actions' && (
          <div className="message-action-menu">
            {message.text && (
              <>
                <button onClick={copy}>
                  <Copy size={14} />
                  Copy text
                </button>
                <button
                  onClick={() => {
                    onSpeak();
                    setMenu(null);
                  }}
                >
                  {speakingId === message.id ? <Square size={14} /> : <Volume2 size={14} />}
                  {speakingId === message.id ? 'Stop listening' : 'Read aloud'}
                </button>
              </>
            )}
            {a && (
              <a href={a.dataUrl} download={a.name} onClick={() => setMenu(null)}>
                <Download size={14} />
                Save attachment
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
