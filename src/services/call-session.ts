// Module-level WebRTC refs — survive React component lifecycle (persist across navigation)
export const callSession = {
  peers: new Map<number, RTCPeerConnection>(),
  pendingCandidates: new Map<number, RTCIceCandidateInit[]>(),
  localStream: null as MediaStream | null,
}
