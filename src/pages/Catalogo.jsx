import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link2, Maximize2, Package, PlayCircle, Search, ShoppingBag, Star, Minus, Plus, Settings2 } from "lucide-react";
import api from "../services/api";
import Carrossel from "../components/Carrossel";
import BannerCarrossel, { useLayoutBanner } from "../components/BannerCarrossel";
import { Visualizador } from "../components/pedido/Fotos";
import { useCart } from "../contexts/CartContext";
import { Badge, Button, Card, Dialog, Skeleton, cx, useToast } from "../components/ui";
import { moeda, moedaUnitaria } from "../utils/format";

const POR_PAGINA = 12;

// Sem estoque, a imagem "fora de estoque" (quando houver) vem primeiro.
// Esgotado sem arte própria de esgotado (ou com a mesma do estoque): foto em
// preto e branco.
const pretoEBranco = (p) => !p.disponivel && !p.temImagemEsgotado;

const imagensDoProduto = (p) => {
  const imagens = p.imagens?.length ? p.imagens : [p.imagemUrl].filter(Boolean);
  return p.imagemUrl && p.imagemUrl !== imagens[0] ? [p.imagemUrl, ...imagens] : imagens;
};

function Quantidade({ produto }) {
  const { quantidadeDe, definirQuantidade } = useCart();
  const q = quantidadeDe(produto.id);
  return (
    <div className="mx-auto flex w-full max-w-40 items-center justify-between rounded-full border border-border bg-white px-1 py-1" onClick={(e) => e.stopPropagation()}>
      <button className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={!q} onClick={() => definirQuantidade(produto, q - 1)} aria-label="Diminuir">
        <Minus className="h-4 w-4" />
      </button>
      <input
        className="w-12 border-0 bg-transparent text-center text-sm font-semibold outline-none"
        inputMode="numeric"
        value={q}
        onChange={(e) => definirQuantidade(produto, e.target.value.replace(/\D/g, ""))}
        aria-label="Quantidade"
      />
      <button className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={!produto.disponivel} onClick={() => definirQuantidade(produto, q + 1)} aria-label="Aumentar">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function CardProduto({ produto, onAbrir }) {
  return (
    <Card className="group flex cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md" onClick={onAbrir}>
      <div className="relative aspect-square bg-gradient-to-b from-slate-100 to-slate-200">
        <Carrossel compacto imagens={imagensDoProduto(produto)} alt={produto.nome} className="absolute inset-0" pretoBranco={pretoEBranco(produto)} />
        {produto.destaque && (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <Star className="h-3 w-3 fill-white" /> Mais vendido
          </span>
        )}
        {!produto.disponivel && (
          <span className="absolute top-2 left-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white">Esgotado</span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center gap-1 px-3 pt-3 pb-4 text-center">
        <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{produto.categoria}</p>
        <p className="line-clamp-2 font-semibold">{produto.nome}</p>
        {produto.descricao && <p className="line-clamp-3 text-xs text-muted-foreground">{produto.descricao}</p>}
        <div className="mt-auto pt-3">
          <p className="text-lg font-bold text-primary">{moedaUnitaria(produto.precoVenda)}</p>
          {produto.unidadesPacote > 1 && (
            <Badge variant="info" className="mt-1">
              <Package className="h-3 w-3" /> {produto.unidadesPacote} un/pacote
            </Badge>
          )}
        </div>
        <div className="mt-3 w-full">
          <Quantidade produto={produto} />
        </div>
      </div>
    </Card>
  );
}

export default function Catalogo() {
  const [dados, setDados] = useState(null);
  const [categoria, setCategoria] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState(null);
  const [ampliada, setAmpliada] = useState(null);
  const layoutBanner = useLayoutBanner();
  const { produtoId } = useParams();
  const toast = useToast();

  // Link do produto (/produto/:id) abre o catálogo já com o item ampliado.
  useEffect(() => {
    if (!produtoId) return;
    api
      .get(`/catalogo/produtos/${produtoId}`)
      .then(({ data }) => setDetalhe(data))
      .catch(() => toast({ titulo: "Produto não encontrado", descricao: "Ele pode ter sido removido do catálogo.", tipo: "aviso" }));
  }, [produtoId, toast]);

  const abrirDetalhe = (p) => {
    setDetalhe(p);
    window.history.replaceState(window.history.state, "", `/produto/${p.id}`);
  };
  const fecharDetalhe = () => {
    setDetalhe(null);
    setAmpliada(null);
    if (window.location.pathname.startsWith("/produto/")) window.history.replaceState(window.history.state, "", "/");
  };
  const linkProduto = (p) => `${window.location.origin}/produto/${p.id}`;
  const copiarLink = async (p) => {
    try {
      await navigator.clipboard.writeText(linkProduto(p));
      toast({ titulo: "Link copiado", descricao: "Quem abrir o link verá este produto ampliado." });
    } catch {
      window.prompt("Copie o link do produto:", linkProduto(p));
    }
  };
  const abrirBanner = (b) => {
    if (b.produtoId) {
      api.get(`/catalogo/produtos/${b.produtoId}`).then(({ data }) => abrirDetalhe(data)).catch(() => {});
    } else if (b.categoria) {
      setCategoria(b.categoria);
      setBusca("");
      setPagina(1);
    } else if (b.busca) {
      setBusca(b.busca);
      setCategoria("");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let ativo = true;
    api
      .get("/catalogo", { params: { categoria: categoria || undefined, busca: buscaAplicada || undefined, pagina, limite: POR_PAGINA } })
      .then(({ data }) => ativo && setDados(data))
      .catch(() => ativo && setDados({ produtos: [], categorias: [], total: 0, paginas: 1, totalGeral: 0 }));
    return () => {
      ativo = false;
    };
  }, [categoria, buscaAplicada, pagina]);

  const tituloCatalogo = (
    <section className="border-b border-border bg-gradient-to-r from-sky-50 via-white to-rose-50 py-8 text-center">
      <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
        <ShoppingBag className="h-7 w-7 text-primary" /> Catálogo Digital
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Encontre facilmente o que procura</p>
    </section>
  );

  // Estoque em tempo real: recarrega em silêncio a cada 20 s e ao voltar para a aba.
  useEffect(() => {
    const recarregar = () => {
      if (document.visibilityState !== "visible") return;
      api
        .get("/catalogo", { params: { categoria: categoria || undefined, busca: buscaAplicada || undefined, pagina, limite: POR_PAGINA } })
        .then(({ data }) => setDados(data))
        .catch(() => {});
    };
    const t = setInterval(recarregar, 20000);
    document.addEventListener("visibilitychange", recarregar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", recarregar);
    };
  }, [categoria, buscaAplicada, pagina]);

  const paginas = dados?.paginas || 1;
  const numerosPagina = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])].filter((n) => n >= 1 && n <= paginas).sort((a, b) => a - b);

  return (
    <div className="toy-pattern-bg min-h-[calc(100dvh-4rem)]">
      {layoutBanner === "FAIXA" ? <BannerCarrossel variante="faixa" onAbrir={abrirBanner} vazio={tituloCatalogo} /> : layoutBanner && tituloCatalogo}

      <div className="container-app grid grid-cols-1 gap-6 py-8 lg:grid-cols-[17rem_1fr] 2xl:grid-cols-[19rem_1fr]">
        <aside>
          <Card className="p-4 lg:sticky lg:top-20">
            <p className="mb-3 flex items-center gap-2 font-semibold">
              <Settings2 className="h-4 w-4 text-primary" /> Categorias
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {[{ nome: "", rotulo: "Todos", total: dados?.totalGeral }, ...(dados?.categorias || []).map((c) => ({ ...c, rotulo: c.nome }))].map((c) => (
                <button
                  key={c.rotulo}
                  onClick={() => {
                    setCategoria(c.nome);
                    setPagina(1);
                  }}
                  className={cx(
                    "flex shrink-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                    categoria === c.nome ? "gradient-primary border-transparent text-white shadow" : "border-border bg-white hover:border-primary/40",
                  )}
                >
                  <span className="truncate">{c.rotulo}</span>
                  <span className={cx("rounded-full px-2 text-xs", categoria === c.nome ? "bg-white/25" : "bg-muted text-muted-foreground")}>{c.total ?? ""}</span>
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <main>
          <div className="relative mb-4">
            <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <input className="input h-11 bg-white pl-10 shadow-sm" placeholder="Buscar por nome, categoria, descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {layoutBanner === "CLASSICO" && !categoria && !buscaAplicada && <BannerCarrossel onAbrir={abrirBanner} />}
          <Card className="mb-4 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{dados?.total ?? "..."}</span> produtos encontrados
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
            {!dados && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/5]" />)}
            {dados?.produtos.map((p) => (
              <CardProduto key={p.id} produto={p} onAbrir={() => abrirDetalhe(p)} />
            ))}
          </div>
          {dados && !dados.produtos.length && <p className="py-16 text-center text-muted-foreground">Nenhum produto encontrado.</p>}

          {paginas > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm">
              <button className="rounded-md px-3 py-2 hover:bg-white disabled:opacity-40" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
                ‹ Anterior
              </button>
              {numerosPagina.map((n, i) => (
                <span key={n} className="flex items-center">
                  {i > 0 && n - numerosPagina[i - 1] > 1 && <span className="px-2">…</span>}
                  <button onClick={() => setPagina(n)} className={cx("h-9 min-w-9 rounded-md px-2", n === pagina ? "border border-border bg-white font-semibold shadow-sm" : "hover:bg-white")}>
                    {n}
                  </button>
                </span>
              ))}
              <button className="rounded-md px-3 py-2 hover:bg-white disabled:opacity-40" disabled={pagina === paginas} onClick={() => setPagina(pagina + 1)}>
                Próximo ›
              </button>
            </nav>
          )}
        </main>
      </div>

      <Dialog aberto={Boolean(detalhe)} onFechar={fecharDetalhe} titulo={detalhe?.nome} descricao={detalhe?.categoria} tamanho="lg">
        {detalhe && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Carrossel imagens={imagensDoProduto(detalhe)} alt={detalhe.nome} className="aspect-square rounded-lg" onAmpliar={setAmpliada} pretoBranco={pretoEBranco(detalhe)} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setAmpliada(0)} disabled={!imagensDoProduto(detalhe).length}>
                  <Maximize2 className="h-4 w-4" /> Ampliar
                </Button>
                <Button variant="outline" size="sm" onClick={() => copiarLink(detalhe)}>
                  <Link2 className="h-4 w-4" /> Copiar link do produto
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">SKU {detalhe.sku}</p>
              <p className="text-lg font-semibold leading-tight">{detalhe.nome}</p>
              <p className="text-2xl font-bold text-primary">{moedaUnitaria(detalhe.precoVenda)}</p>
              {detalhe.unidadesPacote > 1 && (
                <p className="text-sm text-muted-foreground">
                  Pacote com {detalhe.unidadesPacote} un. — {moeda(detalhe.precoVenda * detalhe.unidadesPacote)} por pacote
                </p>
              )}
              {!detalhe.disponivel && <Badge variant="warning">Sem estoque no momento</Badge>}
              {detalhe.modoVenda === "ENCOMENDA" && <Badge variant="info">Por encomenda</Badge>}
              {detalhe.descricao && (
                <div className="mt-2 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</p>
                  <p className="whitespace-pre-line text-sm">{detalhe.descricao}</p>
                </div>
              )}
              <div className="mt-auto space-y-3 pt-4">
                {detalhe.videoUrl && (
                  <a
                    href={detalhe.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    <PlayCircle className="h-5 w-5" /> Ver vídeo demonstrativo no YouTube
                  </a>
                )}
                <Quantidade produto={detalhe} />
              </div>
            </div>
          </div>
        )}
      </Dialog>
      {detalhe && ampliada != null && <Visualizador fotos={imagensDoProduto(detalhe)} inicial={ampliada} onFechar={() => setAmpliada(null)} pretoBranco={pretoEBranco(detalhe)} />}
    </div>
  );
}
