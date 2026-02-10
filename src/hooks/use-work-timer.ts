"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "work-timer-state";
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  elapsedSeconds: number;
}

export function useWorkTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showInactivityDialog, setShowInactivityDialog] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Load timer state from localStorage on mount
  useEffect(() => {
    const loadTimerState = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const state: TimerState = JSON.parse(stored);
          if (state.isRunning && state.startTime) {
            // Calculate elapsed time since start
            const now = Date.now();
            const elapsed = Math.floor((now - state.startTime) / 1000);
            setElapsedSeconds(elapsed);
            setIsRunning(true);
            startTimeRef.current = state.startTime;
            lastActivityRef.current = now;
          }
        }
      } catch (error) {
        console.error("Failed to load timer state:", error);
      }
    };

    loadTimerState();
  }, []);

  // Save timer state to localStorage
  const saveTimerState = useCallback((running: boolean, startTime: number | null, elapsed: number) => {
    try {
      const state: TimerState = {
        isRunning: running,
        startTime,
        elapsedSeconds: elapsed,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save timer state:", error);
    }
  }, []);

  // Track user activity
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If inactivity dialog is showing and user is active, close it and continue timer
    if (showInactivityDialog) {
      setShowInactivityDialog(false);
    }
  }, [showInactivityDialog]);

  // Set up activity listeners
  useEffect(() => {
    if (!isRunning) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isRunning, handleActivity]);

  // Check for inactivity
  useEffect(() => {
    if (!isRunning) {
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
        inactivityCheckRef.current = null;
      }
      return;
    }

    // Check every 30 seconds for inactivity
    inactivityCheckRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        // Show inactivity dialog
        setShowInactivityDialog(true);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current);
        inactivityCheckRef.current = null;
      }
    };
  }, [isRunning]);

  // Timer interval
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current!) / 1000);
        setElapsedSeconds(elapsed);
        saveTimerState(true, startTimeRef.current, elapsed);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, saveTimerState]);

  // Handle browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isRunning && startTimeRef.current) {
        saveTimerState(true, startTimeRef.current, elapsedSeconds);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRunning, elapsedSeconds, saveTimerState]);

  const startTimer = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    lastActivityRef.current = now;
    setIsRunning(true);
    setElapsedSeconds(0);
    saveTimerState(true, now, 0);
  }, [saveTimerState]);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (inactivityCheckRef.current) {
      clearInterval(inactivityCheckRef.current);
      inactivityCheckRef.current = null;
    }
    saveTimerState(false, null, 0);
  }, [saveTimerState]);

  const resetTimer = useCallback(() => {
    setElapsedSeconds(0);
    startTimeRef.current = null;
    saveTimerState(false, null, 0);
  }, [saveTimerState]);

  const handleInactivityContinue = useCallback(() => {
    setShowInactivityDialog(false);
    lastActivityRef.current = Date.now();
  }, []);

  const handleInactivityStop = useCallback(() => {
    setShowInactivityDialog(false);
    stopTimer();
  }, [stopTimer]);

  return {
    isRunning,
    elapsedSeconds,
    showInactivityDialog,
    startTimer,
    stopTimer,
    resetTimer,
    handleInactivityContinue,
    handleInactivityStop,
  };
}
