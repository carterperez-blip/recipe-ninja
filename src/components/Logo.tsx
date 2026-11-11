import Image from "next/image";

/** The ninja chef on its own (header, small spaces). Height is set by the caller. */
export function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  return <Image src="/logo-mark.png" alt="" width={593} height={480} className={className} priority />;
}

/** Ninja plus the "recipe ninja" wordmark (sign-in screen). */
export function LogoFull({ className = "w-64 max-w-full h-auto" }: { className?: string }) {
  return <Image src="/logo-full.png" alt="Recipe Ninja" width={1000} height={670} className={className} priority />;
}
