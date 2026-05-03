import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socketInstance: Socket | null = null;

export const getSocket = (): Socket | null => socketInstance;

export const connectSocket = (token: string): Socket => {
  if (socketInstance) {
    socketInstance.disconnect();
  }
  socketInstance = io(SOCKET_URL, {
    autoConnect: true,
    transports: ["websocket"],
    auth: { token }
  });
  return socketInstance;
};

export const disconnectSocket = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
