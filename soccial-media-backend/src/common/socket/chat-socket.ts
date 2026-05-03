import { Server } from 'socket.io';

let chatSocketServer: Server | null = null;

export const setChatSocketServer = (server: Server) => {
	chatSocketServer = server;
};

export const getChatSocketServer = (): Server | null => chatSocketServer;

export const emitToConversation = (
  conversationId: string,
  eventName: string,
  payload: any,
) => {
  if (chatSocketServer) {
    chatSocketServer.to(String(conversationId)).emit(eventName, payload);
  }
};

export const relayConversationEvent = (
  socket: { to: (roomId: string) => { emit: (eventName: string, payload: any) => void } },
  eventName: string,
  payload: any,
) => {
  const conversationId = String(payload?.conversationId || '').trim();
  if (!conversationId) return;
  socket.to(conversationId).emit(eventName, payload);
};

export const registerChatSocketHandlers = () => {
	// Handlers are now in ChatGateway
};
