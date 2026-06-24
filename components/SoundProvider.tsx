"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type SoundContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  playClick: () => void;
  playSelect: () => void;
  playSuccess: () => void;
  playCountdownTick: (remainingSeconds: number) => void;
};

const storageKey = "punktlandung-sound-enabled";

const SoundContext = createContext<SoundContextValue>({
  enabled: true,
  setEnabled: () => undefined,
  toggle: () => undefined,
  playClick: () => undefined,
  playSelect: () => undefined,
  playSuccess: () => undefined,
  playCountdownTick: () => undefined
});

function initialEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey) !== "false";
  } catch {
    return true;
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(initialEnabled);
  const audioRef = useRef<AudioContext | null>(null);

  const getAudio = useCallback(() => {
    if (typeof window === "undefined" || !enabled) return null;
    const audioWindow = window as AudioWindow;
    const AudioCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioRef.current) audioRef.current = new AudioCtor();
    if (audioRef.current.state === "suspended") void audioRef.current.resume();
    return audioRef.current;
  }, [enabled]);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
    try {
      window.localStorage.setItem(storageKey, String(nextEnabled));
    } catch {
      // Sound still works for this session if storage is blocked.
    }
  }, []);

  const playTone = useCallback(
    (frequency: number, startOffset: number, duration: number, volume: number, type: OscillatorType = "sine", bend = 1.08) => {
      const audio = getAudio();
      if (!audio) return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + startOffset;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * bend), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    },
    [getAudio]
  );

  const playNoise = useCallback(
    (startOffset: number, duration: number, volume: number) => {
      const audio = getAudio();
      if (!audio) return;
      const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
      }
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      const start = audio.currentTime + startOffset;
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1200, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      source.start(start);
      source.stop(start + duration + 0.02);
    },
    [getAudio]
  );

  const playClick = useCallback(() => {
    playTone(420, 0, 0.055, 0.035, "triangle");
  }, [playTone]);

  const playSelect = useCallback(() => {
    playTone(520, 0, 0.07, 0.038, "triangle");
    playTone(780, 0.035, 0.08, 0.028, "sine");
  }, [playTone]);

  const playSuccess = useCallback(() => {
    playNoise(0, 0.16, 0.075);
    playTone(130.81, 0, 0.22, 0.055, "sawtooth", 0.72);
    [523.25, 659.25, 783.99].forEach((frequency) => {
      playTone(frequency, 0.04, 0.34, 0.042, "triangle", 1.02);
    });
    [659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((frequency, index) => {
      playTone(frequency, 0.16 + index * 0.075, 0.24, 0.06 - index * 0.004, index > 2 ? "sine" : "triangle", 1.12);
    });
    [1046.5, 1318.51, 1567.98].forEach((frequency) => {
      playTone(frequency, 0.58, 0.46, 0.038, "sine", 1.01);
    });
    playTone(2093, 0.72, 0.28, 0.026, "sine", 1.04);
  }, [playNoise, playTone]);

  const playCountdownTick = useCallback(
    (remainingSeconds: number) => {
      if (remainingSeconds <= 1) {
        playTone(740, 0, 0.82, 0.052, "triangle", 0.98);
        playTone(370, 0.03, 0.82, 0.03, "sine", 0.98);
        return;
      }
      playTone(740, 0, 0.085, 0.04, "triangle", 0.96);
    },
    [playTone]
  );

  const toggle = useCallback(() => {
    const nextEnabled = !enabled;
    if (enabled) playClick();
    setEnabled(nextEnabled);
    if (nextEnabled) {
      window.setTimeout(() => playSelect(), 0);
    }
  }, [enabled, playClick, playSelect, setEnabled]);

  useEffect(() => {
    return () => {
      void audioRef.current?.close();
    };
  }, []);

  const value = useMemo(
    () => ({ enabled, setEnabled, toggle, playClick, playSelect, playSuccess, playCountdownTick }),
    [enabled, playClick, playCountdownTick, playSelect, playSuccess, setEnabled, toggle]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
