import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserRound } from "lucide-react";
import api from "../services/api";
import { cx } from "./ui";
import { EtiquetasChips } from "./Etiquetas";
import { data, mascaraDocumento } from "../utils/format";

const CHAVE_RECENTES = "girakids_clientes_recentes";
const lerRecentes = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "[]");
  } catch {
    return [];
  }
};
const guardarRecente = (cliente) => {
  try {
    const lista = [cliente, ...lerRecentes().filter((c) => c.id !== cliente.id)].slice(0, 6);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch {
    // sem armazenamento: só não lembra os recentes
  }
};

const cache = new Map();

// Busca de cliente rápida: digita nome, e-mail, telefone ou CPF/CNPJ; setas
// + Enter escolhem. Mostra os clientes recentes ao focar sem texto.
// semRecentes: no totem do showroom não mostra nem guarda clientes recentes.
export default function ClienteBusca({ onEscolher, autoFocus, semRecentes, placeholder = "Buscar cliente por nome, e-mail, telefone ou CPF/CNPJ..." }) {
  const recentes = () => (semRecentes ? [] : lerRecentes());
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const controle = useRef(null);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < (semRecentes ? 3 : 2)) {
      setLista(semRecentes ? [] : lerRecentes());
      setCarregando(false);
      return undefined;
    }
    if (cache.has(termo)) {
      setLista(cache.get(termo));
      return undefined;
    }
    setCarregando(true);
    const t = setTimeout(() => {
      controle.current?.abort();
      controle.current = new AbortController();
      api
        .get("/usuarios/clientes", { params: { busca: termo }, signal: controle.current.signal })
        .then(({ data: d }) => {
          cache.set(termo, d);
          setLista(d);
          setAtivo(0);
        })
        .catch(() => {})
        .finally(() => setCarregando(false));
    }, 180);
    return () => clearTimeout(t);
  }, [busca, semRecentes]);

  const escolher = (c) => {
    if (!semRecentes) guardarRecente(c);
    setBusca("");
    setAberto(false);
    onEscolher(c);
  };

  return (
    <div className="relative">
      <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
      <input
        className="input h-11 pl-9 text-base"
        placeholder={placeholder}
        value={busca}
        autoFocus={autoFocus}
        onFocus={() => {
          setAberto(true);
          if (!busca) setLista(recentes());
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((a) => Math.min(a + 1, lista.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && lista[ativo]) {
            e.preventDefault();
            escolher(lista[ativo]);
          }
        }}
      />
      {carregando && <Loader2 className="absolute top-3 right-3 h-4 w-4 animate-spin text-muted-foreground" />}
      {aberto && (lista.length > 0 || busca.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-xl">
          {!busca && lista.length > 0 && <p className="px-3 pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Recentes</p>}
          {lista.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(c);
              }}
              onMouseEnter={() => setAtivo(i)}
              className={cx("flex w-full items-start gap-3 px-3 py-2.5 text-left", i === ativo ? "bg-primary-soft" : "hover:bg-muted")}
            >
              <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{c.nome}</span>
                  <EtiquetasChips etiquetas={c.etiquetas} />
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[c.email, c.telefone, c.documento && mascaraDocumento(c.documento), c.cidade && `${c.cidade}/${c.estado || ""}`].filter(Boolean).join(" · ")}
                </span>
                {c.totalPedidos > 0 && (
                  <span className="text-[11px] text-emerald-700">
                    {c.totalPedidos} {c.totalPedidos === 1 ? "pedido" : "pedidos"} · último em {data(c.ultimoPedidoEm)}
                  </span>
                )}
              </span>
            </button>
          ))}
          {busca.trim().length >= 2 && !carregando && !lista.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
        </div>
      )}
    </div>
  );
}
