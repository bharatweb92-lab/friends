export type FriendId = 'aarav' | 'ananya' | 'kabir' | 'meera';
export type Role = 'user' | 'assistant';
export type Attachment = {
  kind: 'image' | 'audio' | 'file';
  name: string;
  mime: string;
  size: number;
  dataUrl: string;
};
export type Message = {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
  attachment?: Attachment;
  reaction?: string;
  status?: 'sent' | 'read';
  sample?: boolean;
};
export type Friend = {
  id: FriendId;
  name: string;
  city: string;
  role: string;
  tagline: string;
  bio: string;
  tags: string[];
  color: string;
  avatar: string;
  greeting: string;
  seed: { role: Role; text: string }[];
  suggestions: string[];
  unread: number;
};
export type Settings = {
  name: string;
  theme: 'light' | 'dark';
  sound: boolean;
  saveTranscripts: boolean;
  mirrorCamera: boolean;
};
export type CallRecord = {
  id: string;
  friendId: FriendId;
  mode: 'voice' | 'video';
  startedAt: number;
  duration: number;
  cameraUsed: boolean;
  status: 'completed' | 'failed' | 'cancelled';
  transcript?: { role: Role; text: string }[];
};
export type ChatState = {
  version: 1;
  conversations: Record<FriendId, Message[]>;
  unread: Record<FriendId, number>;
  favorites: FriendId[];
  muted: FriendId[];
  settings: Settings;
  calls: CallRecord[];
};
export type ApiStatus = {
  mode: 'demo' | 'live';
  provider: 'demo' | 'gemini' | 'openai';
  geminiConnected: boolean;
  liveAvailable: boolean;
  source?: 'session' | 'server' | 'none';
  chatModel?: string;
  liveModel?: string;
  expiresAt?: number;
};
export type Section = 'home' | 'chats' | 'calls' | 'settings';
