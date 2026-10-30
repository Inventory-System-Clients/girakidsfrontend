import { useEffect, useMemo, useState } from "react";
import { Package, TrendingDown, TrendingUp } from "lucide-react";
import api from "../../services/api";
import { Card, Segmented, Skeleton, cx } from "../ui";
import TabelaOrdenavel from "./TabelaOrdenavel";
import { contemTexto, numero } from "../../utils/format";

const nomeMes = (chave) => new Date(`${chave}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
const duracao = (dias) => (dias == null ? "Sem vendas" : dias === 0 ? "Sem estoque" : dias >= 60 ? `~${Math.round(dias / 30)} meses` : `~${dias} dias`);
// Quanto falta para cobrir N dias no ritmo atual.
const sugestaoCompra = (l, dias) => Math.max(0, Math.ceil(l.ritmoDiario * dias - Math.max(0, l.estoque)));

// Barrinhas das vendas mês a mês (6 meses fechados).
function MiniBarras({ valores, meses, cor }) {
  const max = Math.max(...valores, 1);
  return (
    <div className="flex h-9 items-end justify-end gap-0.5">
      {valores.map((v, i) => (
        <div key={meses[i]} title={`${nomeMes(meses[i])}: ${numero(v)} un.`} className="flex w-3.5 flex-col items-center justify-end">
          <div className={cx("w-full rounded-sm", cor)} style={{ height: `${Math.max(2, (v / max) * 28)}px` }} />
          <span className="text-[8px] leading-tight text-muted-foreground">{nomeMes(meses[i]).slice(0, 1)}</span>
        </div>
      ))}
    </div>
  );
}

const colunaProduto = (corMotivo) => ({
  titulo: "Produto",
  alinhar: "text-left",
  quebrar: true,
  valor: (l) => l.nome,
  render: (l) => (
    <div className="flex min-w-[14rem] gap-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
        {l.imagemUrl ? <img src={l.imagemUrl} alt="" className="h-full w-full object-cover" /> : <Package className="m-auto mt-2.5 h-5 w-5 text-slate-300" />}
      </div>
      <div className="min-w-0">
        <p className="font-medium">{l.nome}</p>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {l.motivos.map((m) => (
            <span key={m} className={cx("rounded-full px-1.5 py-0.5 text-[10px] font-medium", corMotivo)}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  ),
});

const colunasComuns = (meses, cor) => [
  { titulo: "Vendas/mês", valor: (l) => l.mediaRecente, render: (l) => <MiniBarras valores={l.mensal} meses={meses} cor={cor} /> },
  {
    titulo: "Média",
    valor: (l) => l.variacao ?? Infinity,
    render: (l) => (
      <span className="text-xs">
        <span className="block font-semibold">{numero(l.mediaRecente)} un./mês</span>
        <span className="text-muted-foreground">antes {numero(l.mediaAnterior)}</span>
      </span>
    ),
  },
  { titulo: "Estoque", valor: (l) => l.estoque, render: (l) => `${numero(l.estoque)} un.` },
  {
    titulo: "Dura",
    valor: (l) => l.coberturaDias ?? Infinity,
    render: (l) => duracao(l.coberturaDias),
  },
  { titulo: "Zerou", valor: (l) => l.vezesZerou, render: (l) => (l.vezesZerou ? `${l.vezesZerou}x` : "—") },
];

// Produtos para repor com mais frequência (vendas subindo / estoque acabando
// rápido) e produtos com vendas caindo (dá para comprar menos).
export default function TendenciasEstoque() {
  const [d, setD] = useState(null);
  const [dias, setDias] = useState(60);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    api.get("/dashboard/tendencias").then(({ data }) => setD(data));
  }, []);

  const colunasSobe = useMemo(
    () =>
      d && [
        colunaProduto("bg-emerald-50 text-emerald-700"),
        ...colunasComuns(d.meses, "bg-emerald-500"),
        {
          titulo: `Comprar p/ ${dias} dias`,
          valor: (l) => sugestaoCompra(l, dias),
          render: (l) => {
            const n = sugestaoCompra(l, dias);
            return n ? <span className="font-semibold text-emerald-700">~{numero(n)} un.</span> : <span className="text-muted-foreground">Estoque cobre</span>;
          },
        },
      ],
    [d, dias],
  );

  const colunasCai = useMemo(
    () =>
      d && [
        colunaProduto("bg-amber-50 text-amber-800"),
        ...colunasComuns(d.meses, "bg-amber-500"),
        {
          titulo: "Próxima compra",
          valor: (l) => l.mediaRecente,
          render: (l) =>
            l.coberturaDias == null || l.coberturaDias >= 90 ? (
              <span className="font-semibold text-amber-800">Segurar compra</span>
            ) : (
              <span className="text-xs">
                <span className="block font-semibold text-amber-800">~{numero(l.mediaRecente)} un./mês</span>
                <span className="text-muted-foreground">em vez de {numero(l.mediaAnterior)}</span>
              </span>
            ),
        },
      ],
    [d],
  );

  if (!d) return <Skeleton className="h-64" />;
  const filtrar = (lista) => (busca ? lista.filter((l) => contemTexto(l.nome, busca) || contemTexto(l.sku || "", busca)) : lista);
  const subindo = filtrar(d.subindo);
  const caindo = filtrar(d.caindo);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tendência de vendas x estoque</h2>
          <p className="text-sm text-muted-foreground">
            Últimos 6 meses fechados ({nomeMes(d.meses[0])} a {nomeMes(d.meses[d.meses.length - 1])}), em unidades, comparando a média dos 3 meses mais recentes com a dos 3 anteriores. Não depende do período selecionado acima. Kits contam nos produtos que os formam; produtos que vendem menos de {d.minimoMensal} un./mês ficam de fora.
          </p>
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto ou SKU"
          className="h-9 w-56 rounded-md border border-border bg-white px-3 text-sm"
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <TrendingUp className="h-4 w-4" /> Repor com mais frequência ({subindo.length})
            </p>
            <p className="text-xs text-muted-foreground">
              Vendas subindo (+20% ou 3 meses seguidos em alta), estoque que zerou várias vezes ou que dura menos de 30 dias no ritmo atual. "Comprar" = o que falta para cobrir os dias escolhidos no ritmo atual (o maior entre os últimos 30 dias e a média dos 3 meses).
            </p>
          </div>
          <Segmented value={dias} onChange={setDias} opcoes={[30, 60, 90].map((n) => ({ value: n, label: `${n} dias` }))} />
        </div>
        {subindo.length ? (
          <TabelaOrdenavel linhas={subindo} colunas={colunasSobe} chave="produtoId" maxAltura="max-h-[32rem]" />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum produto com vendas subindo ou estoque acabando rápido.</p>
        )}
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-1.5 font-semibold text-amber-800">
          <TrendingDown className="h-4 w-4" /> Vendas caindo: dá para comprar menos ({caindo.length})
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Vendas caíram 25% ou mais, ou 3 meses seguidos em queda. Os primeiros da lista são os que têm mais estoque parado. "Segurar compra" quando o estoque atual cobre 3 meses ou mais.
        </p>
        {caindo.length ? (
          <TabelaOrdenavel linhas={caindo} colunas={colunasCai} chave="produtoId" maxAltura="max-h-[32rem]" />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum produto com vendas caindo.</p>
        )}
      </Card>
    </section>
  );
}
