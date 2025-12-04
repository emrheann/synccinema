import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChatMessage, UserProfile } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onAskAI: (text: string) => void;
  variant?: 'sidebar' | 'overlay';
  isInputVisible?: boolean;
  onInputBlur?: () => void;
  myProfile?: UserProfile;
  peerProfile?: UserProfile;
  isIdle?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  onSendMessage, 
  onAskAI, 
  variant = 'sidebar',
  isInputVisible = true,
  onInputBlur,
  myProfile,
  peerProfile,
  isIdle = false
}) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'p2p' | 'ai'>('p2p');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Draggable State
  const [position, setPosition] = useState({ x: 40, y: window.innerHeight - 100 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Use useLayoutEffect for immediate scrolling after render
  useLayoutEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, variant]);

  useEffect(() => {
    if (isInputVisible && inputRef.current) {
      requestAnimationFrame(() => {
         inputRef.current?.focus();
      });
    }
  }, [isInputVisible]);

  // Drag Event Handlers
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isDragging.current) {
              setPosition({
                  x: e.clientX - dragOffset.current.x,
                  y: e.clientY - dragOffset.current.y
              });
          }
      };

      const handleMouseUp = () => {
          isDragging.current = false;
          document.body.style.userSelect = '';
      };

      if (variant === 'overlay') {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [variant]);

  const handleMouseDown = (e: React.MouseEvent) => {
      // Prevent dragging if clicking inside the input field to allow typing/selection
      if ((e.target as HTMLElement).tagName === 'INPUT') {
          return;
      }
      
      isDragging.current = true;
      dragOffset.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y
      };
      document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
        // If input is empty and we are in overlay mode, close the input instead of sending nothing
        if (variant === 'overlay' && onInputBlur) {
            onInputBlur();
        }
        return;
    }

    if (mode === 'p2p') {
      onSendMessage(input);
    } else {
      onAskAI(input);
    }
    setInput('');
    
    if (variant === 'overlay' && onInputBlur) {
      onInputBlur();
    }
  };

  const getSenderName = (sender: string) => {
      if (sender === 'me') return myProfile?.name || 'Sen';
      if (sender === 'partner') return peerProfile?.name || 'Partner';
      if (sender === 'ai') return 'AI Asistan';
      return 'Sistem';
  };

  const getSenderColor = (sender: string) => {
      if (sender === 'me') return myProfile?.color || '#ffffff';
      if (sender === 'partner') return peerProfile?.color || '#a1a1aa'; // zinc-400
      if (sender === 'ai') return '#38bdf8'; // sky-400
      return '#52525b'; // zinc-600
  };

  const isOverlay = variant === 'overlay';

  if (isOverlay) {
    return (
      // Draggable Anchor Container - Now clickable anywhere
      <div 
        style={{ left: position.x, top: position.y }} 
        onMouseDown={handleMouseDown}
        className={`fixed z-50 group flex flex-col items-start cursor-move transition-opacity duration-700 ${isIdle && !isInputVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        {/* Message Container - Grows Upwards from Anchor */}
        <div className="absolute bottom-0 left-0 w-96 max-w-[80vw] pointer-events-none flex flex-col justify-end">
          <div 
              className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-hide pointer-events-auto"
              style={{ 
                  maskImage: 'linear-gradient(to bottom, transparent, black 15%)', 
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%)' 
              }}
          >
             {messages.slice(-8).map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col items-start animate-in fade-in slide-in-from-left-2 duration-300"
                >
                  <div className="bg-black/60 border border-white/5 backdrop-blur-md text-zinc-100 px-3 py-2 text-sm shadow-sm rounded-lg rounded-tl-none max-w-full">
                    <span 
                      className="font-bold text-[10px] uppercase tracking-wider mr-2 opacity-80"
                      style={{ color: getSenderColor(msg.sender) }}
                    >
                      {getSenderName(msg.sender)}
                    </span>
                    <span className="leading-relaxed drop-shadow-md break-words whitespace-pre-wrap">
                        {msg.text.replace('/ai ', '')}
                    </span>
                  </div>
                </div>
             ))}
             <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>

        {/* Input Container - Hangs Downwards from Anchor */}
        {isInputVisible && (
          <div className="absolute top-4 left-0 w-96 max-w-[80vw] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onBlur={() => setTimeout(() => onInputBlur && onInputBlur(), 100)}
                placeholder="Mesaj yaz..."
                className="w-full bg-black/80 border border-white/20 px-4 py-3 pl-4 text-white placeholder-zinc-500 focus:border-white/60 focus:ring-1 focus:ring-white/20 text-sm backdrop-blur-xl outline-none shadow-2xl rounded-lg cursor-text"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono tracking-widest uppercase pointer-events-none">
                  Enter
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Sidebar Mode (Standard)
  return (
    <div className="flex flex-col h-full bg-black overflow-hidden border-l border-white/5">
      {/* Tabs */}
      <div className="flex border-b border-white/5 flex-none bg-zinc-950/50">
        <button
          onClick={() => setMode('p2p')}
          className={`flex-1 py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${
            mode === 'p2p' ? 'text-white border-b-2 border-white bg-white/5' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          Sohbet
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 ${
            mode === 'ai' ? 'text-white border-b-2 border-white bg-white/5' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
           <span>AI</span>
           <span className="material-icons text-[14px]">auto_awesome</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-black scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {messages.filter(m => mode === 'ai' ? (m.sender === 'ai' || (m.sender === 'me' && m.text.startsWith('/ai '))) : m.sender !== 'ai').map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'me' ? 'items-end' : 'items-start'
            }`}
          >
             {/* Sender Name */}
             {msg.sender !== 'me' && msg.sender !== 'system' && (
                 <span className="text-[9px] font-bold uppercase tracking-wider mb-1 ml-1 opacity-70" style={{ color: getSenderColor(msg.sender) }}>
                     {getSenderName(msg.sender)}
                 </span>
             )}

            <div
              className={`max-w-[90%] px-3 py-2 text-sm break-words whitespace-pre-wrap border leading-relaxed ${
                msg.sender === 'me'
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 rounded-tr-none rounded-lg'
                  : msg.sender === 'partner'
                  ? 'bg-zinc-950 border-zinc-800 text-zinc-300 rounded-tl-none rounded-lg'
                  : msg.sender === 'ai'
                  ? 'bg-zinc-900/50 border-zinc-800 text-sky-100 rounded-lg'
                  : 'bg-transparent border-transparent text-zinc-600 text-[10px] text-center w-full uppercase tracking-widest'
              }`}
              style={msg.sender === 'me' ? { borderRight: `2px solid ${myProfile?.color || 'white'}` } : msg.sender === 'partner' ? { borderLeft: `2px solid ${peerProfile?.color || 'white'}` } : {}}
            >
              {msg.text.replace('/ai ', '')}
            </div>
            {msg.sender !== 'system' && (
              <span className="text-[9px] text-zinc-700 mt-1 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-800 gap-2 opacity-50">
                <span className="material-icons text-4xl">chat_bubble_outline</span>
                <span className="text-[10px] tracking-[0.2em] uppercase">{mode === 'p2p' ? 'Sohbet Başlat' : 'AI Asistan'}</span>
            </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-black border-t border-white/5 flex gap-0 flex-none relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'p2p' ? "Mesaj..." : "AI'ya sor..."}
          className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 pl-4 pr-12 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all rounded-sm"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white disabled:opacity-0 transition-all"
        >
          <span className="material-icons text-lg">send</span>
        </button>
      </form>
    </div>
  );
};