/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Loader2,
  MoreHorizontal,
  X,
} from "lucide-react";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Botões, cartões, badges
// ---------------------------------------------------------------------------

const VARIANTES = {
  primary: "bg-primary text-white hover:bg-primary-dark shadow-sm",
  secondary: "bg-secondary text-white hover:brightness-95 shadow-sm",
  success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
  outline: "border border-border bg-white text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
  "danger-outline": "border border-red-200 bg-white text-red-600 hover:bg-red-50",
};
const TAMANHOS = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-11 px-6 text-base", icon: "h-9 w-9" };

export function Button({ variant = "primary", size = "md", className, loading, children, disabled, ...props }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50",
        VARIANTES[variant],
        TAMANHOS[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx("rounded-xl border border-border bg-white shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}

const BADGES = {
  default: "bg-muted text-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
  outline: "border border-border bg-white text-foreground",
};

export function Badge({ variant = "default", className, children }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", BADGES[variant], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx("h-5 w-5 animate-spin text-primary", className)} />;
}

export function Skeleton({ className }) {
  return <div className={cx("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

export function EmptyState({ icon: Icone, titulo, descricao, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      {Icone && <Icone className="h-10 w-10 text-muted-foreground/60" />}
      <p className="font-semibold">{titulo}</p>
      {descricao && <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

export function Field({ label, obrigatorio, dica, erro, className, children }) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="label">
          {label} {obrigatorio && <span className="text-primary">*</span>}
        </span>
      )}
      {children}
      {dica && !erro && <span className="mt-1 block text-xs text-muted-foreground">{dica}</span>}
      {erro && <span className="mt-1 block text-xs text-red-600">{erro}</span>}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={cx("input", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cx("input", className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx("input pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ checked, onChange, label, descricao, className, disabled }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60", className)}>
      <span
        className={cx(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
          checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white",
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      {(label || descricao) && (
        <span className="text-sm">
          <span className="font-medium">{label}</span>
          {descricao && <span className="block text-xs text-muted-foreground">{descricao}</span>}
        </span>
      )}
    </label>
  );
}

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-2 text-sm", disabled && "opacity-60")}>
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cx("relative h-5 w-9 rounded-full transition", checked ? "bg-primary" : "bg-slate-300")}
      >
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

// Grupo de botões (ex.: Receita bruta / Receita líquida, CPF / CNPJ).
export function Segmented({ value, onChange, opcoes, className }) {
  return (
    <div className={cx("inline-flex rounded-md border border-border bg-white p-0.5", className)}>
      {opcoes.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-primary text-white shadow-sm" : "text-foreground hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

const LARGURAS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl", full: "max-w-7xl" };

export function Dialog({ aberto, onFechar, titulo, descricao, tamanho = "md", children, rodape }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const tecla = (e) => e.key === "Escape" && onFechar?.();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar?.()}>
      <div role="dialog" aria-modal="true" className={cx("relative flex max-h-[95dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-xl", LARGURAS[tamanho])}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
          </div>
          <button onClick={onFechar} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

const ConfirmContext = createContext(null);

// confirmar({ titulo, mensagem, confirmar: "Excluir", perigo: true, campo: { label, obrigatorio } })
// devolve false/true (ou o texto digitado quando há campo).
export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null);
  const [texto, setTexto] = useState("");
  const confirmar = useCallback(
    (opcoes) =>
      new Promise((resolve) => {
        setTexto("");
        setEstado({ ...opcoes, resolve });
      }),
    [],
  );
  const fechar = (resultado) => {
    estado?.resolve(resultado);
    setEstado(null);
  };
  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Dialog
        aberto={Boolean(estado)}
        onFechar={() => fechar(false)}
        titulo={estado?.titulo}
        tamanho="sm"
        rodape={
          <>
            <Button variant="outline" onClick={() => fechar(false)}>
              {estado?.cancelar || "Cancelar"}
            </Button>
            <Button
              variant={estado?.perigo ? "danger" : "primary"}
              disabled={estado?.campo?.obrigatorio && !texto.trim()}
              onClick={() => fechar(estado?.campo ? texto.trim() || true : true)}
            >
              {estado?.confirmar || "Confirmar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{estado?.mensagem}</p>
        {estado?.campo && (
          <Field label={estado.campo.label} obrigatorio={estado.campo.obrigatorio} className="mt-4">
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={estado.campo.placeholder} autoFocus />
          </Field>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback(({ titulo, descricao, tipo = "sucesso" }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, titulo, descricao, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                "rounded-lg border bg-white p-4 shadow-lg",
                t.tipo === "erro" ? "border-red-200" : t.tipo === "aviso" ? "border-amber-200" : "border-emerald-200",
              )}
            >
              <p className={cx("text-sm font-semibold", t.tipo === "erro" ? "text-red-600" : t.tipo === "aviso" ? "text-amber-700" : "text-emerald-700")}>
                {t.titulo}
              </p>
              {t.descricao && <p className="mt-0.5 text-sm text-muted-foreground">{t.descricao}</p>}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------
// Popover / menu
// ---------------------------------------------------------------------------

export function Popover({ gatilho, children, alinhamento = "start", className, aberto: abertoExterno, onAbertoChange }) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoExterno ?? abertoInterno;
  const setAberto = onAbertoChange ?? setAbertoInterno;
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + window.scrollY + 4,
        left: alinhamento === "end" ? undefined : r.left + window.scrollX,
        right: alinhamento === "end" ? document.documentElement.clientWidth - r.right - window.scrollX : undefined,
      });
    }
    const fora = (e) => {
      if (!ref.current?.contains(e.target) && !document.getElementById("popover-ativo")?.contains(e.target)) setAberto(false);
    };
    const tecla = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, alinhamento, setAberto]);

  return (
    <>
      <span ref={ref} className="inline-flex" onClick={() => setAberto(!aberto)}>
        {gatilho}
      </span>
      {aberto && pos &&
        createPortal(
          <div
            id="popover-ativo"
            style={{ position: "absolute", top: pos.top, left: pos.left, right: pos.right }}
            className={cx("z-50 min-w-[12rem] rounded-lg border border-border bg-white p-1 shadow-lg", className)}
          >
            {typeof children === "function" ? children(() => setAberto(false)) : children}
          </div>,
          document.body,
        )}
    </>
  );
}

// Menu "Abrir menu" (⋯) das linhas das tabelas.
export function RowMenu({ itens }) {
  return (
    <Popover
      alinhamento="end"
      gatilho={
        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-white hover:text-foreground" aria-label="Abrir menu">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      }
    >
      {(fechar) => (
        <div role="menu" className="flex flex-col">
          {itens.filter(Boolean).map((item) =>
            item.separador ? (
              <div key={item.key || Math.random()} className="my-1 border-t border-border" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  fechar();
                  item.onClick();
                }}
                className={cx(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted disabled:opacity-40",
                  item.perigo && "text-red-600",
                )}
              >
                {item.icone && <item.icone className="h-4 w-4" />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </Popover>
  );
}

// Filtro com várias opções e busca (Método, Time Financeiro, ...).
export function FiltroMulti({ titulo, opcoes, valores, onChange }) {
  const [busca, setBusca] = useState("");
  const selecionados = new Set(valores);
  const filtradas = Object.entries(opcoes).filter(([, label]) => label.toLowerCase().includes(busca.toLowerCase()));
  return (
    <Popover
      gatilho={
        <button className={cx("inline-flex h-9 items-center gap-2 rounded-md border border-dashed px-3 text-sm", valores.length ? "border-primary bg-primary-soft text-primary" : "border-border bg-white")}>
          <Filter className="h-3.5 w-3.5" />
          {titulo}
          {valores.length > 0 && <Badge variant="primary">{valores.length}</Badge>}
        </button>
      }
    >
      <div className="w-60">
        <input className="input mb-1 h-8" placeholder={`Filtrar ${titulo.toLowerCase()}...`} value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="max-h-64 overflow-y-auto">
          {filtradas.map(([valor, label]) => (
            <div key={valor} className="rounded-md px-2 py-1.5 hover:bg-muted">
              <Checkbox
                checked={selecionados.has(valor)}
                label={label}
                onChange={(marcado) => onChange(marcado ? [...valores, valor] : valores.filter((v) => v !== valor))}
              />
            </div>
          ))}
          {!filtradas.length && <p className="px-2 py-3 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</p>}
        </div>
        {valores.length > 0 && (
          <button className="mt-1 w-full rounded-md py-1.5 text-center text-sm hover:bg-muted" onClick={() => onChange([])}>
            Limpar filtro
          </button>
        )}
      </div>
    </Popover>
  );
}

// Período (de / até).
export function PeriodoPicker({ inicio, fim, onChange }) {
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);
  const fmt = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
  return (
    <Popover
      alinhamento="end"
      gatilho={
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm">
          <Calendar className="h-4 w-4" />
          {fmt(inicio)} - {fmt(fim)}
        </button>
      }
    >
      {(fechar) => (
        <div className="flex w-64 flex-col gap-3 p-2">
          <Field label="De">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Field>
          <Field label="Até">
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </Field>
          <Button
            disabled={!de || !ate || de > ate}
            onClick={() => {
              onChange({ inicio: de, fim: ate });
              fechar();
            }}
          >
            Aplicar
          </Button>
        </div>
      )}
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Abas, tabela, paginação, cabeçalho de página
// ---------------------------------------------------------------------------

export function Tabs({ abas, ativa, onChange, className }) {
  return (
    <div className={cx("inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-border bg-white p-1 shadow-sm", className)} role="tablist">
      {abas.map((aba) => (
        <button
          key={aba.value}
          role="tab"
          aria-selected={ativa === aba.value}
          onClick={() => onChange(aba.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
            ativa === aba.value ? "bg-primary text-white shadow-sm" : "text-foreground hover:bg-muted",
          )}
        >
          {aba.label}
          {aba.contador > 0 && (
            <span className={cx("rounded-full px-1.5 text-xs", ativa === aba.value ? "bg-white/25" : "bg-primary-soft text-primary")}>{aba.contador}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Table({ children, className }) {
  return (
    <div className={cx("overflow-x-auto rounded-xl border border-border bg-white", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export const Th = ({ children, className }) => (
  <th className={cx("whitespace-nowrap border-b border-border bg-slate-50 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>
    {children}
  </th>
);

export const Td = ({ children, className, ...props }) => (
  <td className={cx("border-b border-border/70 px-3 py-3 text-center align-middle", className)} {...props}>
    {children}
  </td>
);

export function Paginacao({ pagina, paginas, total, onChange, limite, onLimite }) {
  const [ir, setIr] = useState(pagina);
  useEffect(() => setIr(pagina), [pagina]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm text-muted-foreground">
      <span>{total} registro(s)</span>
      <div className="flex flex-wrap items-center gap-2">
        {onLimite && (
          <label className="flex items-center gap-2">
            Linhas por página
            <select className="input h-8 w-20" value={limite} onChange={(e) => onLimite(Number(e.target.value))}>
              {[30, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        <Button variant="outline" size="icon" disabled={pagina <= 1} onClick={() => onChange(1)} aria-label="Primeira página">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-1 text-foreground">
          Página {pagina} de {paginas}
        </span>
        <Button variant="outline" size="icon" disabled={pagina >= paginas} onClick={() => onChange(pagina + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" disabled={pagina >= paginas} onClick={() => onChange(paginas)} aria-label="Última página">
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <span className="ml-2">Ir para página</span>
        <input className="input h-8 w-16" type="number" min={1} max={paginas} value={ir} onChange={(e) => setIr(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => onChange(Math.min(paginas, Math.max(1, Number(ir) || 1)))}>
          Ir
        </Button>
      </div>
    </div>
  );
}

export function PageHeader({ titulo, subtitulo, extra, voltar = true, children }) {
  const navigate = useNavigate();
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
        {extra}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {voltar && (
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
      </div>
    </div>
  );
}

export function MetricCard({ titulo, valor, detalhe, icone: Icone, destaque, className }) {
  return (
    <Card className={cx("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        {Icone && <Icone className={cx("h-4 w-4", destaque || "text-muted-foreground")} />}
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight">{valor}</p>
      {detalhe && <p className="mt-1 text-sm text-muted-foreground">{detalhe}</p>}
    </Card>
  );
}
