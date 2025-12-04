import React, { useState } from 'react';
import { AudioTrack } from '../types';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onAnalyze: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  
  // Subtitle Props
  hasSubtitle: boolean;
  onUploadSubtitle: () => void;
  onRemoveSubtitle: () => void;
  
  // Audio Track Props
  audioTracks: AudioTrack[];
  onSelectAudioTrack: (index: number) => void;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onAnalyze,
  onToggleFullscreen,
  isFullscreen,
  hasSubtitle,
  onUploadSubtitle,
  onRemoveSubtitle,
  audioTracks,
  onSelectAudioTrack
}) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="controls absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-4 px-6 transition-opacity duration-300 opacity-0 group-hover:opacity-100 z-30">
      
      {/* Progress Bar Container */}
      <div className="relative group/slider w-full h-4 flex items-center cursor-pointer mb-2">
          {/* Background Track */}
          <div className="absolute w-full h-[2px] bg-white/20 group-hover/slider:h-[4px] transition-all rounded-full"></div>
          {/* Active Track */}
          <div 
            className="absolute h-[2px] bg-white group-hover/slider:h-[4px] transition-all rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          ></div>
          {/* Thumb (Invisible native input) */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute w-full h-full opacity-0 cursor-pointer z-10"
          />
      </div>

      <div className="flex items-center justify-between text-zinc-300">
        <div className="flex items-center gap-6">
          <button 
            onClick={onPlayPause}
            className="hover:text-white transition-colors hover:scale-110 transform duration-200"
          >
            <span className="material-icons text-4xl">
              {isPlaying ? 'pause_circle_filled' : 'play_circle_filled'}
            </span>
          </button>

          <span className="text-sm font-mono text-zinc-400 tracking-wider">
            {formatTime(currentTime)} <span className="text-zinc-600 mx-1">/</span> {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
           {/* Settings / Tracks Menu */}
           <div className="relative">
             <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors ${showSettings ? 'text-white bg-white/10' : ''}`}
               title="Ayarlar / Alt Yazı"
             >
                <span className="material-icons text-xl">tune</span>
             </button>

             {showSettings && (
               <div className="absolute bottom-12 right-0 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl p-3 w-56 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
                  
                  {/* Subtitle Section */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Alt Yazı</span>
                    {hasSubtitle ? (
                       <button onClick={onRemoveSubtitle} className="flex items-center gap-2 text-xs text-red-400 hover:bg-white/5 p-2 rounded">
                          <span className="material-icons text-sm">close</span>
                          Kaldır
                       </button>
                    ) : (
                       <label className="flex items-center gap-2 text-xs text-white hover:bg-white/5 p-2 rounded cursor-pointer transition-colors">
                          <span className="material-icons text-sm">upload_file</span>
                          Yükle (.srt / .vtt)
                          <input type="file" accept=".srt,.vtt" onChange={onUploadSubtitle} className="hidden" />
                       </label>
                    )}
                  </div>

                  {/* Audio Track Section */}
                  {audioTracks.length > 0 && (
                     <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Ses Dili</span>
                        {audioTracks.map((track, idx) => (
                           <button 
                              key={track.id + idx}
                              onClick={() => onSelectAudioTrack(idx)}
                              className={`flex items-center justify-between text-xs p-2 rounded hover:bg-white/5 ${track.enabled ? 'text-green-400' : 'text-zinc-400'}`}
                           >
                              {track.language || `Kanal ${idx + 1}`}
                              {track.enabled && <span className="material-icons text-[10px]">check</span>}
                           </button>
                        ))}
                     </div>
                  )}
               </div>
             )}
           </div>

           <button 
            onClick={onAnalyze}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
            title="Gemini AI Analiz"
          >
            <span className="material-icons text-xl">auto_awesome</span>
          </button>
          
          <button 
            onClick={onToggleFullscreen}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
            title="Tam Ekran"
          >
            <span className="material-icons text-xl">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};