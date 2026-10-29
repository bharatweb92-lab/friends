import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Heart,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Video,
  Wifi,
} from 'lucide-react';
import { FRIENDS } from '../lib/store';
import type { ApiStatus, ChatState, Friend, FriendId, Section } from '../lib/types';
import { Avatar, BrandMark } from './UI';
import { messagePreview, shortTime } from '../lib/utils';

type Props = {
  state: ChatState;
  status: ApiStatus;
  onChat: (id: FriendId) => void;
  onCall: (friend: Friend, mode: 'voice' | 'video') => void;
  onNavigate: (section: Section) => void;
};
export default function Home({ state, status, onChat, onCall, onNavigate }: Props) {
  const recent = [...FRIENDS]
    .sort(
      (a, b) =>
        (state.conversations[b.id].at(-1)?.createdAt ?? 0) -
        (state.conversations[a.id].at(-1)?.createdAt ?? 0),
    )
    .slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <main className="page home-page">
      <header className="page-topbar">
        <span className="mobile-wordmark">yaari.</span>
        <span className="topbar-label">Your little corner of connection</span>
        <button
          className={`connection-pill ${status.geminiConnected ? 'connected' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="tiny-dot" />
          {status.geminiConnected ? 'Gemini connected' : 'Connect Gemini'}
          <ArrowUpRight size={13} />
        </button>
      </header>
      <div className="page-content home-content">
        <div className="page-greeting">
          <span className="eyebrow">
            {greeting}
            {state.settings.name !== 'You' ? `, ${state.settings.name}` : ', friend'}{' '}
            <span className="greeting-sun">☀️</span>
          </span>
          <h1>It’s a good day for a little hello.</h1>
          <p>Your people are right here. Pick a friend, share your day, just be you.</p>
        </div>
        <section className="home-hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <Sparkles size={14} /> MORE THAN A MESSAGE
            </span>
            <h2>
              A familiar voice.
              <br />A world of difference.
            </h2>
            <p>
              Talk it out, show them your world, or catch up over a virtual chai. Your AI friends
              are one call away.
            </p>
            <button className="hero-button" onClick={() => onCall(FRIENDS[0], 'video')}>
              <Video size={17} />
              Make a video call
              <ArrowUpRight size={16} />
            </button>
            <span className="hero-footnote">
              <ShieldCheck size={12} />
              Your camera is always in your control.
            </span>
          </div>
          <div className="hero-portrait">
            <span className="hero-orbit orbit-one" />
            <span className="hero-orbit orbit-two" />
            <div className="hero-friend main-friend">
              <Avatar friend={FRIENDS[0]} size={154} />
              <span>
                <span className="tiny-dot" />
                Aarav is here for you
              </span>
            </div>
            <div className="hero-friend second-friend">
              <Avatar friend={FRIENDS[1]} size={77} />
              <span className="mini-wave">
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="hero-friend third-friend">
              <Avatar friend={FRIENDS[2]} size={65} />
            </div>
            <div className="hero-chat-bubble">Arre, kya chal raha hai? ☕</div>
            <Heart className="hero-heart" size={22} />
            <Sparkles className="hero-sparkles" size={26} />
          </div>
        </section>
        <section className="friends-section">
          <div className="section-title">
            <div>
              <span className="eyebrow">GOOD COMPANY, ON DEMAND</span>
              <h2>Your kind of people</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('chats')}>
              All conversations
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="friend-card-grid">
            {FRIENDS.map((friend) => (
              <article className="home-friend-card" key={friend.id}>
                <div className="friend-card-top">
                  <Avatar friend={friend} size={58} online />
                  <span className="friend-ai-tag">AI FRIEND</span>
                </div>
                <h3>
                  {friend.name}
                  <span>{friend.city}</span>
                </h3>
                <p>{friend.role}</p>
                <div className="friend-card-tags">
                  <span>{friend.tags[0]}</span>
                  <span>{friend.tags[1]}</span>
                </div>
                <div className="friend-card-actions">
                  <button className="friend-message-button" onClick={() => onChat(friend.id)}>
                    <MessageCircle size={15} />
                    Message
                  </button>
                  <button
                    className="friend-call-button"
                    aria-label={`Call ${friend.name}`}
                    onClick={() => onCall(friend, 'voice')}
                  >
                    <Phone size={16} />
                  </button>
                  <button
                    className="friend-call-button"
                    aria-label={`Video call ${friend.name}`}
                    onClick={() => onCall(friend, 'video')}
                  >
                    <Video size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <div className="home-lower-grid">
          <section className="recent-section">
            <div className="section-title">
              <div>
                <h2>Pick up where you left off</h2>
              </div>
              <button
                className="icon-text-button"
                aria-label="Open all chats"
                onClick={() => onNavigate('chats')}
              >
                <ChevronRight size={19} />
              </button>
            </div>
            <div className="recent-list">
              {recent.map((friend) => {
                const last = state.conversations[friend.id].at(-1);
                return (
                  <button key={friend.id} onClick={() => onChat(friend.id)}>
                    <Avatar friend={friend} size={41} />
                    <span>
                      <strong>{friend.name}</strong>
                      <small>{messagePreview(last)}</small>
                    </span>
                    <time>{last ? shortTime(last.createdAt) : 'Say hi'}</time>
                    {state.unread[friend.id] > 0 && (
                      <span className="unread-badge">{state.unread[friend.id]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="gemini-home-card">
            <span className="gemini-symbol">
              <Sparkles size={27} />
            </span>
            <span className="eyebrow">A LITTLE MORE REAL</span>
            <h2>
              {status.geminiConnected
                ? 'Your friends, powered by Gemini.'
                : 'Let the conversation flow.'}
            </h2>
            <p>
              {status.geminiConnected
                ? 'Natural chats, real-time voice, and a friend who can see what you choose to share.'
                : 'Connect your Gemini API key to unlock natural chats and live voice and video calls.'}
            </p>
            <button className="text-button" onClick={() => onNavigate('settings')}>
              {status.geminiConnected ? (
                <>
                  <Check size={15} />
                  Manage connection
                </>
              ) : (
                <>
                  Connect your API key
                  <ArrowRight size={15} />
                </>
              )}
            </button>
            <span className="gemini-card-note">
              <Wifi size={12} />
              {status.geminiConnected ? status.liveModel : 'Your key. Your conversations.'}
            </span>
          </section>
        </div>
        <footer className="page-footer">
          <BrandMark small />
          <span>A little less alone. A little more you.</span>
          <button onClick={() => onNavigate('settings')}>Privacy & safety</button>
        </footer>
      </div>
    </main>
  );
}
