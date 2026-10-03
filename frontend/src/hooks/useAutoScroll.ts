import { useEffect, useRef } from "react";

export default function useAutoScroll(
  dependency: unknown,
) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [dependency]);

  return bottomRef;
}