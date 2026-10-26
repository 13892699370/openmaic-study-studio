'use client';

/**
 * Study studio hero — dark, video-backed SaaS header.
 *
 * Layered: looping muted background video (z-0) → status pill → two-line
 * headline → subhead → the course composer (passed in as `children`) → pill
 * CTAs → social-proof card. All entrance motion is a single blur-in stagger,
 * so the composer arrives with the copy instead of popping in after it.
 *
 * Fonts are scoped: Switzer (Fontshare) for display, Inter for body, both
 * applied through `.ss-hero` classes only — nothing global is touched.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/** Local copy of the orb loop so the hero works offline. */
const HERO_VIDEO_SRC = '/videos/hero-orb.mp4';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.215, 0.61, 0.355, 1.0] as [number, number, number, number] },
  },
};

export interface StudyStudioHeroProps {
  /** The course composer, rendered after the subhead. */
  children?: ReactNode;
  className?: string;
}

export function StudyStudioHero({ children, className }: StudyStudioHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.src = HERO_VIDEO_SRC;
    // Autoplay is rejected on some browsers even when muted; the poster
    // gradient underneath keeps the section from flashing black.
    void video.play().catch(() => {});
  }, []);

  return (
    <section
      className={cn(
        'ss-hero relative w-full overflow-hidden font-geist text-white antialiased selection:bg-orange-500/30',
        className,
      )}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .ss-hero .font-switzer {
          font-family: 'Switzer', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'Inter', system-ui, sans-serif;
        }
        .ss-hero .font-geist {
          font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif;
        }
      `}</style>

      {/* ── Background video ── */}
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none overflow-hidden bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,#2b1435_0%,#120a1c_45%,#05030a_100%)]" />
        <video
          ref={videoRef}
          className="relative h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center md:py-24">
          {/* Status pill */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="font-geist text-xs font-medium text-white/80 md:text-sm">
              新功能：多语种课件与 AI 语音讲解已上线
            </span>
          </motion.div>

          {/* Staggered copy + composer */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex max-w-7xl flex-col items-center"
          >
            <motion.h1
              variants={itemVariants}
              className="font-switzer text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
            >
              输入一个主题
              <br />
              <span className="text-white/40">AI 帮你</span> 生成整堂互动课
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="font-geist mt-6 max-w-2xl text-lg text-white/90 md:text-xl md:leading-relaxed"
            >
              Study studio 把备课的琐碎交给智能体：一句话生成课件、旁白语音和随堂练习，让每节课都能直接开讲。
            </motion.p>

            {/* Composer */}
            <motion.div variants={itemVariants} className="mt-10 w-full max-w-[800px]">
              {children}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
