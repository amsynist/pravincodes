import Image from "next/image";

/**
 * A note's cover — a still image (public/blog/<slug>/cover.webp), no animation.
 * next/image serves a size that fits the card, so phones never download the full 1600 px.
 */
export default function PostCover({
  src,
  alt = "",
  sizes = "(max-width: 719px) 100vw, 560px",
  priority = false,
}: {
  src: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return <Image className="pcover" src={src} alt={alt} fill sizes={sizes} priority={priority} quality={82} />;
}
