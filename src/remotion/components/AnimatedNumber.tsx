import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  delay?: number;
  duration?: number;
  style?: React.CSSProperties;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  delay = 0,
  duration = 20,
  style,
}) => {
  const frame = useCurrentFrame();
  const animated = interpolate(frame - delay, [0, duration], [0, value], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <span style={style}>{format(animated)}</span>;
};
