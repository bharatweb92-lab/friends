import {
  Search,
  SquarePen,
  ChevronDown,
  CheckCheck,
  Heart,
  MessageCircle,
  X,
  Sparkles,
  Settings2,
} from 'lucide-react';
import type { ChatState, Friend, FriendId } from '../lib/types';
import { FRIENDS } from '../lib/store';
import { Avatar, IconButton } from './UI';
import { messagePreview, shortTime } from '../lib/utils';

export type ChatFilter = 'all' | 'unread' | 'favorites';
type Props = {
  state: ChatState;
  activeId: FriendId;
  filter: ChatFilter;
  query: string;
  onQuery: (query: string) => void;
  onFilter: (filter: ChatFilter) => void;
  onSelect: (id: FriendId) => void;
  onNew: () => void;
  onSettings: () => void;
};
export default function Sidebar({
  state,
  activeId,
  filter,
  query,
  onQuery,
  onFilter,
  onSelect,
  onNew,
  onSettings,
}: Props) {
  const filtered = FRIENDS.filter((friend) => {
    if (filter === 'unread' && !state.unread[friend.id]) return false;
    if (filter === 'favorites' && !state.favorites.includes(friend.id)) return false;
    const search = query.toLowerCase().trim();
    return (
      !search ||
      `${friend.name} ${friend.city} ${friend.role} ${state.conversations[friend.id].map((m) => m.text).join(' ')}`
        .toLowerCase()
        .includes(search)
    );
  });
  const unreadCount = FRIENDS.filter((f) => state.unread[f.id] > 0).length;
  return (
    <aside className="sidebar" aria-label="Friends and conversations">
      <div className="sidebar-heading">
        <div className="wordmark">
          yaari<span className="wordmark-dot">.</span>
          <span className="brand-caption">YOUR PEOPLE, ALWAYS.</span>
        </div>
        <IconButton label="Start a new chat" className="new-chat-button" onClick={onNew}>
          <SquarePen size={20} />
        </IconButton>
      </div>
      <div className="sidebar-intro">
        <h1>A little more connected.</h1>
        <p>Four friends. Endless conversations.</p>
      </div>
      <div className="search-field">
        <Search size={18} />
        <input
          aria-label="Search friends or messages"
          placeholder="Search a friend or a message"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <IconButton label="Clear search" onClick={() => onQuery('')}>
            <X size={15} />
          </IconButton>
        )}
      </div>
      <div className="chat-filters" aria-label="Filter conversations">
        {(['all', 'unread', 'favorites'] as const).map((value) => (
          <button
            key={value}
            className={filter === value ? 'active' : ''}
            onClick={() => onFilter(value)}
            aria-pressed={filter === value}
          >
            {value === 'all' ? 'All chats' : value === 'unread' ? 'Unread' : 'Favourites'}
            {value === 'unread' && unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
        ))}
      </div>
      <div className="list-label">
        <span>YOUR CONVERSATIONS</span>
        <span>{filtered.length}</span>
      </div>
      <div className="friend-list">
        {filtered.map((friend: Friend) => {
          const messages = state.conversations[friend.id];
          const last = messages.at(-1);
          return (
            <button
              key={friend.id}
              className={`friend-row ${activeId === friend.id ? 'selected' : ''}`}
              onClick={() => onSelect(friend.id)}
              aria-label={`Chat with ${friend.name}${state.unread[friend.id] ? `, ${state.unread[friend.id]} unread messages` : ''}`}
              aria-current={activeId === friend.id ? 'true' : undefined}
            >
              <Avatar friend={friend} size={51} online />
              <span className="friend-row-content">
                <span className="friend-row-top">
                  <strong>{friend.name}</strong>
                  <time className={state.unread[friend.id] ? 'unread-time' : ''}>
                    {last ? shortTime(last.createdAt) : 'Say hi'}
                  </time>
                </span>
                <span className="friend-role">{friend.role}</span>
                <span className="friend-row-bottom">
                  <span className="message-preview">
                    {last?.role === 'user' && <CheckCheck size={15} className="read-ticks" />}
                    {messagePreview(last)}
                  </span>
                  {state.unread[friend.id] > 0 ? (
                    <span className="unread-badge">{state.unread[friend.id]}</span>
                  ) : state.favorites.includes(friend.id) ? (
                    <Heart size={13} className="favorite-indicator" />
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty-list">
            {filter === 'favorites' ? <Heart size={28} /> : <Search size={28} />}
            <strong>
              {query
                ? 'No conversations found'
                : filter === 'unread'
                  ? 'All caught up!'
                  : 'Your favourite people'}
            </strong>
            <p>
              {query
                ? 'Try a name, city, or a word from your chat.'
                : filter === 'unread'
                  ? 'A little pause. We’ll be right here.'
                  : 'Tap the heart on a friend’s profile to keep them close.'}
            </p>
            <button
              className="text-button"
              onClick={() => {
                onFilter('all');
                onQuery('');
              }}
            >
              See all friends
            </button>
          </div>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="little-note">
          <span className="note-art">
            <MessageCircle size={33} strokeWidth={1.4} />
            <Heart size={16} fill="currentColor" />
          </span>
          <div>
            <strong>No “reason” needed.</strong>
            <p>A simple hello is a good place to start.</p>
          </div>
          <Sparkles className="note-sparkle" size={17} />
        </div>
        <button className="user-profile" onClick={onSettings}>
          <span className="user-avatar">
            {state.settings.name === 'You' ? 'Y' : state.settings.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>
              {state.settings.name === 'You' ? 'Your little corner' : state.settings.name}
            </strong>
            <small>
              <span className="tiny-dot" /> Just be yourself
            </small>
          </span>
          <Settings2 size={18} />
        </button>
        <div className="sidebar-footnote">
          Made for the little moments <Heart size={10} />
        </div>
      </div>
      <button
        className="mobile-filter-button"
        onClick={() => onFilter(filter === 'all' ? 'unread' : 'all')}
        aria-label="Toggle unread filter"
      >
        <ChevronDown size={14} />
      </button>
    </aside>
  );
}
