'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecorderMessage, TranscriptSegment } from '@/lib/types/transcripts';

export type RecorderState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'reconnecting'
  | 'stopping'
  | 'stopped'
  | 'error';

/** Waits between reconnection attempts. Six tries over about half a minute. */
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 8_000, 8_000];
/** How often MediaRecorder hands over audio. Small enough for live captions. */
const CHUNK_MS = 250;
/** Tells the server a paused recording is still wanted. */
const HEARTBEAT_MS = 30_000;
/** How long to wait for the server to flush the last words after Stop. */
const STOP_TIMEOUT_MS = 20_000;

/**
 * Same origin in production, where nginx sends this path straight to the API.
 * NEXT_PUBLIC_TRANSCRIPTION_WS_URL points local development at the API port,
 * because the Next rewrite that carries /api/* does not carry WebSockets.
 */
function socketUrl(eventId: string): string {
  const override = process.env.NEXT_PUBLIC_TRANSCRIPTION_WS_URL;
  const base =
    override ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/transcription`;
  return `${base}?eventId=${encodeURIComponent(eventId)}`;
}

/**
 * Opus in a webm container where the browser can make one (Chrome, Edge,
 * Firefox, recent Safari); the provider reads the format from its header.
 */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!pickMimeType()
  );
}

/**
 * Captures the microphone and streams it to the transcription socket.
 *
 * The audio is never kept in the browser either: each chunk is handed to the
 * socket the moment MediaRecorder produces it and then dropped. What
 * accumulates here is text.
 */
export function useMeetingRecorder(eventId: string) {
  const [state, setStateValue] = useState<RecorderState>('idle');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState<{ text: string; speaker: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const stateRef = useRef<RecorderState>('idle');
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const pausedRef = useRef(false);
  const stoppingRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  /** connect() schedules itself on a dropped socket; this breaks the cycle. */
  const connectRef = useRef<() => void>(() => {});

  const setState = useCallback((next: RecorderState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  // A running clock of time actually recorded, not wall time.
  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);
    return () => clearInterval(t);
  }, [state]);

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.ondataavailable = null;
      rec.stop();
    }
  }, []);

  /** Release the microphone and everything holding the session open. */
  const teardown = useCallback(() => {
    stopRecorder();
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    heartbeatRef.current = retryRef.current = stopTimerRef.current = null;
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    const ws = socketRef.current;
    socketRef.current = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    setInterim(null);
  }, [stopRecorder]);

  const startRecorder = useCallback((ws: WebSocket) => {
    const media = mediaRef.current;
    if (!media) return;
    // A new recorder per connection: the provider needs the container header
    // at the start of every stream, and only a fresh recorder sends one.
    const rec = new MediaRecorder(media, {
      mimeType: pickMimeType(),
      audioBitsPerSecond: 32_000,
    });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
    };
    rec.start(CHUNK_MS);
    if (pausedRef.current) rec.pause();
    recorderRef.current = rec;
  }, []);

  const connect = useCallback(() => {
    const ws = new WebSocket(socketUrl(eventId));
    socketRef.current = ws;
    let fatal = false;

    ws.onmessage = (event) => {
      let msg: RecorderMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'ready':
          attemptRef.current = 0;
          setError(null);
          startRecorder(ws);
          setState(pausedRef.current ? 'paused' : 'recording');
          break;
        case 'interim':
          setInterim({ text: msg.segment.text, speaker: msg.segment.speaker });
          break;
        case 'final':
          setSegments((prev) => [...prev, msg.segment]);
          setInterim(null);
          break;
        case 'error':
          setError(msg.message);
          if (msg.fatal) {
            fatal = true;
            teardown();
            setState('error');
          }
          break;
        case 'stopped':
          teardown();
          setState(msg.failed ? 'error' : 'stopped');
          if (msg.failed) {
            setError(
              'The transcription service disconnected. What was said up to that point has been saved.',
            );
          }
          break;
      }
    };

    ws.onclose = () => {
      if (socketRef.current !== ws) return; // superseded or torn down
      if (fatal) return;
      if (stoppingRef.current) {
        // Closed before confirming; the server keeps what it received.
        teardown();
        setState('stopped');
        return;
      }
      stopRecorder();
      const attempt = attemptRef.current++;
      if (attempt >= BACKOFF_MS.length) {
        teardown();
        setError(
          'The connection was lost and could not be restored. What was said before it dropped has been saved — start again to carry on.',
        );
        setState('error');
        return;
      }
      setState('reconnecting');
      retryRef.current = setTimeout(() => connectRef.current(), BACKOFF_MS[attempt]);
    };
  }, [eventId, setState, startRecorder, stopRecorder, teardown]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not supported or refused; the recording still works with the screen on.
    }
  }, []);

  // A wake lock is dropped whenever the tab is hidden; take it back.
  useEffect(() => {
    const onVisible = () => {
      const s = stateRef.current;
      if (document.visibilityState === 'visible' && (s === 'recording' || s === 'paused')) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [requestWakeLock]);

  const start = useCallback(async () => {
    setError(null);
    stoppingRef.current = false;
    pausedRef.current = false;
    attemptRef.current = 0;
    setState('starting');
    try {
      mediaRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
          : 'No microphone could be opened on this device.',
      );
      setState('error');
      return;
    }
    void requestWakeLock();
    connect();
  }, [connect, requestWakeLock, setState]);

  const pause = useCallback(() => {
    if (stateRef.current !== 'recording') return;
    pausedRef.current = true;
    recorderRef.current?.pause();
    heartbeatRef.current = setInterval(() => {
      const ws = socketRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'heartbeat' }));
    }, HEARTBEAT_MS);
    setState('paused');
  }, [setState]);

  const resume = useCallback(() => {
    if (stateRef.current !== 'paused') return;
    pausedRef.current = false;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    recorderRef.current?.resume();
    setState('recording');
  }, [setState]);

  const stop = useCallback(() => {
    const s = stateRef.current;
    if (s !== 'recording' && s !== 'paused' && s !== 'reconnecting') return;
    stoppingRef.current = true;
    setState('stopping');

    const ws = socketRef.current;
    const rec = recorderRef.current;
    const sendStop = () => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }));
      else {
        teardown();
        setState('stopped');
      }
    };
    // Let the recorder hand over its last partial chunk before saying stop,
    // or the final second of the meeting never reaches the transcriber.
    if (rec && rec.state !== 'inactive') {
      rec.onstop = sendStop;
      rec.stop();
      recorderRef.current = null;
    } else {
      sendStop();
    }
    stopTimerRef.current = setTimeout(() => {
      teardown();
      setState('stopped');
    }, STOP_TIMEOUT_MS);
  }, [setState, teardown]);

  // Leaving the page ends the recording properly rather than dropping it.
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => () => stopRef.current(), []);

  return { state, segments, interim, error, elapsedMs, start, pause, resume, stop };
}
