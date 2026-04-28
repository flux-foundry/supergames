import { useEffect, useState, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState } from '../lib/physics';

export type Message = 
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'FLAP' }
  | { type: 'START_GAME'; state?: GameState }
  | { type: 'REMATCH_REQUEST' }
  | { type: 'QUIT_REQUEST' }
  | { type: 'QUIT_GAME' }
  | { type: 'TOGGLE_PAUSE' };

export const useMultiplayer = (onMessageCallback: (msg: Message) => void) => {
  const [peerId, setPeerId] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [error, setError] = useState<string>('');
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef(onMessageCallback);

  // Update the ref to always point to the latest callback without triggering re-renders
  useEffect(() => {
    onMessageRef.current = onMessageCallback;
  }, [onMessageCallback]);

  const setupConn = useCallback((conn: DataConnection) => {
    conn.on('data', (data: any) => {
      onMessageRef.current(data as Message);
    });
    conn.on('close', () => {
      setConnected(false);
    });
    conn.on('error', (err) => {
      setError(err.message);
    });
  }, []);

  useEffect(() => {
    // Generate a random 5-digit code
    const shortId = Math.floor(10000 + Math.random() * 90000).toString();
    const peer = new Peer(shortId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setRole('host');
      setConnected(true);
      setupConn(conn);
    });

    peer.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      peer.destroy();
    };
  }, [setupConn]);

  const hostGame = useCallback(() => {
    setRole('host');
  }, []);

  const joinGame = useCallback((partnerId: string) => {
    if (!partnerId) return;
    const conn = peerRef.current?.connect(partnerId);
    if (conn) {
      connRef.current = conn;
      setRole('guest');
      setConnected(true);
      setupConn(conn);
    }
  }, [setupConn]);

  const sendMessage = useCallback((msg: Message) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    }
  }, []);

  return {
    peerId,
    connected,
    role,
    error,
    hostGame,
    joinGame,
    sendMessage,
  };
};
