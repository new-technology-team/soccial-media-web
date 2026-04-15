import { io, type Socket } from 'socket.io-client'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.NEXT_PUBLIC_SOCKET_URL ||
  'http://localhost:5000'

let socketInstance: Socket | null = null

export const connectSocket = (token: string) => {
  if (socketInstance?.connected) {
    return socketInstance
  }

  socketInstance = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'],
    auth: { token },
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
