import React, { useState, useEffect, useRef } from 'react';
import { ConnectionStatus, SyncEventType, SyncPayload, ChatMessage, UserProfile, ExtendedHTMLVideoElement, AudioTrack } from './types';
import { VideoControls } from './components/VideoControls';
import { ChatPanel } from './components/ChatPanel';
import { geminiService } from './services/geminiService';

const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const PROFILE_COLORS = [
    '#4ade80', // green-400
    '#22d3ee', // cyan-400
    '#c084fc', // purple-400
    '#fb923c', // orange-400
    '#f472b6', // pink-400
    '#facc15'  // yellow-400
];

const App: React.FC = () => {
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [connStatus, setConnStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<string | null>(null);
  const [remoteDuration, setRemoteDuration] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlayChatInput, setShowOverlayChatInput] = useState(false);
  
  // UI Visibility State (Idle Timer)
  const [isUserActive, setIsUserActive] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Audio Track State
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

  // Profile State
  const [myProfile, setMyProfile] = useState<UserProfile>({
      name: `Misafir-${Math.floor(Math.random() * 1000)}`,
      color: PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)]
  });
  const [peerProfile, setPeerProfile] = useState<UserProfile | undefined>(undefined);

  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<ExtendedHTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isRemoteUpdate = useRef(false); 

  // --- Idle Timer Logic ---
  const resetIdleTimer = () => {
      setIsUserActive(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      // Only hide UI if input is NOT open
      if (!showOverlayChatInput) {
          idleTimerRef.current = setTimeout(() => {
              setIsUserActive(false);
          }, 3000); // 3 seconds idle time
      }
  };

  useEffect(() => {
      // If input is open, keep UI active
      if (showOverlayChatInput) {
          setIsUserActive(true);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      } else {
          resetIdleTimer();
      }
  }, [showOverlayChatInput]);

  useEffect(() => {
      const handleUserActivity = () => resetIdleTimer();

      window.addEventListener('mousemove', handleUserActivity);
      window.addEventListener('mousedown', handleUserActivity);
      window.addEventListener('keydown', handleUserActivity);
      window.addEventListener('touchstart', handleUserActivity);

      return () => {
          window.removeEventListener('mousemove', handleUserActivity);
          window.removeEventListener('mousedown', handleUserActivity);
          window.removeEventListener('keydown', handleUserActivity);
          window.removeEventListener('touchstart', handleUserActivity);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
  }, [showOverlayChatInput]);
  // ------------------------

  useEffect(() => {
    let currentPeer: any = null;

    const initPeer = () => {
      const Peer = window.Peer;
      if (!Peer) return;

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const myId = generateShortId();
      
      const peer = new Peer(myId, {
        debug: 1,
        config: {
          'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun.services.mozilla.com' }
          ]
        }
      });

      currentPeer = peer;
      peerRef.current = peer;

      peer.on('open', (id: string) => {
        if (currentPeer === peer) {
            setPeerId(id);
        }
      });

      peer.on('connection', (conn: any) => {
        handleConnection(conn);
      });

      peer.on('error', (err: any) => {
        console.error("PeerJS Error:", err);
        
        switch (err.type) {
            case 'unavailable-id':
                if (currentPeer === peer) initPeer();
                break;
            case 'peer-unavailable':
                setNotification("Arkadaşın bulunamadı. Kodu doğru girdiğinden ve çevrimiçi olduğundan emin ol.");
                setConnStatus(ConnectionStatus.DISCONNECTED);
                break;
            case 'webrtc':
                if (connStatus !== ConnectionStatus.CONNECTED) {
                    setNotification("Bağlantı hatası. Ağ kısıtlaması olabilir.");
                }
                break;
            case 'disconnected':
                if (connStatus === ConnectionStatus.CONNECTED) {
                    setNotification("Bağlantı koptu.");
                    setConnStatus(ConnectionStatus.DISCONNECTED);
                }
                break;
            default:
                setNotification(`Hata: ${err.type}`);
        }
        
        if (err.type !== 'unavailable-id') {
             setTimeout(() => setNotification(null), 5000);
        }
      });
    };

    initPeer();

    return () => {
      if (peerRef.current) {
          peerRef.current.destroy();
      }
    };
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      // Ignore global shortcuts if user is typing in input or textarea
      if (activeTag === 'input' || activeTag === 'textarea') {
          return;
      }

      // Space: Play/Pause
      if (e.code === 'Space') {
          e.preventDefault();
          if (videoRef.current) {
              if (videoRef.current.paused) {
                  onPlay();
                  videoRef.current.play();
              } else {
                  onPause();
                  videoRef.current.pause();
              }
          }
      } 
      // Arrow Left: Backward 5s
      else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (videoRef.current) {
              const newTime = Math.max(0, videoRef.current.currentTime - 5);
              handleManualSeek(newTime);
          }
      }
      // Arrow Right: Forward 5s
      else if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (videoRef.current) {
              const newTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
              handleManualSeek(newTime);
          }
      }
      // Arrow Up: Volume Up
      else if (e.code === 'ArrowUp') {
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
      }
      // Arrow Down: Volume Down
      else if (e.code === 'ArrowDown') {
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
      }
      // Enter: Toggle Overlay Chat Input (handled separately inside logic if needed, but here mainly for fullscreen)
      else if (isFullscreen && e.key === 'Enter') {
        if (!showOverlayChatInput) {
           e.preventDefault(); 
           setShowOverlayChatInput(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [volume, isFullscreen, showOverlayChatInput]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setShowOverlayChatInput(false);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
      if (connStatus === ConnectionStatus.CONNECTED && connRef.current) {
          sendSyncEvent(SyncEventType.PROFILE_UPDATE, undefined, undefined, undefined, myProfile);
      }
  }, [myProfile, connStatus]);

  const handleConnection = (conn: any) => {
    setConnStatus(ConnectionStatus.CONNECTING);
    
    conn.on('open', () => {
      setConnStatus(ConnectionStatus.CONNECTED);
      connRef.current = conn;
      addSystemMessage("Bağlandı.");
      setNotification(null);
      
      sendSyncEvent(SyncEventType.PROFILE_UPDATE, undefined, undefined, undefined, myProfile);

      if (videoRef.current && !isNaN(videoRef.current.duration)) {
          sendSyncEvent(SyncEventType.META_DATA, undefined, undefined, videoRef.current.duration);
      }
      
      setTimeout(() => {
          conn.send({ type: SyncEventType.SYNC_REQUEST });
      }, 500);
    });

    conn.on('data', (data: SyncPayload) => {
      handleRemoteData(data);
    });

    conn.on('close', () => {
      setConnStatus(ConnectionStatus.DISCONNECTED);
      addSystemMessage("Koptu.");
      connRef.current = null;
      setRemoteDuration(null);
      setPeerProfile(undefined);
    });
    
    conn.on('error', (err: any) => {
        console.error("Connection Error:", err);
        setConnStatus(ConnectionStatus.ERROR);
    });
  };

  const connectToPeer = () => {
    if (!remotePeerId || !peerRef.current) return;
    
    const targetId = remotePeerId.trim().toUpperCase();
    if (targetId === peerId) {
        setNotification("Kendine bağlanamazsın.");
        setTimeout(() => setNotification(null), 3000);
        return;
    }

    setConnStatus(ConnectionStatus.CONNECTING);
    try {
        const conn = peerRef.current.connect(targetId, {
            reliable: true
        });
        handleConnection(conn);
    } catch (e) {
        console.error("Connect error:", e);
        setNotification("Bağlantı başlatılamadı.");
        setConnStatus(ConnectionStatus.DISCONNECTED);
    }
  };

  const handleRemoteData = (data: SyncPayload) => {
    const video = videoRef.current;
    
    if (data.type === SyncEventType.CHAT_MESSAGE) {
        if (data.value) addMessage(data.value, 'partner');
        return;
    }

    if (data.type === SyncEventType.PROFILE_UPDATE && data.profile) {
        setPeerProfile(data.profile);
        return;
    }

    if (!video) return;

    switch (data.type) {
      case SyncEventType.PLAY:
        isRemoteUpdate.current = true;
        if (data.timestamp !== undefined && Math.abs(video.currentTime - data.timestamp) > 0.5) {
            video.currentTime = data.timestamp;
        }
        video.play().catch(e => console.log("Autoplay blocked:", e));
        setIsPlaying(true);
        setTimeout(() => { isRemoteUpdate.current = false; }, 300);
        break;

      case SyncEventType.PAUSE:
        isRemoteUpdate.current = true;
        video.pause();
        setIsPlaying(false);
        if (data.timestamp !== undefined && Math.abs(video.currentTime - data.timestamp) > 0.5) {
            video.currentTime = data.timestamp;
        }
        setTimeout(() => { isRemoteUpdate.current = false; }, 300);
        break;

      case SyncEventType.SEEK:
        isRemoteUpdate.current = true;
        if (data.timestamp !== undefined) {
          video.currentTime = data.timestamp;
          setCurrentTime(data.timestamp);
        }
        setTimeout(() => { isRemoteUpdate.current = false; }, 500);
        break;

      case SyncEventType.SYNC_REQUEST:
        sendSyncEvent(SyncEventType.SYNC_RESPONSE, video.currentTime);
        break;
      
      case SyncEventType.SYNC_RESPONSE:
        if (data.timestamp !== undefined) {
             const drift = Math.abs(video.currentTime - data.timestamp);
             if (drift > 2) {
                 setNotification(`Senkron: ${drift.toFixed(1)}s`);
                 video.currentTime = data.timestamp;
                 setTimeout(() => setNotification(null), 2000);
             }
        }
        break;

      case SyncEventType.META_DATA:
         if (data.duration) {
             setRemoteDuration(data.duration);
             if (videoRef.current) {
                 checkDurationMatch(videoRef.current.duration, data.duration);
             }
         }
         break;
    }
  };

  const checkDurationMatch = (myDur: number, theirDur: number) => {
      const diff = Math.abs(myDur - theirDur);
      if (diff > 5) {
          setNotification(`Süre Farkı: Sen ${formatDuration(myDur)} / O ${formatDuration(theirDur)}`);
      } else {
          setNotification("Dosyalar Uyumlu");
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const formatDuration = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const sendSyncEvent = (type: SyncEventType, timestamp?: number, value?: string, durationVal?: number, profile?: UserProfile) => {
    if (connRef.current && connStatus === ConnectionStatus.CONNECTED) {
      try {
          connRef.current.send({ 
              type, 
              timestamp, 
              value, 
              duration: durationVal,
              profile
          });
      } catch (e) {
          console.error("Send error:", e);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setSubtitleUrl(null); // Reset subtitle
      setNotification(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setAudioTracks([]);
    }
  };

  const srtToVtt = (srtContent: string) => {
      let vtt = 'WEBVTT\n\n';
      vtt += srtContent
          .replace(/,/g, '.') // Convert comma time separator to dot
          .replace(/^\d+$/gm, '') // Remove simple line numbers (rough approximation)
          .replace(/\n\n+/g, '\n\n'); // Normalize newlines
      return vtt;
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          const content = ev.target?.result as string;
          let vttBlob: Blob;
          
          if (file.name.endsWith('.srt')) {
              const vttText = srtToVtt(content);
              vttBlob = new Blob([vttText], { type: 'text/vtt' });
          } else {
              vttBlob = new Blob([content], { type: 'text/vtt' });
          }
          
          if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
          const url = URL.createObjectURL(vttBlob);
          setSubtitleUrl(url);
          setNotification("Alt Yazı Yüklendi");
          setTimeout(() => setNotification(null), 2000);
      };
      reader.readAsText(file);
  };

  const handleRemoveSubtitle = () => {
      if (subtitleUrl) {
          URL.revokeObjectURL(subtitleUrl);
          setSubtitleUrl(null);
      }
  };

  const handleSelectAudioTrack = (index: number) => {
      if (!videoRef.current || !videoRef.current.audioTracks) return;
      const tracks = videoRef.current.audioTracks;
      
      for (let i = 0; i < tracks.length; i++) {
          tracks[i].enabled = (i === index);
      }
      
      // Update state to trigger re-render of UI
      const newTracks: AudioTrack[] = [];
      for (let i = 0; i < tracks.length; i++) {
          newTracks.push({
              id: tracks[i].id,
              kind: tracks[i].kind,
              label: tracks[i].label,
              language: tracks[i].language,
              enabled: tracks[i].enabled
          });
      }
      setAudioTracks(newTracks);
  };

  const handleEjectVideo = () => {
      setVideoUrl(null);
      setVideoFile(null);
      setIsPlaying(false);
      setCurrentTime(0);
      handleRemoveSubtitle();
      if (connStatus === ConnectionStatus.CONNECTED) {
          sendSyncEvent(SyncEventType.PAUSE, 0);
      }
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const onPlay = () => {
    if (!isRemoteUpdate.current) {
        setIsPlaying(true);
        sendSyncEvent(SyncEventType.PLAY, videoRef.current?.currentTime);
    }
  };

  const onPause = () => {
    if (!isRemoteUpdate.current) {
        setIsPlaying(false);
        sendSyncEvent(SyncEventType.PAUSE, videoRef.current?.currentTime);
    }
  };

  const onSeeked = () => {
      if (!isRemoteUpdate.current) {
          sendSyncEvent(SyncEventType.SEEK, videoRef.current?.currentTime);
      }
  };

  const handleManualSeek = (time: number) => {
      if (videoRef.current) {
          isRemoteUpdate.current = false; 
          videoRef.current.currentTime = time;
          setCurrentTime(time);
          
          // If paused, just sync the frame, if playing, it will continue
          // We trigger sync event manually here because handleManualSeek updates current time
          // but we want to ensure the specific logic for manual seeking (e.g. arrow keys) works
          sendSyncEvent(SyncEventType.SEEK, time);
      }
  };

  const handleVolumeChange = (newVol: number) => {
      const v = Math.max(0, Math.min(1, newVol));
      if (videoRef.current) {
          videoRef.current.volume = v;
      }
      setVolume(v);
  };

  const handleForceSync = () => {
      if (videoRef.current) {
          const t = videoRef.current.currentTime;
          sendSyncEvent(SyncEventType.SEEK, t);
          sendSyncEvent(isPlaying ? SyncEventType.PLAY : SyncEventType.PAUSE, t);
          setNotification("Sync Sinyali Gönderildi");
          setTimeout(() => setNotification(null), 2000);
      }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      setDuration(d);
      if (connStatus === ConnectionStatus.CONNECTED) {
          sendSyncEvent(SyncEventType.META_DATA, undefined, undefined, d);
      }
      if (remoteDuration) {
          checkDurationMatch(d, remoteDuration);
      }

      // Check for Audio Tracks (Experimental)
      if (videoRef.current.audioTracks) {
          const tracks = videoRef.current.audioTracks;
          const trackList: AudioTrack[] = [];
          for (let i = 0; i < tracks.length; i++) {
              trackList.push({
                  id: tracks[i].id,
                  kind: tracks[i].kind,
                  label: tracks[i].label,
                  language: tracks[i].language,
                  enabled: tracks[i].enabled
              });
          }
          setAudioTracks(trackList);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const addMessage = (text: string, sender: ChatMessage['sender']) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      text,
      sender,
      timestamp: Date.now()
    }]);
  };

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text,
        sender: 'system',
        timestamp: Date.now()
    }]);
  };

  const handleSendMessage = (text: string) => {
    addMessage(text, 'me');
    sendSyncEvent(SyncEventType.CHAT_MESSAGE, undefined, text);
  };

  const handleAskAI = async (text: string) => {
    addMessage(`/ai ${text}`, 'me');
    const context = messages.slice(-5).map(m => `${m.sender}: ${m.text}`);
    const response = await geminiService.chatAboutMovie(context, text);
    addMessage(response, 'ai');
  };

  const handleAnalyzeScene = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6); 
        
        setShowAnalysis("Analiz ediliyor...");
        const result = await geminiService.analyzeScene(base64);
        setShowAnalysis(result);
        addMessage(`🔍 AI: ${result}`, 'ai');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-black text-zinc-300 overflow-hidden selection:bg-white/20">
      {/* Ultra Minimal Header */}
      <header className="flex-none h-12 flex justify-between items-center px-4 border-b border-white/5 bg-black z-50">
        <div className="font-bold text-white tracking-widest text-sm uppercase">SyncCinema</div>
        
        <div className="flex items-center gap-4">
            {videoUrl && (
                <button 
                    onClick={handleEjectVideo}
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-red-500 hover:text-red-400 transition-colors border border-red-500/20 hover:border-red-500/50 px-2 py-1"
                >
                    <span className="material-icons text-sm">eject</span>
                    Çıkart
                </button>
            )}

            {connStatus === ConnectionStatus.CONNECTED && (
                <button onClick={handleForceSync} className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-white transition-colors">
                    Sync
                </button>
            )}
            <div className={`w-1.5 h-1.5 rounded-full ${
                    connStatus === ConnectionStatus.CONNECTED ? 'bg-white' : 
                    connStatus === ConnectionStatus.CONNECTING ? 'bg-zinc-500 animate-pulse' : 
                    connStatus === ConnectionStatus.ERROR ? 'bg-red-500' :
                    'bg-zinc-800'
            }`}></div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left: Video Area */}
        <div 
          ref={videoContainerRef}
          className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden group min-h-0"
        >
          {!videoUrl && (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                <label className="cursor-pointer group flex flex-col items-center gap-2">
                    <span className="text-4xl text-zinc-800 group-hover:text-zinc-600 transition-colors material-icons">movie</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors border-b border-transparent group-hover:border-zinc-600 pb-0.5">
                        Video Seç
                    </span>
                    <input type="file" accept="video/*,.mkv" onChange={handleFileChange} className="hidden" />
                </label>
            </div>
          )}

          {notification && (
              <div className="absolute top-4 bg-black/80 text-white px-4 py-2 text-xs border border-white/10 backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-2">
                  {notification}
              </div>
          )}
          
          {showAnalysis && (
              <div className="absolute top-16 right-4 w-72 bg-black/90 text-zinc-300 text-xs border border-white/10 p-4 z-40 max-h-[50vh] overflow-y-auto">
                   <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
                       <span className="uppercase tracking-widest font-bold text-white">AI Görüşü</span>
                       <button onClick={() => setShowAnalysis(null)} className="hover:text-white">x</button>
                   </div>
                   <p className="leading-relaxed">{showAnalysis}</p>
              </div>
          )}

          {videoUrl && (
            <>
              <div className="relative w-full h-full bg-black flex items-center justify-center">
                  <video
                      ref={videoRef}
                      src={videoUrl}
                      className="max-h-full max-w-full outline-none"
                      onPlay={onPlay}
                      onPause={onPause}
                      onSeeked={onSeeked}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
                      playsInline
                      crossOrigin="anonymous"
                  >
                     {subtitleUrl && (
                         <track 
                             kind="subtitles" 
                             src={subtitleUrl} 
                             default 
                             label="User Subtitles" 
                         />
                     )}
                  </video>
                  <VideoControls 
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      duration={duration}
                      volume={volume}
                      onPlayPause={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
                      onSeek={handleManualSeek}
                      onVolumeChange={handleVolumeChange}
                      onAnalyze={handleAnalyzeScene}
                      onToggleFullscreen={toggleFullscreen}
                      isFullscreen={isFullscreen}
                      hasSubtitle={!!subtitleUrl}
                      onUploadSubtitle={() => {
                          const input = document.querySelector('input[type="file"][accept=".srt,.vtt"]') as HTMLInputElement;
                          if (input) input.click();
                      }}
                      onRemoveSubtitle={handleRemoveSubtitle}
                      audioTracks={audioTracks}
                      onSelectAudioTrack={handleSelectAudioTrack}
                      visible={isUserActive}
                  />
              </div>
              
              {isFullscreen && (
                <ChatPanel 
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onAskAI={handleAskAI}
                  variant="overlay"
                  isInputVisible={showOverlayChatInput}
                  onInputBlur={() => setShowOverlayChatInput(false)}
                  myProfile={myProfile}
                  peerProfile={peerProfile}
                  isIdle={!isUserActive}
                />
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Right: Sidebar */}
        <div className="flex-none lg:flex-initial w-full lg:w-80 bg-black border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col z-20">
            
            {/* Profile Settings (Minimal) */}
            <div className="p-3 border-b border-white/5 bg-zinc-950/30">
                <div className="flex flex-col gap-2">
                    <input 
                        type="text" 
                        value={myProfile.name}
                        onChange={(e) => setMyProfile({...myProfile, name: e.target.value})}
                        className="bg-transparent border-b border-white/10 text-white text-xs py-1 px-1 focus:border-white/50 w-full"
                        placeholder="İsim Giriniz"
                    />
                    <div className="flex gap-2">
                        {PROFILE_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setMyProfile({...myProfile, color: c})}
                                className={`w-3 h-3 rounded-full transition-transform ${myProfile.color === c ? 'scale-125 ring-1 ring-white' : 'opacity-50 hover:opacity-100'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Connection Panel - Ultra Minimal */}
            <div className="flex-none p-4 border-b border-white/5">
                {connStatus === ConnectionStatus.DISCONNECTED || connStatus === ConnectionStatus.ERROR ? (
                     <div className="flex flex-col gap-3">
                        {/* ID Block */}
                        <div className="flex items-center gap-2">
                            <div 
                                onClick={() => navigator.clipboard.writeText(peerId)}
                                className="flex-1 bg-zinc-900/50 border border-white/5 hover:border-white/20 transition-colors p-2 text-center cursor-pointer group"
                            >
                                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Senin Kodun</div>
                                <div className="font-mono text-sm text-white tracking-widest group-hover:text-green-400 transition-colors">
                                    {peerId || '...'}
                                </div>
                            </div>
                        </div>

                        {/* Input Block */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={remotePeerId}
                                onChange={(e) => setRemotePeerId(e.target.value.toUpperCase())}
                                placeholder="KOD GİR"
                                maxLength={6}
                                className="flex-1 bg-black border border-white/10 p-2 text-center text-white placeholder-zinc-700 focus:border-white/30 text-sm font-mono uppercase tracking-widest"
                            />
                            <button
                                onClick={connectToPeer}
                                disabled={!remotePeerId || !peerId}
                                className="px-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                Bağlan
                            </button>
                        </div>
                     </div>
                ) : (
                    <div className="flex items-center justify-between px-2">
                         <div className="flex flex-col gap-0.5">
                             <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                <span className="text-xs text-zinc-400 uppercase tracking-widest">
                                    {connStatus === ConnectionStatus.CONNECTING ? 'Bağlanıyor...' : 'Bağlı'}
                                </span>
                             </div>
                             {peerProfile && (
                                 <div className="text-[10px] text-zinc-500 pl-3.5">
                                     Partner: <span style={{ color: peerProfile.color }}>{peerProfile.name}</span>
                                 </div>
                             )}
                         </div>
                         <button 
                             onClick={() => {
                                 connRef.current?.close();
                                 setConnStatus(ConnectionStatus.DISCONNECTED);
                             }}
                             className="text-zinc-600 hover:text-red-500 transition-colors text-xs uppercase tracking-wider"
                         >
                             Kes
                         </button>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 bg-black overflow-hidden">
                <ChatPanel 
                    messages={messages} 
                    onSendMessage={handleSendMessage}
                    onAskAI={handleAskAI}
                    myProfile={myProfile}
                    peerProfile={peerProfile}
                    isIdle={false} // Sidebar chat always active
                />
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;