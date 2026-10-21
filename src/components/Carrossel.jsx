import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cx } from "./ui";

// Carrossel de imagens do produto. "compacto" = card do catálogo (setas no
// hover e bolinhas); completo = diálogo do produto (setas + miniaturas).
export default function Carrossel({ imagens, alt, compacto = false, className, onAmpliar }) {
  const lista = imagens?.filter(Boolean) || [];
  const [indice, setIndice] = useState(0);
  const toqueX = useRef(null);
  const atual = Math.min(indice, Math.max(0, lista.length - 1));
  const ir = (delta, e) => {
    e?.stopPropagation();
    setIndice((i) => (i + delta + lista.length) % lista.length);
  };

  if (!lista.length) {
    return (
      <div className={cx("relative flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200", className)}>
        <Package className="h-12 w-12 text-slate-300" />
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-2", !compacto && "w-full")}>
      <div
        className={cx("group relative overflow-hidden bg-slate-100", className)}
        onTouchStart={(e) => {
          toqueX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (toqueX.current == null || lista.length < 2) return;
          const dx = e.changedTouches[0].clientX - toqueX.current;
          if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
          toqueX.current = null;
        }}
      >
        <img
          src={lista[atual]}
          alt={alt}
          loading="lazy"
          className={cx("h-full w-full object-cover", onAmpliar && "cursor-zoom-in")}
          onClick={onAmpliar ? (e) => (e.stopPropagation(), onAmpliar(atual)) : undefined}
        />
        {lista.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => ir(-1, e)}
              className={cx("absolute top-1/2 left-1.5 -translate-y-1/2 rounded-full bg-white/85 p-1 shadow transition", compacto && "opacity-0 group-hover:opacity-100")}
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => ir(1, e)}
              className={cx("absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full bg-white/85 p-1 shadow transition", compacto && "opacity-0 group-hover:opacity-100")}
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {compacto && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {lista.map((url, i) => (
                  <span key={url} className={cx("h-1.5 w-1.5 rounded-full", i === atual ? "bg-white" : "bg-white/50")} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {!compacto && lista.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lista.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndice(i)}
              className={cx("h-14 w-14 shrink-0 overflow-hidden rounded-md border-2", i === atual ? "border-primary" : "border-transparent opacity-70")}
              aria-label={`Imagem ${i + 1}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
