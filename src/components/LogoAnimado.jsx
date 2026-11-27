import { useEffect, useRef, useState } from "react";

// Logo do header: a cada carregamento do site toca a animação (Giraldo indo
// para o lugar do "i") e, no fim, fica a imagem parada na mesma posição.
// Vídeo e imagem têm fundo branco puro; o "multiply" no conjunto faz esse
// branco virar exatamente a cor do header (sem diferença de tom em volta do
// logo nem na troca do vídeo para a imagem).
const semAnimacao = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function LogoAnimado({ className = "" }) {
  const videoRef = useRef(null);
  const [tocar, setTocar] = useState(() => !semAnimacao()); // vídeo na tela
  const [fim, setFim] = useState(() => semAnimacao()); // imagem final visível

  useEffect(() => {
    const v = videoRef.current;
    if (!tocar || !v) return undefined;
    // Navegador que bloqueia autoplay (ex.: modo economia no iPhone): mostra
    // direto a imagem final em vez de ficar parado no primeiro quadro.
    v.play?.()?.catch(() => setFim(true));
    // Se o vídeo travar ao carregar, a imagem aparece mesmo assim.
    const t = setTimeout(() => setFim(true), 15000);
    return () => clearTimeout(t);
  }, [tocar]);

  return (
    <span
      className={`relative isolate block aspect-[556/192] mix-blend-multiply ${className}`}
      role="img"
      aria-label="Gira Kids"
    >
      {tocar && (
        // O último quadro fica embaixo enquanto a imagem aparece por cima.
        <video
          ref={videoRef}
          src="/giraldo-logo.mp4"
          className="absolute inset-0 h-full w-full"
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          onEnded={() => setFim(true)}
          onError={() => setFim(true)}
        />
      )}
      <img
        src="/giraldo-logo.png"
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${fim ? "opacity-100" : "opacity-0"}`}
        onTransitionEnd={() => fim && setTocar(false)}
      />
    </span>
  );
}
