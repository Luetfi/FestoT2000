'use client';

import { useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';

interface YouTubePlayerProps {
  videoId: string;
  startTime: number;
  onReady?: () => void;
  className?: string;
}

export function YouTubePlayer({
  videoId,
  startTime,
  onReady,
  className,
}: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      start: startTime,
      autoplay: 0,
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

  // Seek to new start time when it changes
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState?.();
      if (state === -1 || state === 5) {
        // Video unstarted or cued — cueVideoById shows the actual frame
        playerRef.current.cueVideoById({ videoId, startSeconds: startTime });
      } else {
        playerRef.current.seekTo(startTime, true);
      }
    } catch {
      // Player might not be fully initialized or already destroyed
    }
  }, [startTime, videoId]);

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
