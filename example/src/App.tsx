// ─────────────────────────────────────────────────────────────────────────────
// @livekit/lynx — example/src/App.tsx
// Full TikTok-style LIVE room built with @livekit/lynx.
//
// Demonstrates:
//   - registerGlobals()
//   - LiveKitRoom component
//   - useTracks / VideoTrack
//   - useLocalParticipant
//   - useParticipants
//   - AudioSession
//   - useIOSAudioManagement
//   - BarVisualizer
//   - Data channel chat
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from '@lynx-js/react';
import {
  registerGlobals,
  LiveKitRoom,
  VideoTrack,
  BarVisualizer,
  AudioSession,
  useIOSAudioManagement,
  useTracks,
  useLocalParticipant,
  useParticipants,
  useDataChannel,
  useConnectionState,
  useVoiceAssistant,
  setLogLevel,
} from '@livekit/lynx';
import { Track, ConnectionState, type Room } from 'livekit-client';

// ── Bootstrap — must be called before any LiveKit usage ──────────────────────
registerGlobals();
setLogLevel('warn');

// ─────────────────────────────────────────────────────────────────────────────
// Config — replace with your values
// ─────────────────────────────────────────────────────────────────────────────
const LIVEKIT_URL    = 'wss://your-server.livekit.cloud';
const TOKEN_ENDPOINT = 'https://your-backend.com/api/livekit-token';

async function fetchToken(roomName: string, identity: string): Promise<string> {
  const resp = await fetch(
    `${TOKEN_ENDPOINT}?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`,
  );
  const json = await resp.json() as { token: string };
  return json.token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const [token, setToken]     = useState<string | undefined>();
  const [joined, setJoined]   = useState(false);
  const [roomRef, setRoomRef] = useState<Room | undefined>();

  const join = useCallback(async () => {
    await AudioSession.startAudioSession();
    const t = await fetchToken('demo-room', `user-${Date.now()}`);
    setToken(t);
    setJoined(true);
  }, []);

  const leave = useCallback(async () => {
    setJoined(false);
    setToken(undefined);
    await AudioSession.stopAudioSession();
  }, []);

  if (!joined) {
    return <LobbyScreen onJoin={join} />;
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={true}
      onConnected={() => console.log('[LiveKit] connected')}
      onDisconnected={() => leave()}
      onError={(err) => console.error('[LiveKit] error', err)}
    >
      <RoomView onLeave={leave} />
    </LiveKitRoom>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomView — rendered inside <LiveKitRoom>
// ─────────────────────────────────────────────────────────────────────────────

function RoomView({ onLeave }: { onLeave: () => void }): JSX.Element {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();

  // All camera tracks (local + remote)
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

  // Data channel chat
  const { lastMessage, send } = useDataChannel('chat');
  const [messages, setMessages] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Collect incoming chat messages
  useEffect(() => {
    if (!lastMessage) return;
    const text = new TextDecoder().decode(lastMessage.payload);
    setMessages((prev) => [...prev.slice(-49), text]);
  }, [lastMessage]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const msg = `${localParticipant?.identity ?? 'me'}: ${chatInput.trim()}`;
    send(new TextEncoder().encode(msg));
    setMessages((prev) => [...prev.slice(-49), msg]);
    setChatInput('');
  }, [chatInput, localParticipant, send]);

  // Local video track for self-view
  const localCamera = cameraTracks.find(
    (t) => t.participant?.isLocal && t.source === Track.Source.Camera,
  );

  // Remote video tracks
  const remoteCameras = cameraTracks.filter(
    (t) => !t.participant?.isLocal,
  );

  const viewerCount = participants.length;

  return (
    <view style={styles.container}>

      {/* ── Full-screen local camera ──────────────────────────────────────── */}
      {localCamera && (
        <VideoTrack
          trackRef={localCamera}
          objectFit="cover"
          mirror={true}
          style={styles.fullscreen}
        />
      )}

      {/* ── Remote participants (grid) ─────────────────────────────────────── */}
      {remoteCameras.length > 0 && (
        <view style={styles.remoteGrid}>
          {remoteCameras.slice(0, 4).map((t) => (
            <view key={t.publication?.trackSid} style={styles.remoteCell}>
              <VideoTrack
                trackRef={t}
                objectFit="cover"
                style={styles.remoteVideo}
              />
              <text style={styles.participantLabel}>
                {t.participant?.identity ?? ''}
              </text>
            </view>
          ))}
        </view>
      )}

      {/* ── AI Voice Assistant visualiser ─────────────────────────────────── */}
      {agentAudioTrack && (
        <view style={styles.agentBar}>
          <BarVisualizer
            state={agentState}
            trackRef={agentAudioTrack}
            barCount={7}
            options={{ barColor: '#fe2c55', barWidth: 6, maxHeight: 0.8 }}
            style={styles.barViz}
          />
        </view>
      )}

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <view style={styles.topBar}>
        <view style={styles.liveBadge}>
          <text style={styles.liveText}>LIVE</text>
        </view>
        <view style={styles.viewerBadge}>
          <text style={styles.viewerText}>👁 {viewerCount}</text>
        </view>
        {connectionState === ConnectionState.Reconnecting && (
          <view style={styles.reconnecting}>
            <text style={styles.reconnectText}>Reconnecting…</text>
          </view>
        )}
        <view style={styles.closeBtn} bindtap={onLeave}>
          <text style={styles.closeBtnText}>✕</text>
        </view>
      </view>

      {/* ── Chat overlay ──────────────────────────────────────────────────── */}
      <view style={styles.chatOverlay}>
        <view style={styles.messageList}>
          {messages.slice(-8).map((msg, i) => (
            <view key={i} style={styles.messageBubble}>
              <text style={styles.messageText}>{msg}</text>
            </view>
          ))}
        </view>
        <view style={styles.chatInputRow}>
          <input
            style={styles.chatInput}
            value={chatInput}
            placeholder="Say something…"
            bindinput={(e: { detail: { value: string } }) =>
              setChatInput(e.detail.value)
            }
          />
          <view style={styles.sendBtn} bindtap={sendChat}>
            <text style={styles.sendBtnText}>➤</text>
          </view>
        </view>
      </view>

    </view>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LobbyScreen
// ─────────────────────────────────────────────────────────────────────────────

function LobbyScreen({ onJoin }: { onJoin: () => void }): JSX.Element {
  return (
    <view style={styles.lobby}>
      <text style={styles.lobbyTitle}>🎥 Go Live</text>
      <text style={styles.lobbySubtitle}>
        Powered by LiveKit + Lynx
      </text>
      <view style={styles.joinBtn} bindtap={onJoin}>
        <text style={styles.joinBtnText}>Start LIVE</text>
      </view>
    </view>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — Lynx CSS-in-JS (same API as React Native StyleSheet)
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, Record<string, unknown>> = {
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  fullscreen: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%',
    height: '100%',
  },
  remoteGrid: {
    position: 'absolute',
    top: 80,
    right: 12,
    flexDirection: 'column',
    gap: 8,
    zIndex: 10,
  },
  remoteCell: {
    width: 90,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  participantLabel: {
    position: 'absolute',
    bottom: 4, left: 4,
    fontSize: 10,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  agentBar: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  barViz: {
    width: 200,
    height: 50,
  },
  topBar: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%',
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
    zIndex: 20,
  },
  liveBadge: {
    backgroundColor: '#fe2c55',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  viewerBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewerText: {
    color: '#fff',
    fontSize: 13,
  },
  reconnecting: {
    backgroundColor: 'rgba(255,165,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 12,
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
  },
  chatOverlay: {
    position: 'absolute',
    bottom: 0, left: 0,
    width: '100%',
    paddingBottom: 24,
    paddingHorizontal: 12,
    zIndex: 20,
  },
  messageList: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 8,
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 13,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fe2c55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 18,
  },
  lobby: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  lobbyTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  lobbySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  joinBtn: {
    marginTop: 20,
    backgroundColor: '#fe2c55',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 32,
  },
  joinBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
};
