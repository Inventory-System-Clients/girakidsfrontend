import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import { enviarArquivo, mensagemErro } from "../../services/api";
import { comprimirImagem } from "../../utils/format";
import { cx, useToast } from "../ui";

// Visualizador em tela cheia (setas, Esc, arrastar no celular).
function Visualizador({ fotos, inicial, onFechar }) {
  const [i, setI] = useState(inicial);
  const toqueX = useRef(null);
  const ir = (d) => setI((x) => (x + d + fotos.length) % fotos.length);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
      onClick={onFechar}
      onKeyDown={(e) => e.key === "Escape" && onFechar()}
      onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (toqueX.current ?? 0);
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
      }}
      tabIndex={-1}
    >
      <img src={fotos[i]} alt="" className="max-h-[90dvh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />
      <button className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white" onClick={onFechar} aria-label="Fechar">
        <X className="h-6 w-6" />
      </button>
      {fotos.length > 1 && (
        <>
          <button className="absolute left-3 rounded-full bg-white/15 p-2 text-white" onClick={(e) => (e.stopPropagation(), ir(-1))} aria-label="Anterior">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button className="absolute right-3 rounded-full bg-white/15 p-2 text-white" onClick={(e) => (e.stopPropagation(), ir(1))} aria-label="Próxima">
            <ChevronRight className="h-6 w-6" />
          </button>
          <span className="absolute bottom-4 text-sm text-white/80">
            {i + 1} / {fotos.length}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}

// Miniaturas somente leitura (Ver pedido).
export function GaleriaFotos({ titulo, fotos }) {
  const [aberta, setAberta] = useState(null);
  if (!fotos?.length) return null;
  return (
    <div>
      {titulo && <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</p>}
      <div className="flex flex-wrap gap-2">
        {fotos.map((url, i) => (
          <button key={url} type="button" onClick={() => setAberta(i)} className="h-20 w-20 overflow-hidden rounded-lg border border-border">
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {aberta != null && <Visualizador fotos={fotos} inicial={aberta} onFechar={() => setAberta(null)} />}
    </div>
  );
}

// Envio de várias fotos: "Tirar foto" abre a câmera do celular; "Galeria"
// permite escolher várias imagens de uma vez.
export function FotosUpload({ titulo, descricao, fotos, onChange, pasta = "expedicao", desabilitado }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(0);
  const [aberta, setAberta] = useState(null);
  const atual = useRef(fotos);
  useEffect(() => {
    atual.current = fotos;
  }, [fotos]);
  const camera = useRef(null);
  const galeria = useRef(null);

  const enviar = async (lista) => {
    const arquivos = [...(lista || [])].filter((a) => a.type.startsWith("image/"));
    if (!arquivos.length) return;
    setEnviando((n) => n + arquivos.length);
    await Promise.all(
      arquivos.map(async (arquivo) => {
        try {
          if (arquivo.size > 25 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 25MB");
          const url = await enviarArquivo(await comprimirImagem(arquivo), pasta);
          atual.current = [...atual.current, url];
          onChange(atual.current);
        } catch (error) {
          toast({ titulo: `Erro ao enviar ${arquivo.name}`, descricao: mensagemErro(error), tipo: "erro" });
        } finally {
          setEnviando((n) => n - 1);
        }
      }),
    );
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">{titulo}</p>
      {descricao && <p className="mb-2 text-xs text-muted-foreground">{descricao}</p>}
      <div className="flex flex-wrap gap-2">
        {fotos.map((url, i) => (
          <div key={url} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border">
            <button type="button" className="h-full w-full" onClick={() => setAberta(i)}>
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
            {!desabilitado && (
              <button
                type="button"
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white"
                onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                aria-label="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {enviando > 0 && (
          <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Enviando {enviando}
          </div>
        )}
      </div>
      {!desabilitado && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => camera.current.click()}
            className={cx("flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-3 text-sm font-semibold text-white active:scale-[0.98]")}
          >
            <Camera className="h-5 w-5" /> Tirar foto
          </button>
          <button
            type="button"
            onClick={() => galeria.current.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 py-3 text-sm font-semibold active:scale-[0.98]"
          >
            <ImagePlus className="h-5 w-5" /> Galeria
          </button>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              enviar(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galeria}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              enviar(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {aberta != null && <Visualizador fotos={fotos} inicial={aberta} onFechar={() => setAberta(null)} />}
    </div>
  );
}
