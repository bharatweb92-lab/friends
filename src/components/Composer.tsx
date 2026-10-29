import { useEffect, useRef, useState } from 'react';
import {
  Smile,
  Plus,
  Mic,
  Send,
  Image,
  FileText,
  X,
  Trash2,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import type { Attachment, Friend } from '../lib/types';
import { formatSize } from '../lib/utils';
import { IconButton } from './UI';

const emojis = [
  '😊',
  '💚',
  '😂',
  '🥹',
  '✨',
  '🙌',
  '☕',
  '🌿',
  '😎',
  '❤️',
  '🎶',
  '🌻',
  '👍',
  '🥰',
  '🎉',
  '🫶',
  '🤔',
  '😴',
  '🙏',
  '🔥',
  '🌸',
  '💪',
  '🫂',
  '☀️',
];
type Props = {
  friend: Friend;
  disabled: boolean;
  onSend: (text: string, attachment?: Attachment) => boolean;
  onToast: (message: string) => void;
  recordingRequest: number;
  onMode: () => void;
  mode: 'demo' | 'live';
};
async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error('Choose a file smaller than 5 MB so it can stay on this device.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This file couldn’t be opened. Try another.'));
    reader.readAsDataURL(file);
  });
  let finalUrl = dataUrl;
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('This image couldn’t be opened.'));
      img.src = dataUrl;
    });
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      finalUrl = canvas.toDataURL('image/webp', 0.8);
    }
  }
  if (finalUrl.length > 1_500_000)
    throw new Error(
      'This attachment is a little too large. Try a smaller image or a file under 1 MB.',
    );
  return {
    kind: file.type.startsWith('image/') ? 'image' : 'file',
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl: finalUrl,
  };
}

export default function Composer({
  friend,
  disabled,
  onSend,
  onToast,
  recordingRequest,
  onMode,
  mode,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [attachment, setAttachment] = useState<Attachment>();
  const [picker, setPicker] = useState<'emoji' | 'attach' | null>(null);
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [loadingFile, setLoadingFile] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);
  const mounted = useRef(true);
  const text = drafts[friend.id] ?? '';
  const setText = (value: string) => setDrafts((d) => ({ ...d, [friend.id]: value }));

  useEffect(() => {
    setAttachment(undefined);
    setPicker(null);
  }, [friend.id]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = 'auto';
      input.current.style.height = `${Math.min(input.current.scrollHeight, 110)}px`;
    }
  }, [text]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 60 && recorder.current?.state === 'recording') recorder.current.stop();
  }, [seconds]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setPicker(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicker(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const startRecording = async () => {
    if (recording || requestingMic || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onToast('Voice notes need microphone access in a supported browser over HTTPS.');
      return;
    }
    setRequestingMic(true);
    setPicker(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const mediaRecorder = new MediaRecorder(
        media,
        mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined,
      );
      recorder.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      cancelled.current = false;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setRecording(false);
        if (cancelled.current) return;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (blob.size > 1_000_000) {
          onToast('That voice note is too large to save. Try a shorter one.');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (mounted.current) {
            setAttachment({
              kind: 'audio',
              name: `Voice note.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
              mime: blob.type,
              size: blob.size,
              dataUrl: String(reader.result),
            });
            input.current?.focus();
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorder.onerror = () => {
        cancelled.current = true;
        media.getTracks().forEach((t) => t.stop());
        if (mounted.current) {
          setRecording(false);
          onToast('Recording stopped unexpectedly. Please try again.');
        }
      };
      setSeconds(0);
      mediaRecorder.start();
      setRecording(true);
    } catch {
      onToast(
        'Microphone access wasn’t available. Allow it in your browser settings to send a voice note.',
      );
    } finally {
      if (mounted.current) setRequestingMic(false);
    }
  };
  const firstRequest = useRef(recordingRequest);
  useEffect(() => {
    if (recordingRequest !== firstRequest.current) {
      firstRequest.current = recordingRequest;
      void startRecording();
    }
  }, [recordingRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if (disabled || loadingFile || recording || (!text.trim() && !attachment)) return;
    if (onSend(text, attachment)) {
      setText('');
      setAttachment(undefined);
      setPicker(null);
      input.current?.focus();
    }
  };
  const attach = async (file?: File) => {
    if (!file) return;
    setLoadingFile(true);
    setPicker(null);
    try {
      setAttachment(await fileToAttachment(file));
      input.current?.focus();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'This file couldn’t be attached.');
    } finally {
      setLoadingFile(false);
      if (imageInput.current) imageInput.current.value = '';
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  return (
    <div className="composer-area" ref={root}>
      {attachment && (
        <div className="attachment-preview">
          {attachment.kind === 'image' ? (
            <img src={attachment.dataUrl} alt="Attachment preview" />
          ) : attachment.kind === 'audio' ? (
            <Mic size={22} />
          ) : (
            <FileText size={22} />
          )}
          <div>
            <strong>{attachment.name}</strong>
            <span>{formatSize(attachment.size)} · Saved only on this device</span>
          </div>
          <IconButton label="Remove attachment" onClick={() => setAttachment(undefined)}>
            <X size={18} />
          </IconButton>
        </div>
      )}
      <div className={`composer ${recording ? 'is-recording' : ''}`}>
        {recording ? (
          <>
            <IconButton
              label="Cancel recording"
              className="cancel-recording"
              onClick={() => {
                cancelled.current = true;
                recorder.current?.stop();
              }}
            >
              <Trash2 size={21} />
            </IconButton>
            <div className="recording-status">
              <span className="recording-dot" />
              <strong>
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </strong>
              <span>Listening… make it a little hello.</span>
            </div>
            <IconButton
              label="Finish voice note"
              className="send-button"
              onClick={() => recorder.current?.stop()}
            >
              <Send size={20} />
            </IconButton>
          </>
        ) : (
          <>
            <div className="composer-tools">
              <IconButton
                label="Choose an emoji"
                className={picker === 'emoji' ? 'active' : ''}
                onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')}
                aria-expanded={picker === 'emoji'}
              >
                <Smile size={24} />
              </IconButton>
              <IconButton
                label="Attach a photo or file"
                className={picker === 'attach' ? 'active' : ''}
                onClick={() => setPicker(picker === 'attach' ? null : 'attach')}
                aria-expanded={picker === 'attach'}
                disabled={loadingFile}
              >
                {loadingFile ? <LoaderCircle className="spin" size={22} /> : <Plus size={25} />}
              </IconButton>
            </div>
            <textarea
              ref={input}
              rows={1}
              aria-label={`Message ${friend.name}`}
              placeholder={`Message ${friend.name}…`}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {text.trim() || attachment ? (
              <IconButton
                label="Send message"
                className="send-button"
                onClick={send}
                disabled={disabled || loadingFile}
              >
                <Send size={20} />
              </IconButton>
            ) : (
              <IconButton
                label={requestingMic ? 'Waiting for microphone' : 'Record a voice note'}
                className="mic-button"
                onClick={() => void startRecording()}
                disabled={disabled || requestingMic}
              >
                {requestingMic ? <LoaderCircle className="spin" size={22} /> : <Mic size={23} />}
              </IconButton>
            )}
          </>
        )}
        {picker === 'emoji' && (
          <div className="emoji-picker">
            <div className="picker-heading">
              A little expression<span>24</span>
            </div>
            <div>
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  aria-label={`Insert ${emoji}`}
                  onClick={() => {
                    setText((text + emoji).slice(0, 4000));
                    input.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        {picker === 'attach' && (
          <div className="attach-menu">
            <button onClick={() => imageInput.current?.click()}>
              <span className="attach-icon photo">
                <Image size={20} />
              </span>
              <span>
                <strong>Photo</strong>
                <small>A moment worth sharing</small>
              </span>
            </button>
            <button onClick={() => fileInput.current?.click()}>
              <span className="attach-icon document">
                <FileText size={20} />
              </span>
              <span>
                <strong>Document</strong>
                <small>Keep a little file here</small>
              </span>
            </button>
            <p>
              <ShieldCheck size={13} />
              Attachments stay on this device.
              <br />
              AI replies use your text, not file contents.
            </p>
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        ref={imageInput}
        className="visually-hidden"
        aria-label="Upload a photo"
        onChange={(e) => void attach(e.target.files?.[0])}
      />
      <input
        type="file"
        accept=".pdf,.txt,.md,.csv,.json"
        ref={fileInput}
        className="visually-hidden"
        aria-label="Upload a document"
        onChange={(e) => void attach(e.target.files?.[0])}
      />
      <div className="composer-footnote">
        <span>AI friends. Real warmth. A little space to be you.</span>
        <button onClick={onMode}>
          <span className={`mode-dot ${mode}`} />
          {mode === 'demo' ? 'Demo replies' : 'Live AI'}
          <span className="footnote-info">ⓘ</span>
        </button>
      </div>
    </div>
  );
}
