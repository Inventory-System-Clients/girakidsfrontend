import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Crown, Package, Percent, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import api from "../../services/api";
import { Badge, Card, Segmented, Skeleton, cx } from "../ui";
import RankingProdutos from "./RankingProdutos";
import { contemTexto, moeda, moedaUnitaria, numero, percentual } from "../../utils/format";

const AZUL = "#2563eb";
const VERDE = "#0f766e";
const ROXO = "#7c3aed";

function Destaque({ titulo, icone: Icone, produto, valor, detalhe, cor }) {
  return (
    <Card className="flex gap-3 p-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {produto?.imagemUrl ? <img src={produto.imagemUrl} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto mt-4 h-8 w-8 text-slate-300" />}
      </div>
      <div className="min-w-0">
        <p className={cx("flex items-center gap-1 text-xs font-semibold tracking-wide uppercase", cor)}>
          <Icone className="h-3.5 w-3.5" /> {titulo}
        </p>
        <p className="truncate font-semibold">{produto?.nome || "—"}</p>
        {produto && (
          <>
            <p className="text-lg font-bold">{valor}</p>
            <p className="text-xs text-muted-foreground">{detalhe}</p>
          </>
        )}
      </div>
    </Card>
  );
}

function ListaVermelho({ titulo, descricao, itens, render, vazio }) {
  return (
    <div className="rounded-lg border border-red-200 bg-white">
      <div className="border-b border-red-100 px-4 py-3">
        <p className="font-semibold text-red-700">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      {itens.length ? (
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {itens.map((x) => (
            <div key={x.produtoId} className="flex items-center gap-3 px-4 py-2 text-sm">
              {x.imagemUrl ? <img src={x.imagemUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 rounded bg-muted" />}
              <span className="min-w-0 flex-1 truncate">{x.nome}</span>
              {render(x)}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-emerald-700">{vazio}</p>
      )}
    </div>
  );
}

const STATUS = {
  EM_ESTOQUE: ["Em estoque", "success"],
  ESTOQUE_BAIXO: ["Estoque baixo", "warning"],
  SEM_ESTOQUE: ["Sem estoque", "danger"],
};

function ProdutosAtivos() {
  const [d, setD] = useState(null);
  const [categoria, setCategoria] = useState("");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("nome");

  useEffect(() => {
    api.get("/dashboard/produtos-ativos").then(({ data }) => setD(data));
  }, []);

  const lista = useMemo(() => {
    if (!d) return [];
    const termo = busca.trim();
    return d.produtos
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) => !termo || contemTexto(p.nome, termo) || contemTexto(p.sku, termo))
      .sort((a, b) => (ordem === "estoque" ? b.estoque - a.estoque : ordem === "menor" ? a.estoque - b.estoque : a.nome.localeCompare(b.nome, "pt-BR")));
  }, [d, categoria, busca, ordem]);

  if (!d) return <Skeleton className="h-64" />;
  const cat = d.categorias.find((c) => c.nome === categoria);
  const totalUnidades = lista.reduce((s, p) => s + Math.max(0, p.estoque), 0);
  const valorTotal = lista.reduce((s, p) => s + p.valorEmEstoque, 0);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <Boxes className="h-4 w-4 text-primary" /> Produtos ativos e estoque
          </p>
          <p className="text-sm text-muted-foreground">
            {d.totalProdutos} produtos ativos em {d.categorias.length} categorias. Selecione uma categoria para ver os produtos e o estoque de cada um.
          </p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoria("")}
          className={cx("rounded-full border px-3 py-1.5 text-sm", !categoria ? "gradient-primary border-transparent text-white" : "border-border bg-white hover:border-primary/40")}
        >
          Todas <span className="ml-1 opacity-75">{d.totalProdutos}</span>
        </button>
        {d.categorias.map((c) => (
          <button
            key={c.nome}
            type="button"
            onClick={() => setCategoria(c.nome)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-sm",
              categoria === c.nome ? "gradient-primary border-transparent text-white" : "border-border bg-white hover:border-primary/40",
              !c.visivel && categoria !== c.nome && "opacity-60",
            )}
            title={c.visivel ? undefined : "Categoria oculta no catálogo"}
          >
            {c.nome} <span className="ml-1 opacity-75">{c.produtos}</span>
            {c.semEstoque > 0 && <span className={cx("ml-1 rounded-full px-1.5 text-[10px]", categoria === c.nome ? "bg-white/25" : "bg-red-100 text-red-700")}>{c.semEstoque} sem estoque</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{categoria || "Todas as categorias"}</p>
          <p className="text-xl font-bold">
            {lista.length} {lista.length === 1 ? "produto" : "produtos"}
          </p>
          {cat && !cat.visivel && <Badge variant="warning">Oculta no catálogo</Badge>}
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">Estoque total</p>
          <p className="text-xl font-bold">{numero(totalUnidades)} un.</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">Valor em estoque (pelo custo)</p>
          <p className="text-xl font-bold">{moeda(valorTotal)}</p>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Buscar produto ou SKU..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Segmented
          value={ordem}
          onChange={setOrdem}
          opcoes={[
            { value: "nome", label: "A–Z" },
            { value: "estoque", label: "Mais estoque" },
            { value: "menor", label: "Menos estoque" },
          ]}
        />
      </div>
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Produto</th>
              {!categoria && <th className="px-3 py-2 text-left">Categoria</th>}
              <th className="px-3 py-2 text-right">Estoque (un.)</th>
              <th className="px-3 py-2 text-right">Pacotes</th>
              <th className="px-3 py-2 text-right">Alerta baixo</th>
              <th className="px-3 py-2 text-right">Preço/un.</th>
              <th className="px-3 py-2 text-right">Valor em estoque</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    {p.imagemUrl ? <img src={p.imagemUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <span className="h-9 w-9 rounded bg-muted" />}
                    <span>
                      <span className="block font-medium">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">SKU {p.sku}</span>
                    </span>
                  </span>
                </td>
                {!categoria && <td className="px-3 py-2 text-xs">{p.categoria}</td>}
                <td className={cx("px-3 py-2 text-right font-semibold", p.estoque <= 0 && "text-red-600")}>{numero(p.estoque)}</td>
                <td className="px-3 py-2 text-right">
                  {p.unidadesPacote > 1 ? (
                    <>
                      {numero(p.pacotes)} <span className="text-xs text-muted-foreground">× {p.unidadesPacote}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs">{p.estoqueMinimo ?? "Não definido"}</td>
                <td className="px-3 py-2 text-right">{moedaUnitaria(p.precoVenda)}</td>
                <td className="px-3 py-2 text-right">{p.custo != null ? moeda(p.valorEmEstoque) : <span className="text-xs text-amber-600">Sem custo</span>}</td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Aba "Análise" do Time Financeiro.
export default function Analise({ periodo }) {
  const [d, setD] = useState(null);
  const [ranking, setRanking] = useState("pacotes");

  useEffect(() => {
    setD(null);
    api.get("/dashboard/analise", { params: periodo }).then(({ data }) => setD(data));
  }, [periodo]);

  const ordenados = useMemo(() => {
    if (!d) return [];
    const base = ranking === "margemPercentual" ? d.vendas.filter((v) => v.custoCompleto && v.receita > 0) : d.vendas;
    return [...base].sort((a, b) => b[ranking] - a[ranking]);
  }, [d, ranking]);

  if (!d) return <Skeleton className="h-96" />;
  const { destaques: x, vermelho, totais } = d;
  const totalVermelho = vermelho.vendidosComPrejuizo.length + vermelho.precoAbaixoDoCusto.length;

  const CONFIG_RANKING = {
    pacotes: { titulo: "Mais vendidos", cor: AZUL, colunas: [["Qtd.", (v) => `${numero(v.pacotes)} emb.`, "pacotes"], ["Unidades", (v) => numero(v.unidades), "unidades"], ["Receita", (v) => moeda(v.receita), "receita"]] },
    receita: { titulo: "Maior receita", cor: ROXO, colunas: [["Receita", (v) => moeda(v.receita), "receita"], ["Qtd.", (v) => `${numero(v.pacotes)} emb.`, "pacotes"]], formato: moeda },
    margemPercentual: { titulo: "Maior margem", cor: VERDE, colunas: [["Margem", (v) => percentual(v.margemPercentual), "margemPercentual"], ["Receita", (v) => moeda(v.receita), "receita"], ["Lucro", (v) => moeda(v.lucro), "lucro"]] },
    lucro: { titulo: "Maior lucro", cor: VERDE, colunas: [["Lucro", (v) => moeda(v.lucro), "lucro"], ["Margem", (v) => percentual(v.margemPercentual), "margemPercentual"], ["Receita", (v) => moeda(v.receita), "receita"]], formato: moeda },
  };
  const cfg = CONFIG_RANKING[ranking];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Considera os {d.pedidos} pedidos expedidos do período selecionado. Receita {moeda(totais.receita)} · lucro dos itens {moeda(totais.lucro)} · {totais.produtosVendidos} produtos vendidos
        {totais.semCusto > 0 && ` · ${totais.semCusto} sem custo cadastrado (contam custo R$ 0,00)`}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Destaque titulo="Produto que mais vende" icone={Crown} cor="text-sky-700" produto={x.maisVendido} valor={x.maisVendido && `${numero(x.maisVendido.pacotes)} emb.`} detalhe={x.maisVendido && `${numero(x.maisVendido.unidades)} un. · ${moeda(x.maisVendido.receita)}`} />
        <Destaque titulo="Maior receita" icone={Wallet} cor="text-violet-700" produto={x.maiorReceita} valor={x.maiorReceita && moeda(x.maiorReceita.receita)} detalhe={x.maiorReceita && `${numero(x.maiorReceita.pacotes)} emb. vendidas`} />
        <Destaque titulo="Produto com mais margem" icone={Percent} cor="text-emerald-700" produto={x.maiorMargem} valor={x.maiorMargem && percentual(x.maiorMargem.margemPercentual)} detalhe={x.maiorMargem && `Lucro ${moeda(x.maiorMargem.lucro)}`} />
        <Destaque titulo="Maior lucro" icone={TrendingUp} cor="text-emerald-700" produto={x.maiorLucro} valor={x.maiorLucro && moeda(x.maiorLucro.lucro)} detalhe={x.maiorLucro && `Margem ${percentual(x.maiorLucro.margemPercentual)}`} />
      </div>

      <section className="rounded-xl border border-red-200 bg-red-50/40 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700">
          <TrendingDown className="h-5 w-5" /> Produtos fechando no vermelho {totalVermelho > 0 && <Badge variant="danger">{totalVermelho}</Badge>}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Produtos vendidos com prejuízo no período e produtos cadastrados com preço de venda abaixo do custo.</p>
        <div className="grid gap-4 lg:grid-cols-3">
          <ListaVermelho
            titulo="Vendidos com prejuízo"
            descricao="Receita menor que o custo dos itens no período."
            itens={vermelho.vendidosComPrejuizo}
            vazio="Nenhum produto vendido com prejuízo no período."
            render={(v) => <span className="text-right font-semibold text-red-700">{moeda(v.lucro)}</span>}
          />
          <ListaVermelho
            titulo="Preço abaixo do custo"
            descricao="Cadastro atual: cada venda dá prejuízo."
            itens={vermelho.precoAbaixoDoCusto}
            vazio="Nenhum produto com preço abaixo do custo."
            render={(v) => (
              <span className="text-right text-xs">
                <span className="block font-semibold text-red-700">{percentual(v.margemPercentual)}</span>
                {moedaUnitaria(v.precoVenda)} × custo {moedaUnitaria(v.custoAtual)}
              </span>
            )}
          />
          <ListaVermelho
            titulo={`Margem baixa (< ${vermelho.limiteMargemAtencao}%)`}
            descricao="Vendidos no período com margem apertada."
            itens={vermelho.margemBaixa}
            vazio="Nenhum produto com margem baixa."
            render={(v) => <span className="text-right font-semibold text-amber-700">{percentual(v.margemPercentual)}</span>}
          />
        </div>
        {totais.semCusto > 0 && (
          <p className="mt-3 flex items-center gap-1 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> {totais.semCusto} produtos vendidos não têm custo cadastrado — cadastre o custo em Gerenciar Produtos para a análise de margem ficar exata.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Ranking de produtos do período</h2>
          <Segmented
            value={ranking}
            onChange={setRanking}
            opcoes={[
              { value: "pacotes", label: "Mais vendidos" },
              { value: "receita", label: "Receita" },
              { value: "margemPercentual", label: "Margem" },
              { value: "lucro", label: "Lucro" },
            ]}
          />
        </div>
        <RankingProdutos
          key={ranking}
          titulo={cfg.titulo}
          descricao="Todos os produtos vendidos em pedidos expedidos no período."
          dados={ordenados}
          chave={ranking}
          cor={cfg.cor}
          colunas={cfg.colunas}
          formatoGrafico={cfg.formato}
        />
      </section>

      <ProdutosAtivos />
    </div>
  );
}
