import { useEffect, useState } from 'react';
import {
  CheckCheck,
  CircleHelp,
  Home as HomeIcon,
  MessageCircle,
  Moon,
  Phone,
  Settings2,
  Sun,
  X,
} from 'lucide-react';
import Home from './components/Home';
import ChatScreen from './components/ChatScreen';
import CallsPage from './components/CallsPage';
import SettingsPage from './components/SettingsPage';
import CallExperience from './components/CallExperience';
import { AboutDialog, ConfirmDialog } from './components/Dialogs';
import { BrandMark, IconButton } from './components/UI';
import type { ChatFilter } from './components/Sidebar';
import { useYaari } from './lib/useYaari';
import { useGemini } from './lib/connection';
import type { Friend, FriendId, Section } from './lib/types';

const navigation = [
  { id: 'home' as const, label: 'Home', Icon: HomeIcon },
  { id: 'chats' as const, label: 'Chats', Icon: MessageCircle },
  { id: 'calls' as const, label: 'Calls', Icon: Phone },
  { id: 'settings' as const, label: 'Settings', Icon: Settings2 },
];
export default function App() {
  const connection = useGemini();
  const chat = useYaari(connection.status, connection.refresh);
  const [section, setSection] = useState<Section>('home');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [about, setAbout] = useState(false);
  const [confirm, setConfirm] = useState<'calls' | 'chats' | null>(null);
  const [call, setCall] = useState<{ friend: Friend; mode: 'voice' | 'video' } | null>(null);
  const unread = Object.values(chat.state.unread).reduce((a, b) => a + b, 0);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const navigate = (next: Section) => {
    setSection(next);
    if (next === 'chats') setMobileChatOpen(false);
  };
  const openChat = (id: FriendId) => {
    chat.selectFriend(id);
    setSection('chats');
    setMobileChatOpen(true);
  };
  const openCall = (friend: Friend, mode: 'voice' | 'video') => setCall({ friend, mode });
  return (
    <div
      className={`app-frame section-${section} ${section === 'chats' && mobileChatOpen ? 'in-mobile-conversation' : ''}`}
    >
      <nav className="nav-rail" aria-label="Main navigation">
        <button className="rail-brand" aria-label="Yaari home" onClick={() => navigate('home')}>
          <BrandMark />
        </button>
        <div className="rail-main">
          {navigation.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`rail-button ${section === id ? 'active' : ''}`}
              title={label}
              aria-label={label}
              aria-current={section === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={23} strokeWidth={1.8} />
              <span className="rail-label">{label}</span>
              {id === 'chats' && unread > 0 && <span className="rail-notification" />}
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <IconButton
            label={
              chat.state.settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
            onClick={() =>
              chat.updateSettings({
                theme: chat.state.settings.theme === 'light' ? 'dark' : 'light',
              })
            }
          >
            {chat.state.settings.theme === 'light' ? <Moon size={21} /> : <Sun size={21} />}
          </IconButton>
          <IconButton label="About Yaari and safety" onClick={() => setAbout(true)}>
            <CircleHelp size={22} />
          </IconButton>
          <span className="rail-divider" />
          <button
            className="rail-user"
            aria-label="Edit your profile"
            onClick={() => navigate('settings')}
          >
            {chat.state.settings.name === 'You' ? 'Y' : chat.state.settings.name[0].toUpperCase()}
          </button>
        </div>
      </nav>
      {section === 'home' && (
        <Home
          state={chat.state}
          status={connection.status}
          onChat={openChat}
          onCall={openCall}
          onNavigate={navigate}
        />
      )}
      {section === 'chats' && (
        <ChatScreen
          chat={chat}
          onSettings={() => navigate('settings')}
          onCall={openCall}
          toast={setToast}
          mobileChatOpen={mobileChatOpen}
          setMobileChatOpen={setMobileChatOpen}
          filter={filter}
          setFilter={setFilter}
        />
      )}
      {section === 'calls' && (
        <CallsPage
          calls={chat.state.calls}
          status={connection.status}
          onCall={openCall}
          onSettings={() => navigate('settings')}
          onClear={() => setConfirm('calls')}
        />
      )}
      {section === 'settings' && (
        <SettingsPage
          settings={chat.state.settings}
          connection={connection}
          onSave={(settings) => {
            chat.updateSettings(settings);
            setToast('Preferences saved. Make yourself at home.');
          }}
          onReset={() => setConfirm('chats')}
          onClearCalls={() => setConfirm('calls')}
          onToast={setToast}
        />
      )}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={section === id ? 'active' : ''}
            aria-label={label}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <span>
              <Icon size={21} strokeWidth={section === id ? 2.2 : 1.7} />
              {id === 'chats' && unread > 0 && <i>{unread}</i>}
            </span>
            {label}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          <span>{toast}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {about && (
        <AboutDialog
          onClose={() => setAbout(false)}
          onSettings={() => {
            setAbout(false);
            navigate('settings');
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === 'calls' ? 'Clear your call history?' : 'A completely fresh start?'}
          description={
            confirm === 'calls'
              ? 'This removes call history and any saved transcripts from this device. Your text conversations will stay.'
              : 'This deletes all conversations, attachments, favourites, and call history on this device. Your profile, appearance, and Gemini connection will stay.'
          }
          label={confirm === 'calls' ? 'Clear call history' : 'Reset all chats'}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === 'calls') {
              chat.clearCalls();
              setToast('Call history cleared.');
              setConfirm(null);
            } else if (chat.resetAll()) {
              chat.clearCalls();
              setToast('A fresh page. Your conversations were reset.');
              setConfirm(null);
            } else setToast('Please wait for your friends to finish replying.');
          }}
        />
      )}
      {call && (
        <CallExperience
          key={`${call.friend.id}-${call.mode}`}
          friend={call.friend}
          mode={call.mode}
          status={connection.status}
          settings={chat.state.settings}
          history={chat.state.conversations[call.friend.id]}
          onClose={() => setCall(null)}
          onSettings={() => {
            setCall(null);
            navigate('settings');
          }}
          onRecord={chat.addCall}
        />
      )}
    </div>
  );
}
