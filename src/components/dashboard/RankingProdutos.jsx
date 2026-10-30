import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Segmented } from "../ui";
import { numero } from "../../utils/format";

export const FILTROS_TOP = [
  { value: 0, label: "Todos" },
  { value: 10, label: "Top 10" },
  { value: 3, label: "Top 3" },
  { value: 1, label: "O mais" },
];

const MAX_BARRAS = 10;

const soma = (lista, campo) => lista.reduce((t, x) => t + (Number(x[campo]) || 0), 0);

// Total de uma coluna: soma o campo; a margem é a do conjunto (lucro / receita).
const totalColuna = (lista, campo, formatar) => {
  if (!campo) return "";
  if (campo === "margemPercentual") {
    const comLucro = lista.filter((x) => x.lucro != null);
    const receita = soma(comLucro, "receita");
    if (!receita) return "";
    return formatar({ margemPercentual: (soma(comLucro, "lucro") / receita) * 100 });
  }
  return formatar({ [campo]: soma(lista, campo) });
};

// Ranking de produtos: mostra todos e permite filtrar Top 10 / Top 3 / O mais.
// O gráfico mostra até 10 barras da seleção; a tabela, a lista inteira.
// colunas: [título, formatar(item), campo] — com campo, o título ordena a
// lista (clique de novo inverte) e o rodapé traz o total da coluna.
export default function RankingProdutos({ titulo, descricao, dados, chave, cor, colunas, formatoGrafico, vazio = "Sem dados no período." }) {
  const [top, setTop] = useState(0);
  const [ordem, setOrdem] = useState({ campo: null, desc: true });

  const ordenados = useMemo(() => {
    if (!ordem.campo) return dados;
    const valor = (x) => (ordem.campo === "nome" ? String(x.nome || "") : Number(x[ordem.campo]) || 0);
    return [...dados].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const r = typeof va === "string" ? va.localeCompare(vb, "pt-BR") : va - vb;
      return ordem.desc ? -r : r;
    });
  }, [dados, ordem]);

  const lista = top ? ordenados.slice(0, top) : ordenados;
  const barras = lista.slice(0, MAX_BARRAS);
  // O gráfico acompanha a coluna escolhida para ordenar.
  const colunaGrafico = colunas.find(([, , campo]) => campo && campo === ordem.campo);
  const campoGrafico = colunaGrafico ? ordem.campo : chave;
  const formatarGrafico = (v, _n, item) =>
    colunaGrafico ? colunaGrafico[1](item.payload) : formatoGrafico ? formatoGrafico(v) : numero(v, chave === "margemPercentual" ? 2 : 0);

  const ordenar = (campo) =>
    setOrdem((o) => (o.campo === campo ? { campo, desc: !o.desc } : { campo, desc: campo !== "nome" }));

  const cabecalho = (rotulo, campo, alinhar) => {
    if (!campo) return <th key={rotulo} className={`px-3 py-2 ${alinhar}`}>{rotulo}</th>;
    const ativo = ordem.campo === campo;
    const Icone = ativo ? (ordem.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
    return (
      <th key={rotulo} className={`px-3 py-2 ${alinhar}`}>
        <button
          type="button"
          onClick={() => ordenar(campo)}
          title="Clique para ordenar (de novo inverte)"
          className={`inline-flex items-center gap-1 uppercase hover:text-foreground ${ativo ? "text-foreground" : ""}`}
        >
          {rotulo}
          <Icone className={`h-3 w-3 ${ativo ? "" : "opacity-40"}`} />
        </button>
      </th>
    );
  };

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{titulo}</p>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Segmented value={top} onChange={setTop} opcoes={FILTROS_TOP} />
      </div>
      {lista.length ? (
        <>
          <div style={{ height: Math.max(90, barras.length * 30 + 20) }}>
            <ResponsiveContainer>
              <BarChart data={barras} layout="vertical" margin={{ left: 10, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip formatter={formatarGrafico} />
                <Bar dataKey={campoGrafico} fill={cor} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lista.length > MAX_BARRAS && <p className="text-center text-[11px] text-muted-foreground">Gráfico mostra os {MAX_BARRAS} primeiros; a tabela abaixo traz todos.</p>}
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  {cabecalho("Produto", "nome", "text-left")}
                  {colunas.map(([c, , campo]) => cabecalho(c, campo, "text-right"))}
                </tr>
              </thead>
              <tbody>
                {lista.map((x, i) => (
                  <tr key={x.produtoId || x.nome} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">{x.nome}</td>
                    {colunas.map(([c, f]) => (
                      <td key={c} className="px-3 py-2 text-right whitespace-nowrap">
                        {f(x)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50 font-semibold">
                <tr className="border-t-2 border-border">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">Total ({lista.length})</td>
                  {colunas.map(([c, f, campo]) => (
                    <td key={c} className="px-3 py-2 text-right whitespace-nowrap">
                      {totalColuna(lista, campo, f)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{top ? `Mostrando ${lista.length} de ${dados.length}` : `${dados.length} produtos`}</p>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{vazio}</p>
      )}
    </Card>
  );
}
