import type { PhotoImageProps } from "./PhotoImage";
import { photoUrl } from "@/lib/photos";
export function PhotoImage({
  photoRef,
  name,
  width,
  onError,
}: PhotoImageProps) {
  return (
    <img
      alt={`${name} restaurant photo`}
      src={photoUrl(photoRef, width)}
      srcSet={`${photoUrl(photoRef, 400)} 400w, ${photoUrl(photoRef, 800)} 800w, ${photoUrl(photoRef, 1200)} 1200w`}
      sizes={
        width >= 1200
          ? "(min-width: 1200px) 1120px, 100vw"
          : "(min-width: 1050px) 360px, (min-width: 650px) 45vw, 100vw"
      }
      loading="lazy"
      decoding="async"
      onError={onError}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}
