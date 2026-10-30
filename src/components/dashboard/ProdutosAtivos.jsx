import { useEffect, useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import api from "../../services/api";
import { Badge, Card, Segmented, Skeleton, cx } from "../ui";
import { contemTexto, moeda, moedaUnitaria, numero } from "../../utils/format";

const STATUS = {
  EM_ESTOQUE: ["Em estoque", "success"],
  ESTOQUE_BAIXO: ["Estoque baixo", "warning"],
  SEM_ESTOQUE: ["Sem estoque", "danger"],
};

// Produtos ativos por categoria, com o estoque de cada um (aba Estoque).
export default function ProdutosAtivos() {
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
