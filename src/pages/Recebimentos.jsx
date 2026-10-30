import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BellRing, ClipboardList, Clock, PackageCheck, PackagePlus, Search, ShoppingCart, Trash2, Truck } from "lucide-react";
import api from "../services/api";
import { Button, Card, EmptyState, PageHeader, Segmented, Skeleton, Table, Tabs, Td, Th, cx, useConfirm, useToast } from "../components/ui";
import { data, dataHora } from "../utils/format";
import { Miniatura, SALDOS, StatusPre, TipoItem, atualizarAlertasRecebimentos, excluirPreRecebimento, un, useAlertasRecebimentos } from "../components/recebimentos/comum";
import PreRecebimentoForm from "../components/recebimentos/PreRecebimentoForm";
import PreRecebimentoDetalhe from "../components/recebimentos/PreRecebimentoDetalhe";
import Fornecedores from "../components/recebimentos/Fornecedores";
import { AbaCapsulas, AbaMontagem } from "../components/recebimentos/Montagem";

const FILTROS = {
  abertos: { label: "Em aberto", params: { status: "AGUARDANDO_FORNECEDOR,FORNECEDOR_RESPONDEU" } },
  recebidos: { label: "Recebidos", params: { status: "RECEBIDO,RECEBIDO_PARCIAL" } },
  divergencia: { label: "Com falta em aberto", params: { divergencia: "ABERTA" } },
  todos: { label: "Todos", params: {} },
};

function FaixaAlertas({ alertas, onAbrir, onAba }) {
  if (!alertas) return null;
  const { divergencias, respostas, atrasados, capsulasFaltando } = alertas;
  const acabando = alertas.insumosAcabando || [];
  if (!divergencias.length && !respostas.length && !atrasados.length && !capsulasFaltando.length && !acabando.length) return null;
  return (
    <div className="mb-5 grid gap-2 lg:grid-cols-2">
      {divergencias.map((d) => (
        <button key={d.id} type="button" onClick={() => onAbrir(d.id)} className="flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-left hover:bg-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span className="text-sm text-red-900">
            <strong>Faltou mercadoria no recebimento nº {d.numero}</strong> ({d.fornecedorNome || "sem fornecedor"}) — {d.divergenciaDescricao}
            {d.divergenciaPrazo && <span className="block text-xs">Prazo combinado: {data(d.divergenciaPrazo)}</span>}
          </span>
        </button>
      ))}
      {respostas.map((r) => (
        <button key={r.id} type="button" onClick={() => onAbrir(r.id)} className="flex items-start gap-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-left hover:bg-blue-100">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-blue-600" />
          <span className="text-sm text-blue-900">
            <strong>{r.fornecedorNome || "Fornecedor"} respondeu o pré-recebimento nº {r.numero}</strong>
            <span className="block text-xs">{dataHora(r.respondidoEm)} — clique para ver as quantidades</span>
          </span>
        </button>
      ))}
      {capsulasFaltando.length > 0 && (
        <button type="button" onClick={() => onAba("capsulas")} className="flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-left hover:bg-amber-100">
          <ShoppingCart className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <span className="text-sm text-amber-900">
            <strong>Comprar:</strong> {capsulasFaltando.map((c) => `${un(c.sugestao ?? c.falta)} ${c.nome}`).join(" · ")}
          </span>
        </button>
      )}
      {acabando.length > 0 && (
        <button type="button" onClick={() => onAba("capsulas")} className="flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-left hover:bg-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span className="text-sm text-red-900">
            <strong>Está acabando:</strong> {acabando.map((c) => `${c.nome} (restam ${un(c.estoque)})`).join(" · ")}
          </span>
        </button>
      )}
      {atrasados.map((a) => (
        <button key={a.id} type="button" onClick={() => onAbrir(a.id)} className="flex items-start gap-3 rounded-lg border border-amber-300 bg-white p-3 text-left hover:bg-amber-50">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <span className="text-sm">
            <strong>Pré-recebimento nº {a.numero} atrasado</strong> ({a.fornecedorNome || "sem fornecedor"}) — previsto para {data(a.previsao)}
          </span>
        </button>
      ))}
    </div>
  );
}

function ListaRecebimentos({ lista, onAbrir, onExcluir }) {
  if (!lista) return <Skeleton className="h-64" />;
  if (!lista.length) return <EmptyState icon={PackageCheck} titulo="Nada por aqui" descricao="Crie um pré-recebimento quando fizer uma compra, ou lance direto o que chegou." />;
  return (
    <Table>
      <thead>
        <tr>
          {["Nº", "Fornecedor", "Itens", "Pedido", "Fornecedor confirmou", "Recebido", "Previsão", "Status", ...(onExcluir ? [""] : [])].map((c) => (
            <Th key={c}>{c}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lista.map((p) => (
          <tr key={p.id} className={cx("cursor-pointer hover:bg-muted/50", p.divergenciaStatus === "ABERTA" && "bg-red-50", p.status === "FORNECEDOR_RESPONDEU" && !p.respostaVista && "bg-blue-50")} onClick={() => onAbrir(p.id)}>
            <Td className="font-mono text-xs">
              {p.numero}
              {p.direto && <span className="block font-sans text-[11px] text-muted-foreground">direto</span>}
            </Td>
            <Td className="text-left font-medium">{p.fornecedorNome || <span className="text-muted-foreground">—</span>}</Td>
            <Td className="text-left">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {p.itens.slice(0, 3).map((i) => (
                    <Miniatura key={i.id} src={i.imagemUrl} className="h-8 w-8 border-2 border-white" />
                  ))}
                </div>
                <div className="min-w-0 text-xs">
                  <p className="max-w-64 truncate">{p.itens.map((i) => i.produtoNome).join(", ")}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {[...new Set(p.itens.map((i) => i.destino))].map((d) => (
                      <TipoItem key={d} destino={d} />
                    ))}
                  </div>
                </div>
              </div>
            </Td>
            <Td>{un(p.totais.solicitado)}</Td>
            <Td>{p.totais.fornecedor != null ? <strong className={p.totais.fornecedor < p.totais.solicitado ? "text-amber-700" : ""}>{un(p.totais.fornecedor)}</strong> : "—"}</Td>
            <Td>{p.totais.recebido != null ? <strong>{un(p.totais.recebido)}</strong> : "—"}</Td>
            <Td className="text-xs">{p.previsaoFornecedor ? data(p.previsaoFornecedor) : p.previsaoEntrega ? data(p.previsaoEntrega) : "—"}</Td>
            <Td>
              <StatusPre status={p.status} />
              {p.divergenciaStatus === "ABERTA" && <span className="mt-1 block text-[11px] font-bold text-red-600">falta em aberto</span>}
            </Td>
            {onExcluir && (
              <Td>
                <button
                  type="button"
                  title="Excluir definitivamente"
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExcluir(p);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Historico() {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => api.get("/recebimentos/historico", { params: { busca: busca || undefined } }).then(({ data: d }) => setLista(d)), 250);
    return () => clearTimeout(t);
  }, [busca]);
  return (
    <div>
      <div className="relative mb-3 w-full sm:w-72">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <input className="input h-9 pl-9" placeholder="Produto ou motivo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <Table>
        <thead>
          <tr>
            {["Data", "Produto", "Saldo", "Movimento", "Antes → depois", "Motivo", "Por"].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!lista && (
            <tr>
              <td colSpan={7} className="p-3">
                <Skeleton className="h-20" />
              </td>
            </tr>
          )}
          {lista?.map((m) => (
            <tr key={m.id}>
              <Td className="text-xs">{dataHora(m.createdAt)}</Td>
              <Td className="text-left">{m.produtoNome}</Td>
              <Td className="text-xs">{m.saldo ? SALDOS[m.saldo] : "Estoque"}</Td>
              <Td>
                <span className={cx("font-semibold", m.tipo === "ENTRADA" ? "text-emerald-700" : m.tipo === "SAIDA" ? "text-red-600" : "text-blue-700")}>
                  {m.tipo === "ENTRADA" ? "+" : m.tipo === "SAIDA" ? "-" : "±"}
                  {un(m.quantidade)}
                </span>
              </Td>
              <Td className="text-xs">
                {un(m.quantidadeAnterior)} → {un(m.quantidadeNova)}
              </Td>
              <Td className="max-w-96 text-left text-xs">{m.motivo}</Td>
              <Td className="text-xs">{m.usuarioNome || "—"}</Td>
            </tr>
          ))}
          {lista && !lista.length && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-muted-foreground">
                Sem movimentos ainda.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}

export default function Recebimentos() {
  const [aba, setAba] = useState("recebimentos");
  const [filtro, setFiltro] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState(null);
  const [painel, setPainel] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [form, setForm] = useState(null);
  const [aberto, setAberto] = useState(null);
  const alertas = useAlertasRecebimentos(true);
  const navigate = useNavigate();
  const confirmar = useConfirm();
  const toast = useToast();

  const carregarLista = useCallback(() => {
    api.get("/recebimentos", { params: { ...FILTROS[filtro].params, busca: busca || undefined } }).then(({ data: d }) => setLista(d));
  }, [filtro, busca]);
  const carregarPainel = useCallback(() => api.get("/recebimentos/montagem").then(({ data: d }) => setPainel(d)), []);
  const carregarFornecedores = useCallback(() => api.get("/parceiros", { params: { tipo: "FORNECEDOR" } }).then(({ data: d }) => setFornecedores(d)), []);

  useEffect(() => {
    const t = setTimeout(carregarLista, 250);
    return () => clearTimeout(t);
  }, [carregarLista]);
  useEffect(() => {
    carregarPainel();
    carregarFornecedores();
  }, [carregarPainel, carregarFornecedores]);

  const alterado = () => {
    carregarLista();
    carregarPainel();
  };
  const comprar = (capsulas) =>
    setForm({
      inicial: {
        fornecedorId: capsulas.length === 1 ? capsulas[0].fornecedorPreferencialId || "" : "",
        observacao: "Compra de cápsulas para montar os brinquedos que chegaram sem cápsula.",
        itens: capsulas.map((c) => ({ produtoId: c.id, nome: c.nome, sku: c.sku, imagemUrl: c.imagemUrl, destino: "CAPSULA", quantidade: c.falta || "" })),
      },
    });

  const pendentes = painel?.produtos.reduce((s, p) => s + p.pendente, 0) || 0;

  return (
    <div className="container-app py-6">
      <PageHeader titulo="Recebimentos" subtitulo="Compras de brinquedos, cápsulas e produtos: pré-recebimento com link para o fornecedor, conferência na chegada e montagem em cápsula.">
        <Button variant="outline" onClick={() => navigate("/entradas")}>
          <ClipboardList className="h-4 w-4" /> Resumo entradas
        </Button>
        <Button variant="success" onClick={() => setForm({ direto: true })}>
          <PackageCheck className="h-4 w-4" /> Receber agora
        </Button>
        <Button variant="info" onClick={() => setForm({})}>
          <PackagePlus className="h-4 w-4" /> Novo pré-recebimento
        </Button>
      </PageHeader>

      <FaixaAlertas alertas={alertas} onAbrir={(id) => setAberto({ id })} onAba={setAba} />

      {painel && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Prontos no catálogo (montagem)</p>
            <p className="mt-1 text-2xl font-bold">{un(painel.produtos.reduce((s, p) => s + p.estoque, 0))}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Em montagem</p>
            <p className="mt-1 text-2xl font-bold text-violet-700">{un(painel.produtos.reduce((s, p) => s + p.emMontagem, 0))}</p>
          </Card>
          <Card className={cx("p-4", pendentes > 0 && "border-amber-300 bg-amber-50")}>
            <p className="text-sm text-muted-foreground">Pendentes de cápsula</p>
            <p className={cx("mt-1 text-2xl font-bold", pendentes > 0 && "text-red-600")}>{un(pendentes)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Pré-recebimentos em aberto</p>
            <p className="mt-1 text-2xl font-bold">{filtro === "abertos" && lista ? lista.length : "—"}</p>
          </Card>
        </div>
      )}

      <Tabs
        className="mb-4"
        ativa={aba}
        onChange={setAba}
        abas={[
          { value: "recebimentos", label: "Pré-recebimentos", contador: (alertas?.respostas.length || 0) + (alertas?.divergencias.length || 0) },
          { value: "montagem", label: "Montagem", contador: painel?.ordens.length || 0 },
          { value: "capsulas", label: "Cápsulas, sleeves e compras", contador: (alertas?.capsulasFaltando.length || 0) + (alertas?.insumosAcabando?.length || 0) },
          { value: "fornecedores", label: "Fornecedores" },
          { value: "historico", label: "Histórico" },
        ]}
      />

      {aba === "recebimentos" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented value={filtro} onChange={setFiltro} opcoes={Object.entries(FILTROS).map(([value, f]) => ({ value, label: f.label }))} />
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <input className="input h-9 pl-9" placeholder="Nº, fornecedor ou produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <ListaRecebimentos lista={lista} onAbrir={(id) => setAberto({ id })} onExcluir={filtro === "todos" ? async (p) => (await excluirPreRecebimento(p, { confirmar, toast })) && alterado() : undefined} />
        </>
      )}
      {aba === "montagem" && (painel ? <AbaMontagem painel={painel} onPainel={setPainel} /> : <Skeleton className="h-64" />)}
      {aba === "capsulas" &&
        (painel ? <AbaCapsulas painel={painel} fornecedores={fornecedores} onPainel={(d) => setPainel((p) => ({ ...p, ...d }))} onRecarregar={carregarPainel} onComprar={comprar} /> : <Skeleton className="h-64" />)}
      {aba === "fornecedores" && <Fornecedores fornecedores={fornecedores} onAtualizar={carregarFornecedores} />}
      {aba === "historico" && <Historico />}

      {form && (
        <PreRecebimentoForm
          pre={form.pre}
          direto={form.direto}
          inicial={form.inicial}
          fornecedores={fornecedores}
          onFornecedorCriado={carregarFornecedores}
          onFechar={() => setForm(null)}
          onSalvo={(d) => {
            setForm(null);
            alterado();
            atualizarAlertasRecebimentos();
            if (!d.direto) setAberto({ id: d.id, link: d.linkToken });
          }}
        />
      )}
      {aberto && (
        <PreRecebimentoDetalhe
          key={aberto.id}
          id={aberto.id}
          linkInicial={aberto.link}
          fornecedores={fornecedores}
          onFechar={() => setAberto(null)}
          onAlterado={alterado}
          onEditar={(pre) => {
            setAberto(null);
            setForm({ pre });
          }}
          onAbrirOutro={(id, link) => setAberto({ id, link })}
        />
      )}
      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Truck className="h-3.5 w-3.5" /> O link do fornecedor não pede login e mostra só aquele pré-recebimento; dá para gerar um novo a qualquer momento (o antigo para de funcionar).
      </p>
    </div>
  );
}
