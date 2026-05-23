import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '')
  : 'http://localhost:5000';

let sharedSocket = null;

const getSocket = () => {
  if (!sharedSocket || sharedSocket.disconnected) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 2000,
    });
  }
  return sharedSocket;
};

/**
 * Subscribe to live candle updates for a symbol.
 * @param {string} symbol  - e.g. 'RELIANCE'
 * @param {function} onTick - receives { time, open, high, low, close, volume }
 */
const useChartSocket = (symbol, onTick) => {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const handleTick = useCallback((payload) => {
    if (payload?.symbol === symbol && typeof onTickRef.current === 'function') {
      onTickRef.current(payload);
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    const socket = getSocket();

    // Subscribe to chart room for this symbol
    socket.emit('subscribe', { channel: `chart:${symbol}` });
    socket.on('candle_update', handleTick);
    socket.on('ticker', handleTick);

    return () => {
      socket.off('candle_update', handleTick);
      socket.off('ticker', handleTick);
      socket.emit('unsubscribe', { channel: `chart:${symbol}` });
    };
  }, [symbol, handleTick]);
};

export default useChartSocket;
