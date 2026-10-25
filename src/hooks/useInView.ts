import { useEffect, useState } from 'react';

type InViewOptions = {
  root?: Element | null;
  rootMargin?: string;
  /** Dejar de observar tras la primera vez que entra (por defecto). */
  once?: boolean;
};

/**
 * Indica si un elemento está (o ha estado, con `once`) dentro del viewport o de `root`.
 * Devuelve un callback ref para que funcione aunque el elemento se monte más tarde.
 */
export function useInView({ root = null, rootMargin = '200px', once = true }: InViewOptions = {}) {
  const [node, setNode] = useState<Element | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { root, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, root, rootMargin, once]);

  return [setNode, inView] as const;
}
