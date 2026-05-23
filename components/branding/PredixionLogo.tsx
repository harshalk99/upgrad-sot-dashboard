// PredixionLogo — renders the Predixion AI mark + wordmark.
// Two source PNGs live in /public:
//   - predixion-logo-black.png (for light surfaces — login card, header)
//   - predixion-logo-white.png (for dark surfaces — sidebar, dark banners)
// Pick the variant explicitly when you place it.
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
  variant?: 'black' | 'white';
  /** Pixel height. Width auto-derived from the square aspect of the source PNGs. */
  size?: number;
  className?: string;
  /** Whether to show the "PREDIXION AI" wordmark below the mark. Default true. */
  withWordmark?: boolean;
  alt?: string;
};

export function PredixionLogo({
  variant = 'black',
  size = 48,
  className,
  withWordmark = true,
  alt = 'Predixion AI'
}: Props) {
  const src =
    variant === 'white' ? '/predixion-logo-white.png' : '/predixion-logo-black.png';

  // The source PNGs are square with the wordmark baked in. If the caller wants
  // just the α mark, we crop bottom 25% with CSS overflow + negative margin.
  if (!withWordmark) {
    return (
      <span
        className={cn('inline-block overflow-hidden', className)}
        style={{ height: size * 0.7, width: size }}
        aria-label={alt}
        role="img"
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          priority
          unoptimized
        />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority
      unoptimized
      className={cn('block', className)}
    />
  );
}
