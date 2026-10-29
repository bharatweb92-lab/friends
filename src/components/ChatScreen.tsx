import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  Info,
  MoreVertical,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  X,
  BellOff,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import Sidebar from './Sidebar';
import type { ChatFilter } from './Sidebar';
import ProfilePanel from './ProfilePanel';
import MessageBubble from './MessageBubble';
import Composer from './Composer';
import { Avatar, IconButton, Modal } from './UI';
import { ConfirmDialog, NewChatDialog } from './Dialogs';
import { FRIENDS } from '../lib/store';
import type { useYaari } from '../lib/useYaari';
import { downloadFile, formatTime } from '../lib/utils';
import type { FriendId, Message } from '../lib/types';

type Dialog = 'new' | 'clear' | 'reset' | null;
type ChatController = ReturnType<typeof useYaari>;

export default function ChatScreen({
  chat,
  onSettings,
  onCall,
  toast: setToast,
  mobileChatOpen,
  setMobileChatOpen,
  filter,
  setFilter,
}: {
  chat: ChatController;
  onSettings: () => void;
  onCall: (friend: import('../lib/types').Friend, mode: 'voice' | 'video') => void;
  toast: (message: string) => void;
  mobileChatOpen: boolean;
  setMobileChatOpen: (open: boolean) => void;
  filter: ChatFilter;
  setFilter: (filter: ChatFilter) => void;
}) {
  const { state, activeId, pending, errors, apiStatus } = chat;
  const friend = FRIENDS.find((f) => f.id === activeId)!;
  const messages = state.conversations[activeId];
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [profileOpen, setProfileOpen] = useState(() => window.innerWidth >= 1180);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [imageView, setImageView] = useState<Message | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chatSearchRef = useRef<HTMLInputElement>(null);
  const previousActive = useRef(activeId);
  const previousLength = useRef(messages.length);
  const matches = chatSearch.trim()
    ? messages.filter((m) => m.text.toLowerCase().includes(chatSearch.trim().toLowerCase()))
    : [];
  const hasRealMessages = messages.some((m) => !m.sample);

  useEffect(() => {
    if (chat.storageError)
      setToast(
        'Device storage is full or unavailable. New messages may not survive a refresh. Export your chats or remove attachments.',
      );
  }, [chat.storageError]);
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setHeaderMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHeaderMenu(false);
        setChatSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  useEffect(() => {
    const changedFriend = previousActive.current !== activeId;
    const element = scrollRef.current;
    if (
      element &&
      (changedFriend || messages.length > previousLength.current || !hasRealMessages)
    ) {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: changedFriend ? 'instant' : 'smooth',
      });
      setShowScrollButton(false);
    }
    if (changedFriend) {
      setChatSearchOpen(false);
      setChatSearch('');
      setHeaderMenu(false);
    }
    previousActive.current = activeId;
    previousLength.current = messages.length;
  }, [activeId, messages.length, pending[activeId], hasRealMessages]);
  useEffect(() => {
    if (chatSearchOpen) chatSearchRef.current?.focus();
  }, [chatSearchOpen]);
  useEffect(() => {
    if (!matches.length) return;
    const message = matches[searchIndex % matches.length];
    const element = scrollRef.current?.querySelector(`[data-message-id="${message.id}"]`);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [chatSearch, searchIndex, activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const selectFriend = (id: FriendId) => {
    chat.selectFriend(id);
    setMobileChatOpen(true);
    setDialog(null);
  };
  const changeFilter = (value: ChatFilter) => {
    setFilter(value);
    if (window.innerWidth <= 760) setMobileChatOpen(false);
  };
  const exportChat = () => {
    const lines = [
      `YAARI — A conversation with ${friend.name}`,
      `${friend.name} is a fictional AI companion. ${apiStatus.mode === 'demo' ? 'This chat may include demo replies.' : 'Replies are AI-generated.'}`,
      '',
      ...messages.map(
        (m) =>
          `[${new Date(m.createdAt).toLocaleString('en-IN')}] ${m.role === 'user' ? state.settings.name : friend.name}: ${m.text}${m.attachment ? `\n[Attachment: ${m.attachment.name} — not included in export]` : ''}`,
      ),
    ];
    downloadFile(
      lines.join('\n\n'),
      `yaari-${friend.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`,
    );
    setToast('A little memory, saved. Your conversation has been exported.');
    setHeaderMenu(false);
  };
  const openSearch = () => {
    setChatSearchOpen(true);
    setHeaderMenu(false);
    setProfileOpen(window.innerWidth >= 1180 ? profileOpen : false);
  };
  const speak = (message: Message) => {
    if (!('speechSynthesis' in window)) {
      setToast('Read aloud isn’t supported in this browser. Try Chrome or Safari.');
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingId === message.id) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = /[\u0900-\u097F]/.test(message.text) ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => {
      setSpeakingId(null);
      setToast('Audio isn’t available for this message right now.');
    };
    setSpeakingId(message.id);
    window.speechSynthesis.speak(utterance);
  };
  const askClear = () => {
    if (pending[activeId]) {
      setToast('Let your friend finish their reply before clearing this chat.');
      return;
    }
    setDialog('clear');
    setHeaderMenu(false);
  };

  return (
    <>
      <div
        className={`workspace ${mobileChatOpen ? 'mobile-chat-open' : ''} ${profileOpen ? 'profile-is-open' : ''}`}
      >
        <Sidebar
          state={state}
          activeId={activeId}
          filter={filter}
          query={query}
          onQuery={setQuery}
          onFilter={changeFilter}
          onSelect={selectFriend}
          onNew={() => setDialog('new')}
          onSettings={() => onSettings()}
        />
        <main className="chat-panel" aria-label={`Conversation with ${friend.name}`}>
          <header className="chat-header">
            <IconButton
              label="Back to conversations"
              className="mobile-back"
              onClick={() => setMobileChatOpen(false)}
            >
              <ArrowLeft size={22} />
            </IconButton>
            <button
              className="chat-person"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label={`View ${friend.name}'s profile`}
            >
              <Avatar friend={friend} size={44} online />
              <span>
                <strong>
                  {friend.name}
                  <span className="header-ai-label">AI FRIEND</span>
                </strong>
                <small>
                  <span className="header-online-dot" />
                  {pending[activeId] ? 'Typing a little something…' : 'Online. And in your corner.'}
                </small>
              </span>
            </button>
            <div className="chat-header-actions">
              <IconButton
                label="Search this conversation"
                className="header-search"
                onClick={openSearch}
              >
                <Search size={20} />
              </IconButton>
              <span className="header-divider" />
              <IconButton
                label={`Voice call ${friend.name}`}
                onClick={() => onCall(friend, 'voice')}
              >
                <Phone size={20} />
              </IconButton>
              <IconButton
                label={`Video call ${friend.name}`}
                className="video-button"
                onClick={() => onCall(friend, 'video')}
              >
                <Video size={21} />
              </IconButton>
              <div className="header-menu-wrap" ref={menuRef}>
                <IconButton
                  label="Conversation menu"
                  onClick={() => setHeaderMenu(!headerMenu)}
                  aria-expanded={headerMenu}
                >
                  <MoreVertical size={21} />
                </IconButton>
                {headerMenu && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => {
                        setProfileOpen(!profileOpen);
                        setHeaderMenu(false);
                      }}
                    >
                      <Info size={16} />
                      Friend profile
                    </button>
                    <button onClick={openSearch}>
                      <Search size={16} />
                      Search conversation
                    </button>
                    <button
                      onClick={() => {
                        chat.toggleMute(activeId);
                        setHeaderMenu(false);
                      }}
                    >
                      <BellOff size={16} />
                      {state.muted.includes(activeId)
                        ? 'Unmute notifications'
                        : 'Mute notifications'}
                    </button>
                    <button onClick={exportChat}>
                      <Download size={16} />
                      Export conversation
                    </button>
                    <button className="danger-text" onClick={askClear}>
                      <Trash2 size={16} />
                      Clear conversation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          {chatSearchOpen && (
            <div className="conversation-search">
              <Search size={17} />
              <input
                ref={chatSearchRef}
                placeholder={`Find something in your chat with ${friend.name}`}
                aria-label="Search in this conversation"
                value={chatSearch}
                onChange={(e) => {
                  setChatSearch(e.target.value);
                  setSearchIndex(0);
                }}
              />
              <span>
                {chatSearch
                  ? matches.length
                    ? `${(searchIndex % matches.length) + 1} of ${matches.length}`
                    : 'No matches'
                  : ''}
              </span>
              <IconButton
                label="Previous search result"
                disabled={!matches.length}
                onClick={() => setSearchIndex((i) => (i - 1 + matches.length) % matches.length)}
              >
                <ChevronUp size={17} />
              </IconButton>
              <IconButton
                label="Next search result"
                disabled={!matches.length}
                onClick={() => setSearchIndex((i) => (i + 1) % matches.length)}
              >
                <ChevronDown size={17} />
              </IconButton>
              <IconButton
                label="Close conversation search"
                onClick={() => {
                  setChatSearchOpen(false);
                  setChatSearch('');
                }}
              >
                <X size={17} />
              </IconButton>
            </div>
          )}
          <div
            className="chat-scroll"
            ref={scrollRef}
            onScroll={() => {
              const e = scrollRef.current;
              if (e) setShowScrollButton(e.scrollHeight - e.scrollTop - e.clientHeight > 250);
            }}
          >
            <div className="conversation-intro">
              <span className="intro-line" />
              <Sparkles size={13} />
              <span>A little less alone. A little more you.</span>
              <span className="intro-line" />
            </div>
            <div className="date-divider">
              <span>
                {messages.length &&
                new Date(messages[0].createdAt).toDateString() === new Date().toDateString()
                  ? 'Today'
                  : messages.length
                    ? new Date(messages[0].createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'A new beginning'}
              </span>
            </div>
            {!hasRealMessages && (
              <div className="welcome-note">
                <span className="welcome-heart">
                  <Heart size={17} />
                </span>
                <h2>
                  {messages.length
                    ? `A little catch-up with ${friend.name}.`
                    : `Every good yaari starts with a hello.`}
                </h2>
                <p>{messages.length ? friend.tagline : friend.greeting}</p>
                <span className="sample-label">
                  {messages.length
                    ? 'A sample conversation to get you started'
                    : 'Your friend is an AI companion. The warmth is always here.'}
                </span>
              </div>
            )}
            <div
              className="messages"
              role="log"
              aria-label="Chat messages"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onReact={(reaction) => chat.reactToMessage(activeId, message.id, reaction)}
                  onImage={() => setImageView(message)}
                  onToast={setToast}
                  highlight={chatSearch}
                  speakingId={speakingId}
                  onSpeak={() => speak(message)}
                />
              ))}
            </div>
            {pending[activeId] && (
              <div className="typing-row" role="status">
                <div className="typing-bubble">
                  <span />
                  <span />
                  <span />
                </div>
                <small>{friend.name} is typing</small>
              </div>
            )}
            {errors[activeId] && (
              <div className="chat-error" role="alert">
                <AlertCircle size={17} />
                <p>{errors[activeId]}</p>
                <button onClick={() => void chat.retry(activeId)}>
                  <RotateCw size={14} />
                  Try again
                </button>
              </div>
            )}
            <div className="chat-bottom-spacer" />
          </div>
          {showScrollButton && (
            <IconButton
              label="Scroll to latest message"
              className="scroll-latest"
              onClick={() =>
                scrollRef.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: 'smooth',
                })
              }
            >
              <ArrowDown size={20} />
            </IconButton>
          )}
          {!pending[activeId] && !chatSearchOpen && (
            <div className="conversation-starters">
              <span>
                <Sparkles size={13} />A little nudge
              </span>
              <div>
                {friend.suggestions.map((suggestion) => (
                  <button key={suggestion} onClick={() => chat.sendMessage(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Composer
            friend={friend}
            disabled={!!pending[activeId]}
            onSend={chat.sendMessage}
            onToast={setToast}
            recordingRequest={0}
            onMode={() => onSettings()}
            mode={apiStatus.mode}
            provider={apiStatus.provider}
          />
          <div className="chat-security-note">
            <ShieldCheck size={11} />
            <span>
              {apiStatus.mode === 'demo'
                ? 'Just a little preview of connection. You’re chatting with demo AI friends.'
                : apiStatus.provider === 'gemini'
                  ? 'AI-generated replies can be imperfect. Messages and sent photos are shared with Gemini.'
                  : 'AI-generated replies can be imperfect. Message text and attachment descriptions are shared with your provider; photo contents stay local.'}
            </span>
          </div>
        </main>
        {profileOpen && (
          <>
            <button
              className="profile-scrim"
              aria-label="Close profile overlay"
              onClick={() => setProfileOpen(false)}
            />
            <ProfilePanel
              friend={friend}
              favorite={state.favorites.includes(activeId)}
              muted={state.muted.includes(activeId)}
              messages={messages}
              onClose={() => setProfileOpen(false)}
              onFavorite={() => chat.toggleFavorite(activeId)}
              onMute={() => chat.toggleMute(activeId)}
              onSearch={openSearch}
              onExport={exportChat}
              onClear={askClear}
              onImage={setImageView}
            />
          </>
        )}
      </div>
      {dialog === 'new' && (
        <NewChatDialog onSelect={(f) => selectFriend(f.id)} onClose={() => setDialog(null)} />
      )}
      {dialog === 'clear' && (
        <ConfirmDialog
          title={`Clear your chat with ${friend.name}?`}
          description="This removes the messages and attachments in this conversation from this device. Save a copy first if there’s something you’d like to keep."
          onClose={() => setDialog(null)}
          onConfirm={() => {
            if (chat.clearChat(activeId)) {
              setDialog(null);
              setToast('A fresh start. Your conversation has been cleared.');
            } else setToast('Please wait for the current reply to finish.');
          }}
        />
      )}
      {dialog === 'reset' && (
        <ConfirmDialog
          title="A completely fresh start?"
          description="This deletes all four conversations, attachments, favourites, and mute preferences on this device. Your display name and appearance settings will stay."
          label="Reset all chats"
          onClose={() => onSettings()}
          onConfirm={() => {
            if (chat.resetAll()) {
              setDialog(null);
              setToast('A fresh page. All conversations have been reset.');
            } else setToast('Please wait for your friends to finish replying.');
          }}
        />
      )}
      {imageView?.attachment && (
        <Modal
          title={imageView.attachment.name}
          subtitle={`A little moment shared at ${formatTime(imageView.createdAt)}`}
          onClose={() => setImageView(null)}
          className="image-modal"
        >
          <img
            className="full-image"
            src={imageView.attachment.dataUrl}
            alt={imageView.attachment.name}
          />
          <footer className="modal-footer">
            <a
              className="primary-button"
              href={imageView.attachment.dataUrl}
              download={imageView.attachment.name}
            >
              <Download size={16} />
              Save photo
            </a>
          </footer>
        </Modal>
      )}
      );
    </>
  );
}
