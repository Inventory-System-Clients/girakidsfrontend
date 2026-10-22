import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Download, FileDown, Package, Plus, ShoppingCart, Sparkles, Trash2, Truck, Wallet } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Popover,
  Select,
  Spinner,
  Textarea,
  cx,
  useToast,
} from "../components/ui";
import EnderecoCampos from "../components/EnderecoCampos";
import ClienteBusca from "../components/ClienteBusca";
import { ClienteSelecionado, HistoricoCliente, MontarComIA } from "../components/checkout/Assistente";
import { lerEscolhasGiraldo } from "../components/Giraldo";
import SeletorTransportadora from "../components/checkout/SeletorTransportadora";
import { hojeISO, lerNumero, moeda, moedaUnitaria, somenteDigitos } from "../utils/format";
import { FORMAS_PAGAMENTO } from "../utils/status";
import { gerarPdfPedido } from "../utils/pdf";

const TAXAS_CARTAO = { 1: 3.15, 2: 4.39, 3: 5.19, 4: 5.99, 5: 6.79, 6: 7.59, 7: 8.39, 8: 9.19, 9: 9.99, 10: 10.79, 11: 11.59, 12: 12.39 };

const dadosDoUsuario = (u) => ({
  nome: u?.nome || "",
  email: u?.email || "",
  telefone: u?.telefone || "",
  documento: u?.documento || "",
  documentoTipo: u?.documentoTipo || "CPF",
  cep: u?.cep || "",
  rua: u?.rua || "",
  numero: u?.numero || "",
  complemento: u?.complemento || "",
  bairro: u?.bairro || "",
  cidade: u?.cidade || "",
  estado: u?.estado || "",
});

function CarregarPedido({ onCarregado }) {
  const { carregar } = useCart();
  const toast = useToast();
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);

  const buscar = async () => {
    if (!codigo.trim()) return;
    setCarregando(true);
    try {
      const { data: pedido } = await api.get(`/pedidos/codigo/${codigo.trim()}`);
      if (!pedido.itens.length) throw new Error("Este pedido não possui itens.");
      const ids = pedido.itens.map((i) => i.produtoId).filter(Boolean);
      const { data: produtos } = await api.get("/produtos/busca", { params: { limite: 200, busca: "" } }).catch(() => ({ data: [] }));
      const porId = new Map(produtos.map((p) => [p.id, p]));
      const disponiveis = pedido.itens.filter((i) => i.produtoId && ids.includes(i.produtoId));
      if (!disponiveis.length) throw new Error("Nenhum item deste pedido está disponível no momento.");
      carregar(
        disponiveis.map((i) => ({
          produto: porId.get(i.produtoId) || {
            id: i.produtoId,
            nome: i.nome,
            sku: i.sku,
            categoria: i.categoria,
            imagemUrl: i.imagemUrl,
            unidadesPacote: i.unidadesPacote,
            precoVenda: i.precoUnitario,
          },
          quantidade: i.quantidade,
          precoUnitario: null,
        })),
      );
      onCarregado?.(pedido);
      toast({
        titulo: disponiveis.length < pedido.itens.length ? "Pedido parcialmente carregado" : "Pedido carregado com sucesso",
        descricao: `${disponiveis.length} item(ns) do ${pedido.tipo === "ORCAMENTO" ? "orçamento" : "pedido"} ${pedido.numeroFormatado}.`,
      });
    } catch (error) {
      toast({ titulo: "Erro ao carregar pedido", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Popover
      alinhamento="end"
      gatilho={
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" /> Carregar Pedido
        </Button>
      }
    >
      {(fechar) => (
        <div className="w-72 p-2">
          <p className="mb-2 text-sm text-muted-foreground">Digite o código de um pedido anterior para replicar os itens no carrinho.</p>
          <div className="flex gap-2">
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: 63037 ou 0065" onKeyDown={(e) => e.key === "Enter" && buscar().then(fechar)} />
            <Button loading={carregando} onClick={() => buscar().then(fechar)}>
              Carregar
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}

// Mescla de pagamentos: divide o total entre formas com vencimentos próprios.
export function EditorMescla({ linhas, onChange, total, formas }) {
  const soma = linhas.reduce((s, l) => s + lerNumero(l.valor), 0);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-slate-50 p-3">
      {linhas.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_9rem_auto] gap-2">
          <Select value={l.metodo} onChange={(e) => onChange(linhas.map((x, j) => (j === i ? { ...x, metodo: e.target.value } : x)))}>
            {formas.filter((f) => f !== "MESCLA").map((f) => (
              <option key={f} value={f}>
                {FORMAS_PAGAMENTO[f]?.label || f}
              </option>
            ))}
          </Select>
          <Input placeholder="0,00" value={l.valor} onChange={(e) => onChange(linhas.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} />
          <Input type="date" value={l.vencimento} onChange={(e) => onChange(linhas.map((x, j) => (j === i ? { ...x, vencimento: e.target.value } : x)))} />
          <Button variant="ghost" size="icon" onClick={() => onChange(linhas.filter((_, j) => j !== i))} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between text-sm">
        <Button variant="outline" size="sm" onClick={() => onChange([...linhas, { metodo: "PIX_PRESENCIAL", valor: "", vencimento: hojeISO() }])}>
          <Plus className="h-4 w-4" /> Adicionar forma
        </Button>
        <span className={cx(Math.abs(soma - total) > 0.01 ? "text-amber-700" : "text-emerald-700")}>
          Informado {moeda(soma)} de {moeda(total)}
        </span>
      </div>
    </div>
  );
}

export default function Checkout({ modo = "pedido" }) {
  const orcamento = modo === "orcamento";
  const { usuario, interno, atualizarUsuario } = useAuth();
  const { itens, definirQuantidade, definirPreco, limpar, subtotal } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  // Equipe: cliente escolhido fica guardado na aba enquanto monta o carrinho
  // pelo catálogo (sessionStorage).
  const chaveCliente = `girakids_checkout_cliente_${modo}`;
  const [clienteSelecionado, setClienteSelecionado] = useState(() => {
    if (!interno) return null;
    try {
      return JSON.parse(sessionStorage.getItem(chaveCliente) || "null");
    } catch {
      return null;
    }
  });
  const [cliente, setCliente] = useState(() => (interno ? dadosDoUsuario(clienteSelecionado || {}) : dadosDoUsuario(usuario)));
  const [clienteId, setClienteId] = useState(() => clienteSelecionado?.id || null);
  const [mostrarIA, setMostrarIA] = useState(false);
  const [transportadora, setTransportadora] = useState(null);
  const [transportadoraObs, setTransportadoraObs] = useState("");
  const [cotacao, setCotacao] = useState({ numero: "", com: "" });

  const escolherCliente = (u) => {
    setClienteSelecionado(u);
    setClienteId(u?.id || null);
    setCliente(dadosDoUsuario(u || {}));
    try {
      if (u) sessionStorage.setItem(chaveCliente, JSON.stringify(u));
      else sessionStorage.removeItem(chaveCliente);
    } catch {
      // sem armazenamento: vale só nesta tela
    }
  };
  const [observacoes, setObservacoes] = useState("");
  const [desconto, setDesconto] = useState("");
  const [freteAdicional, setFreteAdicional] = useState("");
  // Cliente que veio do Giraldo já chega com entrega/pagamento escolhidos.
  const escolhasGiraldo = interno ? {} : lerEscolhasGiraldo();
  const [metodoEnvio, setMetodoEnvio] = useState(escolhasGiraldo.metodoEnvio || "");
  const [frete, setFrete] = useState(null);
  const [cotando, setCotando] = useState(false);
  const [opcoes, setOpcoes] = useState(null);
  const [forma, setForma] = useState(interno ? "A_DEFINIR" : escolhasGiraldo.formaPagamento || "");
  const [parcelas, setParcelas] = useState(1);
  const [mescla, setMescla] = useState([]);
  const [usarCredito, setUsarCredito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [orcamentoGerado, setOrcamentoGerado] = useState(null);

  useEffect(() => {
    api.get("/checkout/opcoes").then(({ data }) => setOpcoes(data)).catch(() => setOpcoes({ formas: [] }));
  }, []);

  const itensApi = useMemo(() => itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })), [itens]);
  const chaveItens = JSON.stringify(itensApi);

  // Cotação de frete só com CEP completo (como a loja original).
  useEffect(() => {
    if (!itens.length) return undefined;
    const cep = somenteDigitos(cliente.cep);
    const t = setTimeout(async () => {
      setCotando(true);
      try {
        const { data } = await api.post("/checkout/frete", { cep, uf: cliente.estado, itens: itensApi });
        setFrete(data);
      } catch {
        setFrete(null);
      } finally {
        setCotando(false);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.cep, cliente.estado, chaveItens]);

  const opcaoEnvio = frete?.opcoes?.find((o) => o.metodo === metodoEnvio);
  const valorFrete = opcaoEnvio?.disponivel ? Number(opcaoEnvio.valor || 0) : 0;
  const descontoNum = interno ? Math.min(subtotal, lerNumero(desconto)) : 0;
  const adicionalNum = interno ? lerNumero(freteAdicional) : 0;
  const creditoDisponivel = Number(usuario?.credito || 0);
  const creditoUsado = usarCredito ? Math.min(creditoDisponivel, subtotal - descontoNum) : 0;
  const base = Math.max(0, subtotal - descontoNum - creditoUsado) + valorFrete + adicionalNum;
  const config = opcoes?.formas?.find((f) => f.codigo === forma);
  const percentual = config?.cartao ? (opcoes?.taxasCartao || TAXAS_CARTAO)[parcelas] || 0 : config?.taxa || 0;
  const taxas = Math.round(base * percentual) / 100;
  const total = base + taxas;

  const enviar = async () => {
    if (!itens.length) return;
    if (!orcamento && !metodoEnvio) return toast({ titulo: "Selecione uma opção de entrega", tipo: "aviso" });
    if (!orcamento && !forma) return toast({ titulo: "Selecione a forma de pagamento", tipo: "aviso" });
    if (!cliente.nome) return toast({ titulo: "Campos obrigatórios", descricao: "Preencha os dados do cliente.", tipo: "aviso" });
    setEnviando(true);
    try {
      const corpo = {
        clienteId,
        cliente,
        itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
        metodoEnvio: metodoEnvio || null,
        desconto: descontoNum,
        freteAdicional: adicionalNum,
        formaPagamento: forma || "A_DEFINIR",
        parcelasCartao: config?.cartao ? parcelas : null,
        composicaoPagamento: forma === "MESCLA" ? mescla.map((l) => ({ ...l, valor: lerNumero(l.valor) })) : null,
        usarCredito,
        transportadora:
          metodoEnvio === "TRANSPORTADORA" && transportadora
            ? { id: transportadora.id, nome: transportadora.nome, telefone: transportadora.whatsapp || transportadora.telefone, cidade: transportadora.cidadeBase, observacao: transportadora.observacao }
            : null,
        transportadoraObs: metodoEnvio === "TRANSPORTADORA" ? transportadoraObs : null,
        transportadoraCotacao: metodoEnvio === "TRANSPORTADORA" ? cotacao.numero : null,
        transportadoraCotacaoCom: metodoEnvio === "TRANSPORTADORA" ? cotacao.com : null,
        observacoes,
      };
      // Cliente novo: a conta é criada com os dados do pedido (senha padrão).
      const avisarCadastro = (data) => {
        const c = data.clienteCadastro;
        if (!c?.criado) return;
        toast({
          titulo: "Cliente cadastrado ✅",
          descricao: c.emailGerado
            ? "Os dados ficaram salvos para os próximos pedidos (sem e-mail informado, o cliente não entra no site)."
            : `Login: ${c.email} · senha: ${c.senhaPadrao}. Da próxima vez os dados são preenchidos automaticamente.`,
        });
      };
      if (orcamento) {
        const { data } = await api.post("/orcamentos", corpo);
        avisarCadastro(data);
        setOrcamentoGerado(data);
        await gerarPdfPedido(data).catch(() => toast({ titulo: "Orçamento salvo sem PDF", tipo: "aviso" }));
        limpar();
        escolherCliente(null);
      } else {
        const { data } = await api.post("/pedidos", corpo);
        if (interno) avisarCadastro(data);
        limpar();
        if (interno) escolherCliente(null);
        if (usarCredito) api.get("/auth/perfil").then(({ data: u }) => atualizarUsuario(u)).catch(() => {});
        navigate(`/pagamento/${data.id}`);
      }
    } catch (error) {
      toast({ titulo: orcamento ? "Erro ao criar orçamento" : "Erro ao finalizar pedido", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  if (orcamentoGerado) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-8 text-center">
          <FileDown className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Orçamento gerado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use o código abaixo para reenviar o PDF ao cliente ou carregar esse orçamento novamente.</p>
          <p className="mt-6 text-sm text-muted-foreground">Código do orçamento</p>
          <p className="text-4xl font-bold tracking-widest text-primary">{orcamentoGerado.numeroFormatado}</p>
          {orcamentoGerado.clienteCadastro?.criado && !orcamentoGerado.clienteCadastro.emailGerado && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Cliente cadastrado — login <strong>{orcamentoGerado.clienteCadastro.email}</strong>, senha <strong>{orcamentoGerado.clienteCadastro.senhaPadrao}</strong>.
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(orcamentoGerado.numeroFormatado).then(() => toast({ titulo: "Código copiado" }))}>
              <Copy className="h-4 w-4" /> Copiar código
            </Button>
            <Button variant="outline" onClick={() => gerarPdfPedido(orcamentoGerado)}>
              <FileDown className="h-4 w-4" /> Baixar PDF novamente
            </Button>
            <Button variant="outline" onClick={() => navigate("/historico-pedidos?aba=ORCAMENTOS")}>
              Ver no histórico
            </Button>
            <Button onClick={() => setOrcamentoGerado(null)}>Novo orçamento</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Equipe com carrinho vazio: começa pelo cliente (copiar último pedido,
  // itens frequentes ou IA a partir da mensagem dele).
  if (!itens.length && interno) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PageHeader titulo={orcamento ? "Geração de Orçamentos" : "Checkout"} subtitulo="Comece pelo cliente: copie o último pedido dele, adicione o que ele costuma comprar ou cole a mensagem para a IA montar.">
          <CarregarPedido />
        </PageHeader>
        <Card className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-semibold">1. Cliente</p>
            {clienteSelecionado ? (
              <ClienteSelecionado cliente={clienteSelecionado} onTrocar={() => escolherCliente(null)} onAtualizar={escolherCliente} />
            ) : (
              <ClienteBusca autoFocus onEscolher={escolherCliente} />
            )}
          </div>
          {clienteSelecionado && (
            <div>
              <p className="mb-2 text-sm font-semibold">2. Itens</p>
              <HistoricoCliente clienteId={clienteSelecionado.id} />
            </div>
          )}
          <MontarComIA />
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Link to="/">
              <Button variant="outline">
                <ShoppingCart className="h-4 w-4" /> Escolher no catálogo
              </Button>
            </Link>
            {!clienteSelecionado && <span className="self-center text-xs text-muted-foreground">Também dá para montar sem cliente e preencher os dados depois.</span>}
          </div>
        </Card>
      </div>
    );
  }

  if (!itens.length) {
    return (
      <div className="container-app py-8">
        <PageHeader titulo={orcamento ? "Geração de Orçamentos" : "Checkout"} subtitulo={orcamento ? "Monte pedidos administrativos, gere o PDF e salve o código para reaproveitar no checkout." : "Revise seu pedido e finalize a compra"}>
          <CarregarPedido />
        </PageHeader>
        <Card>
          <EmptyState
            icon={ShoppingCart}
            titulo="Carrinho vazio"
            descricao={orcamento ? "Monte o orçamento pelo catálogo ou carregue um pedido existente para testar outro cenário." : "Seu carrinho está vazio. Adicione produtos para continuar ou carregue um pedido anterior."}
          >
            <Link to="/">
              <Button className="mt-3">Voltar ao catálogo</Button>
            </Link>
          </EmptyState>
        </Card>
      </div>
    );
  }

  const formasVisiveis = (opcoes?.formas || []).filter((f) => f.codigo !== "MESCLA" || interno);

  return (
    <div className="container-app py-8">
      <PageHeader titulo={orcamento ? "Geração de Orçamentos" : "Checkout"} subtitulo={orcamento ? "Monte pedidos administrativos, gere o PDF e salve o código para reaproveitar no checkout." : "Revise seu pedido e finalize a compra"} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Package className="h-5 w-5 text-primary" /> Revisar Pedido <Badge>{itens.length} produtos</Badge>
              </h2>
              <div className="flex flex-wrap gap-2">
                {interno && (
                  <Button variant="outline" size="sm" onClick={() => setMostrarIA(!mostrarIA)}>
                    <Sparkles className="h-4 w-4" /> Adicionar com IA
                  </Button>
                )}
                <CarregarPedido onCarregado={(p) => p.observacoes && setObservacoes(p.observacoes)} />
              </div>
            </div>
            {interno && mostrarIA && (
              <div className="mb-4">
                <MontarComIA onAdicionado={() => setMostrarIA(false)} />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left">Produto</th>
                    <th>Qtd</th>
                    <th className="text-right">Preço</th>
                    {interno && <th className="text-right">Novo valor</th>}
                    <th className="text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {itens.map(({ produto, quantidade, precoUnitario }) => {
                    const preco = precoUnitario != null && precoUnitario !== "" ? lerNumero(precoUnitario) : produto.precoVenda;
                    return (
                      <tr key={produto.id} className="border-b border-border/60">
                        <td className="py-3">
                          <p className="font-medium">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground">{produto.categoria}</p>
                        </td>
                        <td className="text-center">
                          <input className="input h-8 w-16 text-center" value={quantidade} onChange={(e) => definirQuantidade(produto, e.target.value.replace(/\D/g, "") || 0)} />
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{produto.unidadesPacote > 1 ? `${quantidade} pct · ${quantidade * produto.unidadesPacote} un` : "un"}</p>
                        </td>
                        <td className="text-right">{moedaUnitaria(produto.precoVenda)}</td>
                        {interno && (
                          <td className="text-right">
                            <input className="input ml-auto h-8 w-24 text-right" placeholder="—" value={precoUnitario ?? ""} onChange={(e) => definirPreco(produto.id, e.target.value === "" ? null : e.target.value)} />
                          </td>
                        )}
                        <td className="text-right font-semibold">{moeda(preco * (produto.unidadesPacote || 1) * quantidade)}</td>
                        <td className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => definirQuantidade(produto, 0)} aria-label="Remover">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              {interno ? (
                <Field label="Desconto no subtotal" className="w-44">
                  <Input placeholder="0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
                </Field>
              ) : (
                <span />
              )}
              <p className="text-right">
                <span className="text-sm text-muted-foreground">Subtotal </span>
                <span className="text-lg font-bold">{moeda(subtotal)}</span>
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Informações de entrega</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setCliente(dadosDoUsuario(usuario))}>
                  Preencher automaticamente
                </Button>
              </div>
            </div>
            {interno && (
              <div className="mb-4">
                {clienteSelecionado ? (
                  <ClienteSelecionado cliente={clienteSelecionado} onTrocar={() => escolherCliente(null)} onAtualizar={escolherCliente} />
                ) : (
                  <ClienteBusca onEscolher={escolherCliente} placeholder="Buscar cliente cadastrado (nome, e-mail, telefone ou CPF/CNPJ)..." />
                )}
              </div>
            )}
            <EnderecoCampos valor={cliente} onChange={setCliente} obrigatorio={!orcamento} />
            <Field label="Observações do pedido" className="mt-4">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Field>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Truck className="h-5 w-5 text-primary" /> Opções de Entrega {cotando && <Spinner className="h-4 w-4" />}
            </h2>
            {interno && (
              <div className="mb-4 rounded-lg border border-dashed border-primary/40 bg-primary-soft/50 p-3">
                <p className="text-sm font-medium">Custo adicional</p>
                <p className="mb-2 text-xs text-muted-foreground">Use sozinho sem CEP em pedidos manuais, ou some ao frete selecionado. Ex.: Uber ou transportadora. Visível apenas para administradores.</p>
                <Input className="w-44" placeholder="Valor do custo adicional" value={freteAdicional} onChange={(e) => setFreteAdicional(e.target.value)} />
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {(frete?.opcoes || [
                { metodo: "RETIRAR_LOCAL", nome: "Retirar no local", descricao: "Retire em nossa loja", valor: 0, disponivel: true },
                { metodo: "TRANSPORTADORA", nome: "Transportadora", descricao: "O time de vendas entrará em contato", disponivel: true },
              ]).map((o) => (
                <button
                  key={o.metodo}
                  disabled={!o.disponivel}
                  onClick={() => setMetodoEnvio(o.metodo)}
                  className={cx(
                    "rounded-lg border p-3 text-left transition disabled:opacity-50",
                    metodoEnvio === o.metodo ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "border-border hover:border-primary/40",
                  )}
                >
                  <p className="font-medium">{o.nome}</p>
                  <p className="text-xs text-muted-foreground">{o.descricao}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {!o.disponivel
                      ? o.motivo
                      : o.metodo === "RETIRAR_LOCAL"
                        ? "Grátis · Retirada imediata"
                        : o.metodo === "TRANSPORTADORA"
                          ? "A combinar"
                          : `${moeda(o.valor)} · ${o.prazoDias} dias úteis${o.estimado ? " (estimado)" : ""}`}
                  </p>
                </button>
              ))}
            </div>
            {interno && metodoEnvio === "TRANSPORTADORA" && (
              <div className="mt-4">
                <SeletorTransportadora
                  uf={cliente.estado}
                  cidade={cliente.cidade}
                  pesoGramas={frete?.pesoGramas}
                  selecionada={transportadora}
                  onSelecionar={setTransportadora}
                  observacao={transportadoraObs}
                  onObservacao={setTransportadoraObs}
                  cotacao={cotacao}
                  onCotacao={setCotacao}
                />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Wallet className="h-5 w-5 text-primary" /> Forma de Pagamento
            </h2>
            {!opcoes && <Spinner />}
            <div className="grid gap-2 sm:grid-cols-2">
              {formasVisiveis.map((f) => {
                const Icone = FORMAS_PAGAMENTO[f.codigo]?.icone || Wallet;
                return (
                  <button
                    key={f.codigo}
                    disabled={!f.disponivel || (f.somenteEnvios && !f.somenteEnvios.includes(metodoEnvio))}
                    onClick={() => {
                      setForma(f.codigo);
                      if (f.codigo === "MESCLA" && !mescla.length) setMescla([{ metodo: "PIX_PRESENCIAL", valor: "", vencimento: hojeISO() }]);
                    }}
                    className={cx(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition disabled:opacity-50",
                      forma === f.codigo ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "border-border hover:border-primary/40",
                    )}
                  >
                    <Icone className="h-5 w-5 text-primary" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{f.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.combinar
                          ? f.somenteEnvios
                            ? "Para retirada ou transportadora"
                            : "O comercial envia a forma de pagamento"
                          : f.cartao
                            ? "Taxas variáveis"
                            : f.taxa
                              ? `+ ${String(f.taxa).replace(".", ",")}%`
                              : "Sem taxa"}
                      </span>
                    </span>
                    {f.admin && <Badge variant="outline">ADM</Badge>}
                  </button>
                );
              })}
            </div>
            {opcoes && !opcoes.pagamentosOnline?.habilitado && (
              <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">Pagamentos online (PIX QR Code e cartão) estão desabilitados no momento. Use outra forma ou fale com o time de vendas.</p>
            )}
            {config?.cartao && (
              <Field label="Parcelas" className="mt-4 w-56">
                <Select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                  {Object.keys(opcoes?.taxasCartao || TAXAS_CARTAO).map((n) => (
                    <option key={n} value={n}>
                      {n === "1" ? "À vista" : `${n}x`} (+{String((opcoes?.taxasCartao || TAXAS_CARTAO)[n]).replace(".", ",")}%)
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {forma === "MESCLA" && (
              <div className="mt-4">
                <EditorMescla linhas={mescla} onChange={setMescla} total={total} formas={formasVisiveis.map((f) => f.codigo)} />
              </div>
            )}
            {creditoDisponivel > 0 && (
              <Checkbox className="mt-4" checked={usarCredito} onChange={setUsarCredito} label={`Usar crédito disponível (${moeda(creditoDisponivel)})`} />
            )}
          </Card>
        </div>

        <aside>
          <Card className="space-y-2 p-5 lg:sticky lg:top-20">
            <h2 className="mb-2 text-lg font-semibold">Resumo</h2>
            <Linha rotulo="Subtotal dos produtos" valor={moeda(subtotal)} />
            {descontoNum > 0 && <Linha rotulo="Desconto" valor={`- ${moeda(descontoNum)}`} />}
            {creditoUsado > 0 && <Linha rotulo="Crédito" valor={`- ${moeda(creditoUsado)}`} />}
            <Linha rotulo="Frete" valor={!metodoEnvio ? "A definir" : metodoEnvio === "RETIRAR_LOCAL" ? "Grátis" : metodoEnvio === "TRANSPORTADORA" ? "A combinar" : moeda(valorFrete)} />
            {adicionalNum > 0 && <Linha rotulo="Custo adicional" valor={moeda(adicionalNum)} />}
            {taxas > 0 && <Linha rotulo={`Taxas (${String(percentual).replace(".", ",")}%)`} valor={moeda(taxas)} />}
            <div className="flex justify-between border-t border-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{moeda(total)}</span>
            </div>
            <Button variant={orcamento ? "primary" : "success"} size="lg" className="mt-3 w-full" loading={enviando} onClick={enviar}>
              {orcamento ? (enviando ? "Salvando orçamento..." : "Salvar orçamento e gerar PDF") : "Finalizar Pedido"}
            </Button>
            {!orcamento && !metodoEnvio && <p className="text-center text-xs text-muted-foreground">Selecione uma opção de entrega</p>}
            {orcamento && (
              <Button variant="outline" className="w-full" onClick={limpar}>
                Limpar orçamento
              </Button>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

const Linha = ({ rotulo, valor }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{rotulo}</span>
    <span className="font-medium">{valor}</span>
  </div>
);

