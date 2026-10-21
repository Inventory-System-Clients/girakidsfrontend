import { useState } from "react";
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

// Ranking de produtos: mostra todos e permite filtrar Top 10 / Top 3 / O mais.
// O gráfico mostra até 10 barras da seleção; a tabela, a lista inteira.
export default function RankingProdutos({ titulo, descricao, dados, chave, cor, colunas, formatoGrafico, vazio = "Sem dados no período." }) {
  const [top, setTop] = useState(0);
  const lista = top ? dados.slice(0, top) : dados;
  const barras = lista.slice(0, MAX_BARRAS);

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
                <Tooltip formatter={(v) => (formatoGrafico ? formatoGrafico(v) : numero(v, chave === "margemPercentual" ? 2 : 0))} />
                <Bar dataKey={chave} fill={cor} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lista.length > MAX_BARRAS && <p className="text-center text-[11px] text-muted-foreground">Gráfico mostra os {MAX_BARRAS} primeiros; a tabela abaixo traz todos.</p>}
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Produto</th>
                  {colunas.map(([c]) => (
                    <th key={c} className="px-3 py-2 text-right">
                      {c}
                    </th>
                  ))}
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
