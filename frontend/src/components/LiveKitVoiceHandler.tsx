import React, { useEffect } from 'react';
import {
  useConnectionState,
  useLocalParticipant,
  useVoiceAssistant,
  useTracks,
} from "@livekit/components-react";
import { useMultibandTrackVolume } from "@/hooks/useTrackVolume";
import { ConnectionState, Track, LocalParticipant } from "livekit-client";

interface LiveKitVoiceHandlerProps {
  onVoiceCallStateChange: (state: 'connecting' | 'active' | 'ended') => void;
  onMuteChange: (isMuted: boolean) => void;
  onAudioLevelsChange: (levels: { user: number[]; agent: number[] }) => void;
}

export default function LiveKitVoiceHandler({
  onVoiceCallStateChange,
  onMuteChange,
  onAudioLevelsChange
}: LiveKitVoiceHandlerProps) {
  const roomState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const { audioTrack: agentAudioTrack } = useVoiceAssistant();
  const tracks = useTracks();

  // Get local microphone track
  const localTracks = tracks.filter(
    ({ participant }) => participant instanceof LocalParticipant
  );
  const localMicTrack = localTracks.find(
    ({ source }) => source === Track.Source.Microphone
  );

  // Get audio levels for visualization
  const userAudioLevels = useMultibandTrackVolume(
    localMicTrack?.publication.track,
    7
  );
  
  const agentAudioLevels = useMultibandTrackVolume(
    agentAudioTrack?.publication?.track,
    7
  );

  // Update voice call state based on LiveKit connection
  useEffect(() => {
    if (roomState === ConnectionState.Connecting) {
      onVoiceCallStateChange('connecting');
    } else if (roomState === ConnectionState.Connected && agentAudioTrack) {
      onVoiceCallStateChange('active');
    } else if (roomState === ConnectionState.Disconnected) {
      onVoiceCallStateChange('ended');
    }
  }, [roomState, agentAudioTrack, onVoiceCallStateChange]);

  // Enable microphone when connected
  useEffect(() => {
    if (roomState === ConnectionState.Connected) {
      localParticipant.setMicrophoneEnabled(true);
    }
  }, [localParticipant, roomState]);

  // Send audio levels to parent component
  useEffect(() => {
    if (userAudioLevels || agentAudioLevels) {
      const convertToNumbers = (levels: Float32Array[] | undefined): number[] => {
        if (!levels) return [];
        return levels.map(band => Array.from(band)).flat();
      };

      onAudioLevelsChange({
        user: convertToNumbers(userAudioLevels),
        agent: convertToNumbers(agentAudioLevels)
      });
    }
  }, [userAudioLevels, agentAudioLevels, onAudioLevelsChange]);

  // This component doesn't render anything, it just handles LiveKit state
  return null;
}