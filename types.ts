
// Global definition for PeerJS loaded via CDN
declare global {
  interface Window {
    Peer: any;
  }
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export enum SyncEventType {
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  SEEK = 'SEEK',
  SYNC_REQUEST = 'SYNC_REQUEST', // New user asking for current time
  SYNC_RESPONSE = 'SYNC_RESPONSE', // Host sending current time
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  META_DATA = 'META_DATA', // Duration check
  PROFILE_UPDATE = 'PROFILE_UPDATE' // Name and color sync
}

export interface UserProfile {
  name: string;
  color: string;
}

export interface SyncPayload {
  type: SyncEventType;
  timestamp?: number; // Current video time
  value?: string; // Chat message or other data
  duration?: number;
  profile?: UserProfile;
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'partner' | 'system' | 'ai';
  text: string;
  timestamp: number;
}

// Extension for AudioTracks API (Standard in Safari, Experimental in Chrome)
export interface AudioTrack {
  id: string;
  kind: string;
  label: string;
  language: string;
  enabled: boolean;
}

export interface AudioTrackList extends EventTarget {
  length: number;
  [index: number]: AudioTrack;
  getTrackById(id: string): AudioTrack | null;
  onchange: ((this: AudioTrackList, ev: Event) => any) | null;
  onaddtrack: ((this: AudioTrackList, ev: Event) => any) | null;
  onremovetrack: ((this: AudioTrackList, ev: Event) => any) | null;
}

export interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  audioTracks?: AudioTrackList;
}