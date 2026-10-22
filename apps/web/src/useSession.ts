import { newRequestId } from './requestId';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Command, CommandInput, SessionSnapshot } from '@poker/shared';
import { api, ApiError } from './api';
export function useSession(code: string) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null),
    [loading, setLoading] = useState(true),
    [joinNeeded, setJoinNeeded] = useState(false),
    [removed, setRemoved] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false);
  const current = useRef<SessionSnapshot | null>(null);
  const sending = useRef(false);
  const uncertain = useRef<{ key: string; command: Command } | null>(null);
  const revoked = useRef(false);
  const membershipGeneration = useRef(0);
  const markRemoved = useCallback(() => {
    if (revoked.current) return;
    revoked.current = true;
    membershipGeneration.current++;
    current.current = null;
    uncertain.current = null;
    sending.current = false;
    setBusy(false);
    setSnapshot(null);
    setConnected(false);
    setRemoved(true);
  }, []);
  const accept = useCallback(
    (next: SessionSnapshot) => {
      if (revoked.current) return;
      if (current.current && current.current.selfId !== next.selfId) {
        markRemoved();
        return;
      }
      if (!current.current || next.revision >= current.current.revision) {
        current.current = next;
        setSnapshot(next);
        setJoinNeeded(false);
      }
    },
    [markRemoved],
  );
  const acceptJoined = useCallback(
    (next: SessionSnapshot) => {
      membershipGeneration.current++;
      revoked.current = false;
      sending.current = false;
      uncertain.current = null;
      setBusy(false);
      setRemoved(false);
      setError('');
      accept(next);
    },
    [accept],
  );
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
        if (disposed || revoked.current) return;
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'participant.removed') {
            markRemoved();
            return;
          }
          if (event.type === 'snapshot' && event.sequence >= lastSequence) {
            lastSequence = event.sequence;
            accept(event.data);
            if (revoked.current) return;
            setConnected(true);
            failures = 0;
          }
        } catch {
          setError('No pudimos sincronizar la sesión.');
        }
      };
      socket.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4003) {
          markRemoved();
          return;
        }
        if (revoked.current) return;
        setConnected(false);
        // Una expulsión ocurrida durante un corte de red puede perder su aviso.
        void api
          .get(code)
          .then((next) => {
            if (!disposed) accept(next);
          })
          .catch((error) => {
            if (!disposed && error instanceof ApiError && [401, 403].includes(error.status))
              markRemoved();
          });
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
  }, [code, member, accept, markRemoved]);
  const send = async (input: CommandInput) => {
    if (!current.current || sending.current || !connected) return false;
    const generation = membershipGeneration.current;
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
          requestId: newRequestId(),
        },
      };
    try {
      const next = await api.command(code, uncertain.current.command);
      if (generation !== membershipGeneration.current) return false;
      accept(next);
      uncertain.current = null;
      return true;
    } catch (e) {
      if (generation !== membershipGeneration.current) return false;
      if (e instanceof ApiError) uncertain.current = null;
      setError(
        e instanceof ApiError
          ? e.message
          : 'No recibimos la confirmación. Revisa el estado; puedes reintentar sin duplicar la operación.',
      );
      try {
        const next = await api.get(code);
        if (generation === membershipGeneration.current) accept(next);
      } catch (refreshError) {
        if (
          generation === membershipGeneration.current &&
          refreshError instanceof ApiError &&
          [401, 403].includes(refreshError.status)
        )
          markRemoved();
        // El WebSocket controla la conexión. Un GET fallido no debe bloquear
        // permanentemente las cartas si el socket sigue recibiendo snapshots.
      }
      return false;
    } finally {
      if (generation === membershipGeneration.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  };
  return {
    snapshot,
    loading,
    joinNeeded,
    removed,
    error,
    setError,
    connected,
    busy,
    send,
    accept: acceptJoined,
  };
}
