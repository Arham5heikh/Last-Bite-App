import { useEffect, useState } from 'react';
import { PlayCircle, X } from 'lucide-react';

export type HowItWorksAudience = 'customers' | 'restaurants';

const VIDEOS: Record<HowItWorksAudience, { src: string; poster: string; title: string }> = {
  customers: {
    src: '/videos/last-bite-customers.mp4',
    poster: '/videos/last-bite-customers.jpg',
    title: 'How Last Bite works for customers',
  },
  restaurants: {
    src: '/videos/last-bite-restaurants.mp4',
    poster: '/videos/last-bite-restaurants.jpg',
    title: 'How Last Bite works for restaurants',
  },
};

interface HowItWorksButtonProps {
  audience: HowItWorksAudience;
  className?: string;
  label?: string;
}

/** Button that opens the narrated walkthrough video in a modal player. */
export function HowItWorksButton({ audience, className = '', label = 'How it works' }: HowItWorksButtonProps) {
  const [open, setOpen] = useState(false);
  const video = VIDEOS[audience];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary border border-primary/40 text-xs font-bold transition-colors cursor-pointer ${className}`}
      >
        <PlayCircle className="w-4 h-4" />
        <span>{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl overflow-hidden border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-background border border-border cursor-pointer"
              title="Close video"
            >
              <X className="w-5 h-5" />
            </button>
            <video
              src={video.src}
              poster={video.poster}
              controls
              autoPlay
              playsInline
              className="w-full aspect-video bg-background"
            />
          </div>
        </div>
      )}
    </>
  );
}
