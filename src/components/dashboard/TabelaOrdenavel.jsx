import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

// Tabela pequena com linha de total e ordenação ao clicar no título.
// colunas: { titulo, valor(linha) para ordenar, render(linha), total(linhas), alinhar, quebrar }.
// Sem nenhuma coluna com total, não mostra a linha de total.
// Sem ordenação escolhida, mantém a ordem recebida (ex.: segunda a domingo).
export default function TabelaOrdenavel({ linhas, colunas, chave, maxAltura }) {
  const [ordem, setOrdem] = useState({ coluna: null, desc: true });

  const ordenadas = useMemo(() => {
    const col = colunas.find((c) => c.titulo === ordem.coluna);
    if (!col) return linhas;
    return [...linhas].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      const r = typeof va === "string" ? va.localeCompare(vb, "pt-BR") : (va ?? -Infinity) - (vb ?? -Infinity);
      return ordem.desc ? -r : r;
    });
  }, [linhas, colunas, ordem]);

  const ordenar = (titulo) =>
    setOrdem((o) => (o.coluna === titulo ? (o.desc ? { coluna: titulo, desc: false } : { coluna: null, desc: true }) : { coluna: titulo, desc: true }));

  return (
    <div className={`overflow-auto rounded-lg border border-border ${maxAltura || ""}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-muted-foreground uppercase">
          <tr>
            {colunas.map((c) => {
              const ativo = ordem.coluna === c.titulo;
              const Icone = ativo ? (ordem.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
              return (
                <th key={c.titulo} className={`px-3 py-2 ${c.alinhar || "text-right"}`}>
                  <button
                    type="button"
                    onClick={() => ordenar(c.titulo)}
                    title="Clique para ordenar (2º clique inverte, 3º volta ao normal)"
                    className={`inline-flex items-center gap-1 uppercase hover:text-foreground ${ativo ? "text-foreground" : ""}`}
                  >
                    {c.titulo}
                    <Icone className={`h-3 w-3 ${ativo ? "" : "opacity-40"}`} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l) => (
            <tr key={l[chave]} className="border-t border-border">
              {colunas.map((c) => (
                <td key={c.titulo} className={`px-3 py-2 ${c.quebrar ? "" : "whitespace-nowrap"} ${c.alinhar || "text-right"}`}>
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {colunas.some((c) => c.total) && (
          <tfoot className="bg-slate-50 font-semibold">
            <tr className="border-t-2 border-border">
              {colunas.map((c) => (
                <td key={c.titulo} className={`px-3 py-2 whitespace-nowrap ${c.alinhar || "text-right"}`}>
                  {c.total ? c.total(linhas) : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
