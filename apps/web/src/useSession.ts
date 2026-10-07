import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, CommandInput, SessionSnapshot } from '@poker/shared';
import { api, ApiError } from './api';
export function useSession(code: string) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null),
    [loading, setLoading] = useState(true),
    [joinNeeded, setJoinNeeded] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false);
  const current = useRef<SessionSnapshot | null>(null);
  const sending = useRef(false);
  const uncertain = useRef<{ key: string; command: Command } | null>(null);
  const accept = useCallback((next: SessionSnapshot) => {
    if (!current.current || next.revision >= current.current.revision) {
      current.current = next;
      setSnapshot(next);
      setJoinNeeded(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api
      .get(code)
      .then((s) => {
        if (active) accept(s);
      })
      .catch((e) => {
        if (active) {
          if (e instanceof ApiError && [401, 403].includes(e.status)) setJoinNeeded(true);
          else setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, accept]);
  const member = !!snapshot;
  useEffect(() => {
    if (!member) return;
    let disposed = false;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let failures = 0;
    let lastSequence = 0;
    function connect() {
      lastSequence = 0;
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
          location.host
        }/api/sessions/${code}/ws`,
      );
      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'snapshot' && event.sequence >= lastSequence) {
            lastSequence = event.sequence;
            accept(event.data);
            setConnected(true);
            failures = 0;
          }
        } catch {
          setError('No pudimos sincronizar la sesión.');
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        setConnected(false);
        retry = setTimeout(connect, Math.min(1000 * 2 ** failures++, 10000));
      };
      socket.onerror = () => socket.close();
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.close();
      setConnected(false);
    };
  }, [code, member, accept]);
  const send = async (input: CommandInput) => {
    if (!current.current || sending.current || !connected) return false;
    sending.current = true;
    setBusy(true);
    setError('');
    const key = JSON.stringify(input);
    if (uncertain.current?.key !== key)
      uncertain.current = {
        key,
        command: {
          ...input,
          expectedRevision: current.current.revision,
          requestId: crypto.randomUUID(),
        },
      };
    try {
      accept(await api.command(code, uncertain.current.command));
      uncertain.current = null;
      return true;
    } catch (e) {
      if (e instanceof ApiError) uncertain.current = null;
      setError(
        e instanceof ApiError
          ? e.message
          : 'No recibimos la confirmación. Revisa el estado; puedes reintentar sin duplicar la operación.',
      );
      try {
        accept(await api.get(code));
      } catch {
        setConnected(false);
      }
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return { snapshot, loading, joinNeeded, error, setError, connected, busy, send, accept };
}
