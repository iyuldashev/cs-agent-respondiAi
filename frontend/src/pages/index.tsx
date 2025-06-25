import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import Head from "next/head";
import { useCallback, useState } from "react";

import CustomerServiceWidget from "@/components/CustomerServiceWidget";
import LiveKitVoiceHandler from "@/components/LiveKitVoiceHandler";
import { PlaygroundToast, ToastType } from "@/components/toast/PlaygroundToast";
import Navigation from "@/landing/Navigation";
import Hero from "@/landing/Hero";
import Features from "@/landing/Features";
import Pricing from "@/landing/Pricing";
import Footer from "@/landing/Footer";
import { ConnectionProvider, useConnection } from "@/hooks/useConnection";

export default function Home() {
  return (
    <ConnectionProvider>
      <HomeInner />
    </ConnectionProvider>
  );
}

export function HomeInner() {
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [voiceCallState, setVoiceCallState] = useState<'connecting' | 'active' | 'ended'>('ended');
  const [audioLevels, setAudioLevels] = useState<{ user: number[]; agent: number[] }>({ user: [], agent: [] });
  const { shouldConnect, wsUrl, token, connect, disconnect } = useConnection();

  const title = "Respondi.ai - Respond Instantly, Every Time";
  const description =
    "Deploy AI-powered customer support that responds instantly to every inquiry. Voice and text chat that never sleeps, never gets tired, and always delivers perfect responses.";

  const handleConnect = useCallback(
    async (c: boolean) => {
      c ? connect() : disconnect();
    },
    [connect, disconnect]
  );

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="og:title" content={title} />
        <meta name="og:description" content={description} />
        <meta
          property="og:image"
          content="/og.png"
        />
        <meta name="twitter:site" content="@Respondi_ai"></meta>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta
          property="twitter:image"
          content="/og.png"
        />
        <meta property="twitter:image:width" content="1600" />
        <meta property="twitter:image:height" content="836" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta property="og:image:width" content="1600" />
        <meta property="og:image:height" content="836" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="bg-gray-900">
        {/* Navigation */}
        <Navigation />
        
        {/* Toast Messages */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className="left-0 right-0 top-0 absolute z-50"
              initial={{ opacity: 0, translateY: -50 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -50 }}
            >
              <PlaygroundToast
                message={toastMessage.message}
                type={toastMessage.type}
                onDismiss={() => {
                  setToastMessage(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Hidden LiveKit Room for Voice Functionality */}
        <LiveKitRoom
          className="hidden"
          serverUrl={wsUrl}
          token={token}
          connect={shouldConnect}
          onError={(e) => {
            setToastMessage({ message: e.message, type: "error" });
            console.error(e);
          }}
        >
          <RoomAudioRenderer />
          <StartAudio label="Click to enable audio playback" />
          <LiveKitVoiceHandler 
            onVoiceCallStateChange={setVoiceCallState}
            onMuteChange={(isMuted) => {/* Handle mute state */}}
            onAudioLevelsChange={setAudioLevels}
          />
        </LiveKitRoom>

        {/* Landing Page Sections */}
        <Hero />
        <Features />
        <Pricing />
        <Footer />

        {/* Customer Service Widget - Always Present */}
        <CustomerServiceWidget 
          onConnect={handleConnect}
          onSessionEnd={() => console.log('Customer service session ended')}
          liveKitVoiceCallState={voiceCallState}
          audioLevels={audioLevels}
        />
      </main>
    </>
  );
}
