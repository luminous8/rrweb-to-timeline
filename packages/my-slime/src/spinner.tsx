import { useEffect, useState } from "react";
import { COLORS } from "./constants";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const SPINNER_INTERVAL_MS = 80;

interface SpinnerProps {
  message: string;
}

export const Spinner = ({ message }: SpinnerProps) => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((previous) => (previous + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <text fg={COLORS.DIM}>
      <span fg={COLORS.SELECTION}>{SPINNER_FRAMES[frameIndex]}</span>
      <span> {message}</span>
    </text>
  );
};
