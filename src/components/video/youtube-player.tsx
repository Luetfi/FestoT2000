'use client';

import { useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';

interface YouTubePlayerProps {
  videoId: string;
  startTime: number;
  autoPlay?: boolean;
  onReady?: () => void;
  className?: string;
}

export function YouTubePlayer({
  videoId,
  startTime,
  autoPlay = false,
  onReady,
  className,
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      start: Math.floor(startTime),
      autoplay: autoPlay ? 1 : 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  const handleReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    onReady?.();
  };

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy?.();
        } catch (e) {
          // Player might already be destroyed
        }
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div className={className}>
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        className="w-full aspect-video"
        iframeClassName="w-full h-full rounded-lg"
      />
    </div>
  );
}
