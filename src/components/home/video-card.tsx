'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { formatDuration, type OfficialStatus } from '@/types/search';

export interface VideoCardData {
  id: number;
  youtube_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  channel_name: string;
  channel_official_status: OfficialStatus;
}

interface VideoCardProps {
  video: VideoCardData;
  lang: string;
  labels: {
    official: string;
    community: string;
  };
}

export function VideoCard({ video, lang, labels }: VideoCardProps) {
  const thumbnailUrl =
    video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`;

  return (
    <Link
      href={`/video/${video.id}?lang=${lang}`}
      className="group block rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        <Image
          src={thumbnailUrl}
          alt={video.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {video.duration_seconds != null && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{video.channel_name}</span>
          <Badge
            variant={video.channel_official_status === 'official' ? 'default' : 'secondary'}
            className="shrink-0 text-[10px] px-1.5 py-0"
          >
            {video.channel_official_status === 'official' ? labels.official : labels.community}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
