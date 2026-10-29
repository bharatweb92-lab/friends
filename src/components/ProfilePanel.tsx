import {
  X,
  Heart,
  Bell,
  BellOff,
  MapPin,
  Search,
  Download,
  Trash2,
  ChevronRight,
  Image,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { Friend, Message } from '../lib/types';
import { Avatar, IconButton } from './UI';

type Props = {
  friend: Friend;
  favorite: boolean;
  muted: boolean;
  messages: Message[];
  onClose: () => void;
  onFavorite: () => void;
  onMute: () => void;
  onSearch: () => void;
  onExport: () => void;
  onClear: () => void;
  onImage: (message: Message) => void;
};
export default function ProfilePanel({
  friend,
  favorite,
  muted,
  messages,
  onClose,
  onFavorite,
  onMute,
  onSearch,
  onExport,
  onClear,
  onImage,
}: Props) {
  const photos = messages
    .filter((m) => m.attachment?.kind === 'image')
    .slice(-4)
    .reverse();
  return (
    <aside className="profile-panel" aria-label={`${friend.name}'s profile`}>
      <header className="profile-header">
        <h2>A little about your friend</h2>
        <IconButton label="Close friend profile" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </header>
      <div className="profile-scroll">
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <Avatar friend={friend} size={112} />
            <span className="profile-sparkle">
              <Sparkles size={17} />
            </span>
          </div>
          <h2>
            {friend.name}
            <span className="ai-badge">AI</span>
          </h2>
          <p>
            <MapPin size={13} /> {friend.city}, India
          </p>
          <span className="profile-tagline">{friend.tagline}</span>
          <div className="profile-quick-actions">
            <button
              className={favorite ? 'is-favorite' : ''}
              onClick={onFavorite}
              aria-pressed={favorite}
            >
              <Heart size={19} fill={favorite ? 'currentColor' : 'none'} />
              {favorite ? 'Favourite' : 'Add favourite'}
            </button>
            <button onClick={onMute} aria-pressed={muted}>
              {muted ? <BellOff size={19} /> : <Bell size={19} />}
              {muted ? 'Muted' : 'Sound on'}
            </button>
          </div>
        </div>
        <section className="profile-section about-section">
          <h3>MEET {friend.name.toUpperCase()}</h3>
          <p>{friend.bio}</p>
          <div className="interest-tags">
            {friend.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>
        <section className="profile-section shared-section">
          <div className="section-heading">
            <h3>OUR LITTLE COLLECTION</h3>
            <span>{photos.length}</span>
          </div>
          {photos.length ? (
            <div className="shared-photos">
              {photos.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onImage(m)}
                  aria-label={`View ${m.attachment!.name}`}
                >
                  <img src={m.attachment!.dataUrl} alt={m.attachment!.name} />
                </button>
              ))}
            </div>
          ) : (
            <button className="shared-empty" onClick={onSearch}>
              <span>
                <Image size={23} strokeWidth={1.4} />
              </span>
              <div>
                <strong>Memories start with a hello</strong>
                <p>Photos you share will find a home here.</p>
              </div>
            </button>
          )}
        </section>
        <div className="profile-actions">
          <button onClick={onSearch}>
            <Search size={17} />
            Search in conversation
            <ChevronRight size={15} />
          </button>
          <button onClick={onExport}>
            <Download size={17} />
            Save this conversation
            <ChevronRight size={15} />
          </button>
          <button className="danger-text" onClick={onClear}>
            <Trash2 size={17} />
            Clear conversation
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="profile-privacy">
          <ShieldCheck size={19} />
          <p>
            Your chats are saved on this device.
            <br />
            <span>AI companions, not human substitutes.</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
