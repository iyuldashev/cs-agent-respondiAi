import React, { useReducer, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Headphones, 
  X, 
  Minus, 
  MessageCircle, 
  Mic, 
  MicOff, 
  PhoneOff,
  Send,
  User
} from 'lucide-react';
import {
  useConnectionState,
  useLocalParticipant,
  useVoiceAssistant,
  useTracks,
} from "@livekit/components-react";
import { useMultibandTrackVolume } from "@/hooks/useTrackVolume";
import { Track, LocalParticipant } from "livekit-client";

// Types
type WidgetState = 'collapsed' | 'chooseMethod' | 'inVoiceCall' | 'inTextChat';
type VoiceCallState = 'connecting' | 'active' | 'ended';
type ContactMethod = 'voice' | 'text';

interface State {
  widgetState: WidgetState;
  voiceCallState: VoiceCallState;
  isMuted: boolean;
  showTranscript: boolean;
  callDuration: number;
  textMessages: Array<{ id: string; sender: 'user' | 'agent'; message: string; timestamp: Date }>;
  currentInput: string;
}

type Action = 
  | { type: 'OPEN_DIALOG' }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SELECT_METHOD'; method: ContactMethod }
  | { type: 'END_SESSION' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_TRANSCRIPT' }
  | { type: 'UPDATE_CALL_DURATION' }
  | { type: 'SET_VOICE_STATE'; state: VoiceCallState }
  | { type: 'ADD_MESSAGE'; sender: 'user' | 'agent'; message: string }
  | { type: 'UPDATE_INPUT'; input: string }
  | { type: 'MINIMIZE' };

const initialState: State = {
  widgetState: 'collapsed',
  voiceCallState: 'connecting',
  isMuted: false,
  showTranscript: false,
  callDuration: 0,
  textMessages: [],
  currentInput: ''
};

function widgetReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN_DIALOG':
      return { ...state, widgetState: 'chooseMethod' };
    case 'CLOSE_DIALOG':
      return { ...state, widgetState: 'collapsed' };
    case 'SELECT_METHOD':
      return { 
        ...state, 
        widgetState: action.method === 'voice' ? 'inVoiceCall' : 'inTextChat',
        voiceCallState: action.method === 'voice' ? 'connecting' : state.voiceCallState
      };
    case 'END_SESSION':
      return { ...initialState };
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    case 'TOGGLE_TRANSCRIPT':
      return { ...state, showTranscript: !state.showTranscript };
    case 'UPDATE_CALL_DURATION':
      return { ...state, callDuration: state.callDuration + 1 };
    case 'SET_VOICE_STATE':
      return { ...state, voiceCallState: action.state };
    case 'ADD_MESSAGE':
      return {
        ...state,
        textMessages: [
          ...state.textMessages,
          {
            id: Date.now().toString(),
            sender: action.sender,
            message: action.message,
            timestamp: new Date()
          }
        ]
      };
    case 'UPDATE_INPUT':
      return { ...state, currentInput: action.input };
    case 'MINIMIZE':
      return { ...state, widgetState: 'collapsed' };
    default:
      return state;
  }
}

// Custom hooks
function useFocusTrap(isActive: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    }

    element.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => element.removeEventListener('keydown', handleTabKey);
  }, [isActive]);

  return ref;
}

// Floating Chat Button Component
function FloatingChatButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group z-50"
      style={{ backgroundColor: '#003B2D' }}
      whileHover={{ scale: 1.05, backgroundColor: '#004A3A' }}
      whileTap={{ scale: 0.95 }}
      aria-label="Open customer service chat"
    >
      <Headphones 
        className="w-6 h-6 group-hover:scale-105 transition-transform" 
        style={{ color: '#9EFF57' }}
      />
    </motion.button>
  );
}

// Contact Method Dialog Component
function ContactMethodDialog({ 
  isOpen, 
  onClose, 
  onSelectMethod 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSelectMethod: (method: ContactMethod) => void;
}) {
  const dialogRef = useFocusTrap(isOpen);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, dialogRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed bottom-20 right-4 md:bottom-24 md:right-6 w-80 rounded-xl p-6 shadow-2xl z-50 backdrop-blur-sm"
            style={{ 
              backgroundColor: '#004428',
              backdropFilter: 'blur(12px)',
              boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">
              How would you like to connect with an agent?
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={() => onSelectMethod('voice')}
                className="w-full h-10 rounded-full text-white font-medium hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                style={{ background: 'linear-gradient(90deg, #5EFF8A 0%, #A2FF6A 100%)' }}
              >
                Voice chat
              </button>
              
              <button
                onClick={() => onSelectMethod('text')}
                className="w-full h-10 rounded-full bg-transparent text-white font-medium hover:bg-opacity-10 transition-all duration-200"
                style={{ 
                  border: '1px solid #9EFF57',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(158, 255, 87, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Text chat
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Waveform Animation Component
function WaveformBars({ volumes }: { volumes?: number[] }) {
  const bars = Array(7).fill(0);
  
  return (
    <div className="flex items-center justify-center space-x-1 h-16">
      {bars.map((_, index) => {
        const volume = volumes?.[index] || 0;
        const animatedHeight = volume > 0.01 ? Math.max(8, Math.min(32, volume * 40)) : null;
        
        return (
          <motion.div
            key={index}
            className="w-1 bg-[#7DFF65] rounded-full"
            animate={animatedHeight ? {
              height: animatedHeight
            } : {
              height: [8, 32, 16, 24, 12, 28, 8],
            }}
            transition={animatedHeight ? {
              duration: 0.1,
              ease: "easeOut"
            } : {
              duration: 1.5,
              repeat: Infinity,
              delay: index * 0.1,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </div>
  );
}


// Voice Call Panel Component  
function VoiceCallPanel({ 
  state, 
  onClose, 
  onMinimize, 
  onToggleMute, 
  onToggleTranscript, 
  onEndCall,
  roomState,
  localParticipant,
  agentAudioTrack,
  agentState,
  audioLevels
}: {
  state: State;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMute: () => void;
  onToggleTranscript: () => void;
  onEndCall: () => void;
  roomState?: any;
  localParticipant?: any;
  agentAudioTrack?: any;
  agentState?: any;
  audioLevels?: { user: number[]; agent: number[] };
}) {
  const panelRef = useFocusTrap(true);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    if (roomState === 'connecting') return 'Connecting...';
    if (roomState === 'connected' && agentAudioTrack) {
      return `Connected • ${formatDuration(state.callDuration)}`;
    }
    if (roomState === 'connected') return 'Connected';
    return 'Call ended';
  };

  const isConnected = roomState === 'connected';
  const isActive = isConnected && agentAudioTrack;

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-80 h-[500px] md:w-[360px] md:h-[640px] rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ backgroundColor: '#003B2D' }}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#F0FFF5' }}
            >
              <User className="w-4 h-4" style={{ color: '#003B2D' }} />
            </div>
            <div 
              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2"
              style={{ 
                backgroundColor: isActive ? '#35FF7E' : '#6B7280',
                borderColor: '#003B2D'
              }}
            />
          </div>
          <span className="text-white font-medium text-sm">Customer Service Agent</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onMinimize}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Waveform Area */}
      <div className="flex-1 flex flex-col items-center justify-space-between px-6">
        <div 
          className="w-40 h-40 rounded-full border flex items-center justify-center mb-6 mt-8"
          style={{ borderColor: 'rgba(19, 138, 66, 0.25)' }}
        >
          {isActive ? (
            <WaveformBars volumes={audioLevels?.user || audioLevels?.agent} />
          ) : (
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(19, 138, 66, 0.2)' }}
            >
              <Headphones className="w-8 h-8" style={{ color: '#7DFF65' }} />
            </div>
          )}
        </div>
        
        <div 
          className="text-white/80 text-sm text-center"
          aria-live="polite"
        >
          {getStatusMessage()}
          {state.isMuted && isActive && (
            <div className="text-yellow-400 mt-1">You&apos;re muted</div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-4 flex items-center justify-center space-x-6">
        <button
          onClick={onToggleTranscript}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Toggle transcript"
        >
          <MessageCircle className="w-5 h-5" />
        </button>

        {isActive && (
          <div className="flex items-center space-x-1 text-white/60">
            {Array(7).fill(0).map((_, i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  delay: i * 0.2 
                }}
              >
                •
              </motion.span>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            onToggleMute();
            if (localParticipant) {
              localParticipant.setMicrophoneEnabled(state.isMuted);
            }
          }}
          disabled={!isConnected}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-50`}
          style={{
            backgroundColor: state.isMuted ? '#1A4F31' : 'rgba(255, 255, 255, 0.1)',
            color: 'white'
          }}
          onMouseEnter={(e) => {
            if (!state.isMuted && isConnected) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!state.isMuted) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          aria-label={state.isMuted ? 'Unmute' : 'Mute'}
        >
          {state.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onEndCall}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors"
          style={{ backgroundColor: '#EE3A3A' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#CC2E2E';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#EE3A3A';
          }}
          aria-label="End call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// Text Chat Panel Component
function TextChatPanel({ 
  state, 
  onClose, 
  onMinimize, 
  onSendMessage, 
  onUpdateInput 
}: {
  state: State;
  onClose: () => void;
  onMinimize: () => void;
  onSendMessage: (message: string) => void;
  onUpdateInput: (input: string) => void;
}) {
  const panelRef = useFocusTrap(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.textMessages]);

  const handleSend = () => {
    if (state.currentInput.trim()) {
      onSendMessage(state.currentInput);
      onUpdateInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-80 h-[500px] md:w-[360px] md:h-[640px] rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ backgroundColor: '#003B2D' }}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 bg-[#F0FFF5] rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-[#003B2D]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#35FF7E] rounded-full border-2 border-[#003B2D]" />
          </div>
          <span className="text-white font-medium text-sm">Customer Service Agent</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onMinimize}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {state.textMessages.length === 0 && (
          <div className="text-center mt-8" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            <MessageCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#7DFF65' }} />
            <p>Start a conversation with our support team</p>
          </div>
        )}
        
        {state.textMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl ${
                message.sender === 'user'
                  ? 'text-[#003B2D]'
                  : 'text-white'
              }`}
              style={{
                backgroundColor: message.sender === 'user' ? '#7DFF65' : 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <p className="text-sm">{message.message}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-end space-x-2">
          <textarea
            value={state.currentInput}
            onChange={(e) => onUpdateInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 text-white rounded-2xl px-4 py-3 resize-none max-h-24 focus:outline-none text-sm"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid transparent'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#7DFF65';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'transparent';
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!state.currentInput.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: '#7DFF65',
              color: '#003B2D'
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#6EE555';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#7DFF65';
              }
            }}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}


// Main Widget Component
export default function CustomerServiceWidget({ 
  onSessionEnd,
  onConnect,
  liveKitVoiceCallState,
  audioLevels 
}: { 
  onSessionEnd?: () => void;
  onConnect: (connect: boolean) => void;
  liveKitVoiceCallState?: 'connecting' | 'active' | 'ended';
  audioLevels?: { user: number[]; agent: number[] };
}) {
  const [state, dispatch] = useReducer(widgetReducer, initialState);

  // Voice call simulation and LiveKit integration
  useEffect(() => {
    if (state.widgetState === 'inVoiceCall' && state.voiceCallState === 'connecting') {
      // Start LiveKit connection
      onConnect(true);
    }
  }, [state.widgetState, state.voiceCallState, onConnect]);

  // Sync with LiveKit voice call state
  useEffect(() => {
    if (liveKitVoiceCallState && state.widgetState === 'inVoiceCall') {
      dispatch({ type: 'SET_VOICE_STATE', state: liveKitVoiceCallState });
    }
  }, [liveKitVoiceCallState, state.widgetState]);

  // Call duration timer
  useEffect(() => {
    if (state.widgetState === 'inVoiceCall' && state.voiceCallState === 'active') {
      const timer = setInterval(() => {
        dispatch({ type: 'UPDATE_CALL_DURATION' });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state.widgetState, state.voiceCallState]);

  // Text chat simulation
  useEffect(() => {
    if (state.widgetState === 'inTextChat' && state.textMessages.length === 0) {
      const timer = setTimeout(() => {
        dispatch({ 
          type: 'ADD_MESSAGE', 
          sender: 'agent', 
          message: 'Hello! How can I help you today?' 
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.widgetState, state.textMessages.length]);

  // Auto-reply simulation for text chat
  useEffect(() => {
    const lastMessage = state.textMessages[state.textMessages.length - 1];
    if (lastMessage?.sender === 'user') {
      const timer = setTimeout(() => {
        const responses = [
          "Thanks for reaching out! Let me help you with that.",
          "I understand. Let me look into this for you.",
          "That's a great question. Here's what I can tell you...",
          "I'll be happy to assist you with this issue."
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        dispatch({ 
          type: 'ADD_MESSAGE', 
          sender: 'agent', 
          message: randomResponse 
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.textMessages]);

  const handleOpenDialog = () => dispatch({ type: 'OPEN_DIALOG' });
  const handleCloseDialog = () => dispatch({ type: 'CLOSE_DIALOG' });
  
  const handleSelectMethod = (method: ContactMethod) => {
    dispatch({ type: 'SELECT_METHOD', method });
  };

  const handleEndSession = () => {
    dispatch({ type: 'END_SESSION' });
    onConnect(false); // Disconnect from LiveKit
    onSessionEnd?.();
  };

  const handleSendMessage = (message: string) => {
    dispatch({ type: 'ADD_MESSAGE', sender: 'user', message });
  };

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (state.widgetState === 'inVoiceCall') {
        if (e.key.toLowerCase() === 'm' && e.altKey) {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_MUTE' });
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          dispatch({ type: 'MINIMIZE' });
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.widgetState]);

  return (
    <div className="customer-service-widget">
      {/* Floating Action Button */}
      {state.widgetState === 'collapsed' && (
        <FloatingChatButton onClick={handleOpenDialog} />
      )}

      {/* Contact Method Dialog */}
      <ContactMethodDialog
        isOpen={state.widgetState === 'chooseMethod'}
        onClose={handleCloseDialog}
        onSelectMethod={handleSelectMethod}
      />

      {/* Voice Call Panel */}
      <AnimatePresence>
        {state.widgetState === 'inVoiceCall' && (
          <VoiceCallPanel
            state={state}
            onClose={handleEndSession}
            onMinimize={() => dispatch({ type: 'MINIMIZE' })}
            onToggleMute={() => dispatch({ type: 'TOGGLE_MUTE' })}
            onToggleTranscript={() => dispatch({ type: 'TOGGLE_TRANSCRIPT' })}
            onEndCall={handleEndSession}
            roomState={state.voiceCallState === 'connecting' ? 'connecting' : 
                      state.voiceCallState === 'active' ? 'connected' : 'disconnected'}
            localParticipant={null}
            agentAudioTrack={state.voiceCallState === 'active' ? {} : null}
            agentState={state.voiceCallState}
            audioLevels={audioLevels}
          />
        )}
      </AnimatePresence>

      {/* Text Chat Panel */}
      <AnimatePresence>
        {state.widgetState === 'inTextChat' && (
          <TextChatPanel
            state={state}
            onClose={handleEndSession}
            onMinimize={() => dispatch({ type: 'MINIMIZE' })}
            onSendMessage={handleSendMessage}
            onUpdateInput={(input) => dispatch({ type: 'UPDATE_INPUT', input })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}