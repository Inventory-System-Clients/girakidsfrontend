/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../services/api";
import { cx } from "./ui";

// Troca automática a cada 4 s (o tempo recomeça ao trocar pelas setas/bolinhas).
const TROCA_MS = 4000;

// Onde os banners aparecem no catálogo (configurável em Banners):
// FAIXA = largura toda no lugar do título; CLASSICO = cartão acima dos produtos.
let layoutCache = null;
const ouvintes = new Set();

export const definirLayoutBanner = (layout) => {
  layoutCache = layout;
  ouvintes.forEach((f) => f(layout));
};

export function useLayoutBanner() {
  const [layout, setLayout] = useState(layoutCache);
  useEffect(() => {
    ouvintes.add(setLayout);
    if (!layoutCache) {
      api
        .get("/config/publica")
        .then(({ data }) => definirLayoutBanner(data.bannerLayout || "FAIXA"))
        .catch(() => definirLayoutBanner("CLASSICO"));
    }
    return () => ouvintes.delete(setLayout);
  }, []);
  return layout;
}

// Destaques do catálogo (mesmo funcionamento da Prime Plush): arte pronta,
// troca automática, setas e bolinhas. Clicar no banner leva à categoria,
// busca ou produto escolhido no cadastro. Na variante "faixa" ocupa a largura toda e desliza suavemente;
// sem banners mostra "vazio".
export default function BannerCarrossel({ onAbrir, variante = "classico", vazio = null }) {
  const faixa = variante === "faixa";
  const [banners, setBanners] = useState(null);
  const [indice, setIndice] = useState(0);
  const toqueX = useRef(null);

  useEffect(() => {
    api
      .get("/banners")
      .then(({ data }) => setBanners(Array.isArray(data) ? data : []))
      .catch(() => setBanners([]));
  }, []);

  const total = banners?.length || 0;
  useEffect(() => {
    if (total <= 1) return undefined;
    const t = setTimeout(() => setIndice((i) => (i + 1) % total), TROCA_MS);
    return () => clearTimeout(t);
  }, [total, indice]);

  if (!banners) return null;
  if (!total) return vazio;
  const posicao = indice % total;
  const atual = banners[posicao];
  const ir = (d) => setIndice((i) => (i + d + total) % total);
  const destinoDe = (b) => b.categoria || b.busca || b.produtoId;

  const foto = (b, eager, className, alt = b.alt || "") => (
    <picture>
      {b.imagemMobileUrl && <source media="(max-width: 640px)" srcSet={b.imagemMobileUrl} />}
      <img src={b.imagemUrl} alt={alt} className={className} loading={eager ? "eager" : "lazy"} draggable={false} />
    </picture>
  );

  // Na faixa a altura é limitada para não empurrar o catálogo: a arte aparece
  // inteira no centro e as laterais são preenchidas com ela mesma desfocada.
  const imagem = (b, eager) =>
    faixa ? (
      <div className="relative h-[clamp(140px,17vw,320px)] w-full overflow-hidden">
        {foto(b, eager, "absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-2xl", "")}
        {foto(b, eager, "relative mx-auto h-full w-full object-contain")}
      </div>
    ) : (
      foto(b, eager, "aspect-[16/9] w-full object-cover sm:aspect-[3/1]")
    );

  return (
    <section
      aria-label="Destaques"
      className={cx("relative overflow-hidden bg-slate-100", faixa ? "border-b border-border" : "mb-5 rounded-2xl shadow-sm")}
      onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (toqueX.current ?? 0);
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }}
    >
      {faixa ? (
        <div className="flex transition-transform duration-1000 ease-in-out" style={{ transform: `translateX(-${posicao * 100}%)` }}>
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              className={cx("block w-full shrink-0", !destinoDe(b) && "cursor-default")}
              onClick={() => destinoDe(b) && onAbrir(b)}
              aria-label={b.alt || "Destaque"}
              aria-hidden={i !== posicao}
              tabIndex={i === posicao ? 0 : -1}
            >
              {imagem(b, i === 0)}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className={cx("block w-full", !destinoDe(atual) && "cursor-default")} onClick={() => destinoDe(atual) && onAbrir(atual)} aria-label={atual.alt || "Destaque"}>
          {imagem(atual, true)}
        </button>
      )}
      {total > 1 && (
        <>
          <button type="button" onClick={() => ir(-1)} className={cx("absolute top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white", faixa ? "left-3 sm:left-5" : "left-2")} aria-label="Destaque anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => ir(1)} className={cx("absolute top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white", faixa ? "right-3 sm:right-5" : "right-2")} aria-label="Próximo destaque">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className={cx("absolute flex gap-1.5", faixa ? "right-3 bottom-2 sm:right-8 sm:bottom-5 lg:right-12" : "right-4 bottom-4 sm:bottom-6")}>
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver destaque ${i + 1}`}
                className={cx("h-2 rounded-full transition-all", i === posicao ? "w-6 bg-white" : "w-2 bg-white/60")}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
