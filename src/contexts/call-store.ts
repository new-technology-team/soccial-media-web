import { create } from 'zustand'
import type { CallState, CallParticipant } from '@/components/call'

export type IncomingCallState = {
  fromUserId: number
  conversationId: string | null
  callType: 'voice' | 'video'
  offer: RTCSessionDescriptionInit
  fromUserName?: string
  conversationName?: string
  fromUserAvatar?: string | null
}

export type ActiveCall = {
  type: 'voice' | 'video'
  withName: string
  startedAt: number
  mode: 'private' | 'group'
  avatarUrl?: string | null
  conversationId: string | null
  targetUserIds: number[]
}

type CallStoreState = {
  incomingCall: IncomingCallState | null
  setIncomingCall: (call: IncomingCallState | null) => void
  acceptPending: boolean
  setAcceptPending: (v: boolean) => void

  // Active call session state — persists across navigation
  activeCall: ActiveCall | null
  setActiveCall: (call: ActiveCall | null | ((p: ActiveCall | null) => ActiveCall | null)) => void
  callState: CallState
  setCallState: (s: CallState) => void
  callAnswered: boolean
  setCallAnswered: (v: boolean) => void
  callMinimized: boolean
  setCallMinimized: (v: boolean) => void
  mutedMic: boolean
  setMutedMic: (v: boolean) => void
  mutedCam: boolean
  setMutedCam: (v: boolean) => void
  callSeconds: number
  setCallSeconds: (v: number) => void
  cameraAvailable: boolean
  setCameraAvailable: (v: boolean) => void
  callParticipants: CallParticipant[]
  setCallParticipants: (p: CallParticipant[]) => void
  localStream: MediaStream | null
  setLocalStream: (s: MediaStream | null) => void
  remoteStreams: Array<{ userId: number; stream: MediaStream }>
  setRemoteStreams: (s: Array<{ userId: number; stream: MediaStream }>) => void
}

export const useCallStore = create<CallStoreState>((set, get) => ({
  incomingCall: null,
  setIncomingCall: (call) => set({ incomingCall: call }),
  acceptPending: false,
  setAcceptPending: (v) => set({ acceptPending: v }),

  activeCall: null,
  setActiveCall: (call) =>
    set({ activeCall: typeof call === 'function' ? call(get().activeCall) : call }),
  callState: 'idle',
  setCallState: (s) => set({ callState: s }),
  callAnswered: false,
  setCallAnswered: (v) => set({ callAnswered: v }),
  callMinimized: false,
  setCallMinimized: (v) => set({ callMinimized: v }),
  mutedMic: false,
  setMutedMic: (v) => set({ mutedMic: v }),
  mutedCam: false,
  setMutedCam: (v) => set({ mutedCam: v }),
  callSeconds: 0,
  setCallSeconds: (v) => set({ callSeconds: v }),
  cameraAvailable: true,
  setCameraAvailable: (v) => set({ cameraAvailable: v }),
  callParticipants: [],
  setCallParticipants: (p) => set({ callParticipants: p }),
  localStream: null,
  setLocalStream: (s) => set({ localStream: s }),
  remoteStreams: [],
  setRemoteStreams: (s) => set({ remoteStreams: s }),
}))
