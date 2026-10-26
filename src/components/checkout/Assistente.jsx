import { useEffect, useState } from "react";
import { Copy, History, Plus, ShoppingBag, Sparkles, X } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { useCart } from "../../contexts/CartContext";
import { Badge, Button, Card, Checkbox, Skeleton, Textarea, useToast } from "../ui";
import { EditorEtiquetas, EtiquetasChips } from "../Etiquetas";
import { BotaoWhatsapp } from "../Whatsapp";
import { data, moeda, moedaUnitaria } from "../../utils/format";
import { METODOS_ENVIO, nomeForma } from "../../utils/status";

const paraCarrinho = (itens) =>
  itens.filter((i) => i.produto && i.disponivel !== false).map((i) => ({ produto: i.produto, quantidade: i.quantidade, precoUnitario: null }));

// Cartão do cliente escolhido (etiquetas, observação, WhatsApp, trocar).
// simples: totem do showroom — só nome, contato e "Trocar cliente".
export function ClienteSelecionado({ cliente, onTrocar, onAtualizar, simples }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary-soft/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 font-semibold">
          {cliente.nome}
          {!simples && <EtiquetasChips etiquetas={cliente.etiquetas} />}
          {!simples && <EditorEtiquetas clienteId={cliente.id} etiquetas={cliente.etiquetas || []} observacao={cliente.observacaoComercial} onSalvo={(d) => onAtualizar?.({ ...cliente, ...d })} />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{[cliente.email, cliente.telefone, cliente.cidade && `${cliente.cidade}/${cliente.estado || ""}`].filter(Boolean).join(" · ")}</p>
        {!simples && cliente.observacaoComercial && <p className="mt-1 text-xs text-amber-900">Obs.: {cliente.observacaoComercial}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {!simples && cliente.telefone && (
          <BotaoWhatsapp telefone={cliente.telefone} variante="contorno" className="py-1.5 text-xs" texto={`Olá ${cliente.nome.split(" ")[0]}! Aqui é da Gira Kids.`}>
            WhatsApp
          </BotaoWhatsapp>
        )}
        <Button variant="outline" size="sm" onClick={onTrocar}>
          Trocar cliente
        </Button>
      </div>
    </div>
  );
}

// Histórico do cliente: copiar último pedido (ou outro recente) e itens que
// ele costuma comprar.
export function HistoricoCliente({ clienteId, onCopiado }) {
  const { carregar, definirQuantidade, itens: carrinho } = useCart();
  const toast = useToast();
  const [hist, setHist] = useState(null);
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    setHist(null);
    api
      .get(`/usuarios/${clienteId}/historico`)
      .then(({ data: d }) => setHist(d))
      .catch((e) => {
        toast({ titulo: "Erro ao carregar histórico", descricao: mensagemErro(e), tipo: "erro" });
        setHist({ pedidos: [], frequentes: [] });
      });
  }, [clienteId, toast]);

  if (!hist) return <Skeleton className="h-32" />;
  const ultimo = hist.pedidos[0];

  const copiar = (pedido) => {
    const itens = paraCarrinho(pedido.itens);
    if (!itens.length) return toast({ titulo: "Nenhum item disponível", descricao: "Os produtos deste pedido não estão mais no catálogo.", tipo: "aviso" });
    carregar(itens);
    const fora = pedido.itens.length - itens.length;
    toast({ titulo: `${pedido.tipo === "ORCAMENTO" ? "Orçamento" : "Pedido"} ${pedido.numeroFormatado} copiado`, descricao: fora ? `${fora} item(ns) fora do catálogo ficaram de fora.` : "Revise quantidades e preços." });
    onCopiado?.(pedido);
  };

  if (!hist.pedidos.length) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">Este cliente ainda não tem pedidos. Monte pelo catálogo ou use a IA abaixo.</p>;
  }

  return (
    <div className="space-y-3">
      <Card className="border-emerald-200 bg-emerald-50/50 p-4">
        <p className="text-sm font-semibold">Quer copiar o último pedido do cliente?</p>
        <p className="text-xs text-muted-foreground">
          {ultimo.tipo === "ORCAMENTO" ? "Orçamento" : "Pedido"} {ultimo.numeroFormatado} · {data(ultimo.createdAt)} · {ultimo.itens.length} itens · {moeda(ultimo.total)} · {nomeForma(ultimo.formaPagamento)} ·{" "}
          {METODOS_ENVIO[ultimo.metodoEnvio] || "-"}
        </p>
        <p className="mt-1 line-clamp-2 text-xs">{ultimo.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(" · ")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="success" onClick={() => copiar(ultimo)}>
            <Copy className="h-4 w-4" /> Copiar último pedido
          </Button>
          {hist.pedidos.length > 1 && (
            <Button variant="outline" onClick={() => setVerTodos(!verTodos)}>
              <History className="h-4 w-4" /> {verTodos ? "Ocultar" : "Ver"} outros pedidos ({hist.pedidos.length - 1})
            </Button>
          )}
        </div>
        {verTodos && (
          <div className="mt-3 space-y-2">
            {hist.pedidos.slice(1).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-white p-2 text-sm">
                <span className="min-w-0">
                  <strong>{p.tipo === "ORCAMENTO" ? "Orç." : "Ped."} {p.numeroFormatado}</strong> · {data(p.createdAt)} · {moeda(p.total)}
                  <span className="block truncate text-xs text-muted-foreground">{p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(" · ")}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => copiar(p)}>
                  Copiar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      {hist.frequentes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">O que este cliente costuma comprar</p>
          <div className="flex flex-wrap gap-2">
            {hist.frequentes.map((f) => {
              const noCarrinho = carrinho.some((c) => c.produto.id === f.produto.id);
              return (
                <button
                  key={f.produto.id}
                  type="button"
                  disabled={noCarrinho || !f.produto.disponivel}
                  onClick={() => definirQuantidade(f.produto, f.quantidadeMedia)}
                  className="flex items-center gap-2 rounded-full border border-border bg-white py-1 pr-3 pl-1 text-xs hover:border-primary disabled:opacity-50"
                  title={`Comprou ${f.vezes}x · média ${f.quantidadeMedia} emb.`}
                >
                  {f.produto.imagemUrl ? <img src={f.produto.imagemUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : <ShoppingBag className="h-4 w-4" />}
                  {noCarrinho ? "✓ " : "+ "}
                  {f.produto.nome} <span className="text-muted-foreground">({f.vezes}x)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Cola a mensagem do cliente (WhatsApp, e-mail) e a IA monta os itens.
export function MontarComIA({ onAdicionado }) {
  const { itens: carrinho, carregar } = useCart();
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [marcados, setMarcados] = useState({});

  const interpretar = async () => {
    setCarregando(true);
    setResultado(null);
    try {
      const { data: d } = await api.post("/orcamentos/ia/interpretar", { texto });
      setResultado(d);
      setMarcados(Object.fromEntries(d.itens.map((i) => [i.produtoId, true])));
    } catch (error) {
      toast({ titulo: "A IA não conseguiu montar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setCarregando(false);
    }
  };

  const adicionar = () => {
    const novos = resultado.itens.filter((i) => marcados[i.produtoId]);
    const mapa = new Map(carrinho.map((c) => [c.produto.id, c]));
    for (const i of novos) {
      const atual = mapa.get(i.produtoId);
      mapa.set(i.produtoId, atual ? { ...atual, quantidade: atual.quantidade + i.quantidade } : { produto: i.produto, quantidade: i.quantidade, precoUnitario: null });
    }
    carregar([...mapa.values()]);
    toast({ titulo: `${novos.length} item(ns) adicionados pela IA`, descricao: "Confira quantidades e preços antes de salvar." });
    setResultado(null);
    setTexto("");
    onAdicionado?.();
  };

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
        <Sparkles className="h-4 w-4" /> Montar com IA
      </p>
      <p className="mb-2 text-xs text-muted-foreground">Cole a mensagem do cliente (ex.: “quero 5 pacotes de bolinha 32mm e 300 pokémon 1 pol”) e a IA encontra os produtos no catálogo.</p>
      <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui o pedido do cliente..." />
      <Button className="mt-2" variant="secondary" loading={carregando} disabled={texto.trim().length < 3} onClick={interpretar}>
        <Sparkles className="h-4 w-4" /> {carregando ? "Interpretando..." : "Montar itens"}
      </Button>
      {resultado && (
        <div className="mt-3 space-y-2">
          {resultado.itens.map((i) => (
            <div key={i.produtoId} className="flex items-center gap-3 rounded-md bg-white p-2">
              <Checkbox checked={marcados[i.produtoId]} onChange={(v) => setMarcados({ ...marcados, [i.produtoId]: v })} />
              {i.produto.imagemUrl && <img src={i.produto.imagemUrl} alt="" className="h-10 w-10 rounded object-cover" />}
              <span className="min-w-0 flex-1 text-sm">
                <strong>{i.quantidade}×</strong> {i.produto.nome}
                <span className="block text-xs text-muted-foreground">
                  {i.produto.unidadesPacote} un/pct · {moedaUnitaria(i.produto.precoVenda)}/un · “{i.trecho}”
                </span>
              </span>
              {!i.produto.disponivel && <Badge variant="warning">Sem estoque</Badge>}
            </div>
          ))}
          {resultado.naoEncontrados.length > 0 && (
            <p className="flex items-start gap-1 text-xs text-red-700">
              <X className="mt-0.5 h-3 w-3" /> Não encontrado no catálogo: {resultado.naoEncontrados.join(", ")}
            </p>
          )}
          {resultado.observacao && <p className="text-xs text-violet-900">IA: {resultado.observacao}</p>}
          {resultado.itens.length > 0 && (
            <Button onClick={adicionar}>
              <Plus className="h-4 w-4" /> Adicionar selecionados
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
