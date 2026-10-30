/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { Copy, Package, Search } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { BotaoWhatsapp } from "../Whatsapp";
import { Button, cx, useToast } from "../ui";
import { numero } from "../../utils/format";

export const STATUS_PRE = {
  AGUARDANDO_FORNECEDOR: { label: "Aguardando fornecedor", cor: "bg-amber-500 text-white" },
  FORNECEDOR_RESPONDEU: { label: "Fornecedor respondeu", cor: "bg-blue-600 text-white" },
  RECEBIDO: { label: "Recebido", cor: "bg-emerald-600 text-white" },
  RECEBIDO_PARCIAL: { label: "Recebido com falta", cor: "bg-red-600 text-white" },
  CANCELADO: { label: "Cancelado", cor: "bg-slate-500 text-white" },
  ESTORNADO: { label: "Estornado", cor: "bg-slate-500 text-white" },
};

export const DESTINOS = {
  SEM_CAPSULA: { label: "Brinquedo sem cápsula", curto: "Sem cápsula", cor: "bg-violet-100 text-violet-800" },
  CAPSULA: { label: "Cápsula vazia", curto: "Cápsula", cor: "bg-sky-100 text-sky-800" },
  PRONTO: { label: "Produto pronto", curto: "Pronto", cor: "bg-emerald-100 text-emerald-800" },
};

export const SOLUCOES = {
  ENVIAR_RESTANTE: "Fornecedor vai entregar o que faltou",
  ABATER_VALOR: "Abater do valor / pagar só o recebido",
  CREDITO: "Crédito para a próxima compra",
  DEVOLVER_DINHEIRO: "Fornecedor devolve o dinheiro",
  OUTRO: "Outro (descrever)",
};

export const SALDOS = {
  MONTADO: "Prontos (montados)",
  EM_MONTAGEM: "Em montagem",
  SEM_CAPSULA: "Sem cápsula (aguardando)",
};

export const un = (v) => numero(Number(v) || 0);

export const Pilula = ({ cor, children, className }) => (
  <span className={cx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm", cor, className)}>{children}</span>
);

export const StatusPre = ({ status }) => <Pilula cor={STATUS_PRE[status]?.cor}>{STATUS_PRE[status]?.label || status}</Pilula>;

export const TipoItem = ({ destino }) => (
  <span className={cx("inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold", DESTINOS[destino]?.cor)}>{DESTINOS[destino]?.curto || destino}</span>
);

export const Miniatura = ({ src, className }) => (
  <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted", className)}>
    {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Package className="h-4 w-4 text-muted-foreground" />}
  </div>
);

// O token vai depois do "#": não aparece em logs de servidor nem no Referer.
export const linkFornecedor = (token) => `${window.location.origin}/fornecedor#${token}`;

export function LinkFornecedor({ token, telefone, numero: numeroPre, fornecedorNome }) {
  const toast = useToast();
  if (!token) return null;
  const link = linkFornecedor(token);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ titulo: "Link copiado", descricao: "Envie ao fornecedor. Ele não precisa de login." });
    } catch {
      toast({ titulo: "Não foi possível copiar", descricao: link, tipo: "erro" });
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input readOnly value={link} onFocus={(e) => e.target.select()} className="input h-9 flex-1 font-mono text-xs" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copiar}>
          <Copy className="h-4 w-4" /> Copiar link
        </Button>
        {telefone && (
          <BotaoWhatsapp
            telefone={telefone}
            texto={`Olá${fornecedorNome ? ` ${fornecedorNome}` : ""}! Aqui é da Gira Kids. Segue o pré-recebimento nº ${numeroPre} — por favor, informe quanto de cada item vai entregar: ${link}`}
          >
            Enviar no WhatsApp
          </BotaoWhatsapp>
        )}
      </div>
    </div>
  );
}

// Busca de produtos (inclui cápsulas arquivadas, só de controle).
export function ProdutoBusca({ onEscolher, placeholder = "Buscar produto pelo nome ou SKU...", somenteCapsulas, autoFocus, excluir = [] }) {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState([]);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!aberto) return;
      api
        .get("/recebimentos/produtos", { params: { busca: busca || undefined, capsulas: somenteCapsulas ? "true" : undefined } })
        .then(({ data }) => setLista(data))
        .catch(() => setLista([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, aberto, somenteCapsulas]);

  useEffect(() => {
    const fora = (e) => caixa.current && !caixa.current.contains(e.target) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const visiveis = lista.filter((p) => !excluir.includes(p.id));
  return (
    <div ref={caixa} className="relative">
      <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
      <input
        className="input h-9 pl-9"
        placeholder={placeholder}
        value={busca}
        autoFocus={autoFocus}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
        }}
      />
      {aberto && visiveis.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {visiveis.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onEscolher(p);
                setBusca("");
                setAberto(false);
              }}
            >
              <Miniatura src={p.imagemUrl} className="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  SKU {p.sku} · {un(p.estoque)} un.
                  {p.ehCapsula && " · cápsula"}
                  {p.controlaMontagem && " · montagem em cápsula"}
                  {p.arquivado && " · fora do catálogo"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Contador de alertas da aba (cabeçalho do site e topo da página).
let alertasCache = null;
const ouvintes = new Set();
export const atualizarAlertasRecebimentos = async () => {
  try {
    const { data } = await api.get("/recebimentos/alertas");
    alertasCache = data;
    ouvintes.forEach((f) => f(data));
    return data;
  } catch {
    return alertasCache;
  }
};

export function useAlertasRecebimentos(habilitado) {
  const [alertas, setAlertas] = useState(alertasCache);
  useEffect(() => {
    if (!habilitado) return undefined;
    ouvintes.add(setAlertas);
    atualizarAlertasRecebimentos();
    const t = setInterval(atualizarAlertasRecebimentos, 120000);
    return () => {
      ouvintes.delete(setAlertas);
      clearInterval(t);
    };
  }, [habilitado]);
  return habilitado ? alertas : null;
}

// Exclui o pré-recebimento de vez, depois de confirmar. Recebido: a entrada no
// estoque é desfeita antes. Devolve true se excluiu.
export const excluirPreRecebimento = async (pre, { confirmar, toast }) => {
  const recebido = ["RECEBIDO", "RECEBIDO_PARCIAL"].includes(pre.status);
  const ok = await confirmar({
    titulo: `Excluir ${pre.direto ? "recebimento" : "pré-recebimento"} nº ${pre.numero} definitivamente?`,
    mensagem: recebido
      ? "Ele some da lista e não dá para desfazer. Como já foi recebido, as quantidades que entraram saem do estoque antes de excluir."
      : "Ele some da lista e não dá para desfazer. O link do fornecedor para de funcionar.",
    perigo: true,
    confirmar: "Excluir definitivamente",
  });
  if (!ok) return false;
  try {
    const { data: d } = await api.delete(`/recebimentos/${pre.id}`);
    toast({ titulo: `Nº ${d.numero} excluído`, descricao: d.estornado ? "As quantidades recebidas saíram do estoque." : undefined });
    atualizarAlertasRecebimentos();
    return true;
  } catch (error) {
    toast({ titulo: "Não foi possível excluir", descricao: mensagemErro(error), tipo: "erro" });
    return false;
  }
};
