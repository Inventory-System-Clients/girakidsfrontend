import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../services/api";
import { cx } from "./ui";

const TROCA_MS = 10000;

// Destaques do topo do catálogo (mesmo funcionamento da Prime Plush): arte
// pronta, troca automática a cada 10s, setas, bolinhas e botão que leva a uma
// categoria, busca ou produto.
export default function BannerCarrossel({ onAbrir }) {
  const [banners, setBanners] = useState([]);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const toqueX = useRef(null);

  useEffect(() => {
    api.get("/banners").then(({ data }) => setBanners(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || pausado) return undefined;
    const t = setInterval(() => setIndice((i) => (i + 1) % banners.length), TROCA_MS);
    return () => clearInterval(t);
  }, [banners.length, pausado]);

  if (!banners.length) return null;
  const atual = banners[indice % banners.length];
  const ir = (d) => setIndice((i) => (i + d + banners.length) % banners.length);
  const temDestino = atual.categoria || atual.busca || atual.produtoId;

  return (
    <section
      aria-label="Destaques"
      className="relative mb-5 overflow-hidden rounded-2xl bg-slate-100 shadow-sm"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (toqueX.current ?? 0);
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }}
    >
      <button type="button" className={cx("block w-full", !temDestino && "cursor-default")} onClick={() => temDestino && onAbrir(atual)} aria-label={atual.alt || "Destaque"}>
        <picture>
          {atual.imagemMobileUrl && <source media="(max-width: 640px)" srcSet={atual.imagemMobileUrl} />}
          <img src={atual.imagemUrl} alt={atual.alt || ""} className="aspect-[16/9] w-full object-cover sm:aspect-[3/1]" loading="eager" />
        </picture>
      </button>
      {temDestino && (
        <button
          type="button"
          onClick={() => onAbrir(atual)}
          className="absolute bottom-4 left-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-primary shadow-md transition hover:scale-[1.03] sm:bottom-6 sm:left-6"
        >
          {atual.textoBotao || "Ver coleção"} <span aria-hidden="true">›</span>
        </button>
      )}
      {banners.length > 1 && (
        <>
          <button type="button" onClick={() => ir(-1)} className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white" aria-label="Destaque anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => ir(1)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white" aria-label="Próximo destaque">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute right-4 bottom-4 flex gap-1.5 sm:bottom-6">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver destaque ${i + 1}`}
                className={cx("h-2 rounded-full transition-all", i === indice % banners.length ? "w-6 bg-white" : "w-2 bg-white/60")}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
