import { useEffect, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { Button, Popover, Textarea, cx, useToast } from "./ui";

// Cor estável por texto da etiqueta.
const CORES = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];
const cor = (texto) => CORES[[...texto].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length];

export function EtiquetasChips({ etiquetas, className }) {
  if (!etiquetas?.length) return null;
  return (
    <span className={cx("inline-flex flex-wrap gap-1", className)}>
      {etiquetas.map((e) => (
        <span key={e} className={cx("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", cor(e))}>
          {e}
        </span>
      ))}
    </span>
  );
}

let sugestoesCache = null;

// Editor rápido: etiquetas + observação comercial do cliente.
export function EditorEtiquetas({ clienteId, etiquetas: iniciais = [], observacao: obsInicial = "", onSalvo, compacto }) {
  const toast = useToast();
  const [etiquetas, setEtiquetas] = useState(iniciais);
  const [obs, setObs] = useState(obsInicial || "");
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState(sugestoesCache || []);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setEtiquetas(iniciais);
    setObs(obsInicial || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  if (!clienteId) return null;

  const carregarSugestoes = () => {
    if (sugestoesCache) return;
    api.get("/usuarios/etiquetas").then(({ data }) => {
      sugestoesCache = data;
      setSugestoes(data);
    });
  };
  const adicionar = (e) => {
    const t = String(e || texto).trim();
    if (t && !etiquetas.includes(t)) setEtiquetas([...etiquetas, t]);
    setTexto("");
  };
  const salvar = async (fechar) => {
    setSalvando(true);
    try {
      const pendente = texto.trim() && !etiquetas.includes(texto.trim()) ? [...etiquetas, texto.trim()] : etiquetas;
      const { data } = await api.put(`/usuarios/${clienteId}/etiquetas`, { etiquetas: pendente, observacaoComercial: obs });
      sugestoesCache = null;
      onSalvo?.(data);
      toast({ titulo: "Etiquetas salvas" });
      fechar();
    } catch (error) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Popover
      gatilho={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            carregarSugestoes();
          }}
          className={cx("inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary", compacto && "px-1.5")}
          title="Etiquetar cliente"
        >
          <Tag className="h-3 w-3" /> {compacto ? "" : "Etiquetar"}
        </button>
      }
    >
      {(fechar) => (
        <div className="w-72 space-y-3 p-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-semibold">Etiquetas do cliente</p>
          <div className="flex flex-wrap gap-1">
            {etiquetas.map((e) => (
              <span key={e} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", cor(e))}>
                {e}
                <button type="button" onClick={() => setEtiquetas(etiquetas.filter((x) => x !== e))} aria-label={`Remover ${e}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {!etiquetas.length && <span className="text-xs text-muted-foreground">Nenhuma etiqueta.</span>}
          </div>
          <div className="flex gap-1">
            <input
              className="input h-8"
              placeholder="Nova etiqueta (Enter)"
              value={texto}
              maxLength={30}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionar();
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={() => adicionar()} aria-label="Adicionar etiqueta">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {sugestoes.filter((s) => !etiquetas.includes(s)).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sugestoes
                .filter((s) => !etiquetas.includes(s))
                .slice(0, 12)
                .map((s) => (
                  <button key={s} type="button" onClick={() => adicionar(s)} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted">
                    + {s}
                  </button>
                ))}
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium">Observação rápida</p>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: prefere boleto, sempre pede às sextas..." />
          </div>
          <Button className="w-full" size="sm" loading={salvando} onClick={() => salvar(fechar)}>
            Salvar
          </Button>
        </div>
      )}
    </Popover>
  );
}
