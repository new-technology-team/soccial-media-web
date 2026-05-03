import { io, type Socket } from 'socket.io-client'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.NEXT_PUBLIC_SOCKET_URL ||
  'http://localhost:5000'

let socketInstance: Socket | null = null

export const connectSocket = (token: string, userId?: number) => {
  if (socketInstance?.connected) {
    return socketInstance
  }

  socketInstance = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['polling', 'websocket'],
    auth: {
      token,
      userId: Number(userId || 0) || undefined,
    },
  })

  return socketInstance
}

export const getSocket = () => socketInstance

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
