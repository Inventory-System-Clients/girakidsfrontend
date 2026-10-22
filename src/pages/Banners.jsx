import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, Upload } from "lucide-react";
import api, { enviarArquivo, mensagemErro } from "../services/api";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Switch, useConfirm, useToast } from "../components/ui";
import { comprimirImagem } from "../utils/format";
import { definirLayoutBanner, useLayoutBanner } from "../components/BannerCarrossel";

function UploadArte({ label, dica, valor, onChange }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      onChange(await enviarArquivo(await comprimirImagem(arquivo, 2400, 0.88), "produtos"));
    } catch (error) {
      toast({ titulo: "Erro ao enviar imagem", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Field label={label} dica={dica}>
      <label
        className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-border p-2 text-center text-xs text-muted-foreground hover:border-primary"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          enviar(e.dataTransfer.files?.[0]);
        }}
      >
        {valor ? <img src={valor} alt="" className="max-h-40 rounded object-contain" /> : <Upload className="h-6 w-6" />}
        {enviando ? "Enviando..." : valor ? "Clique ou arraste para trocar" : "Clique ou arraste a arte do banner"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
      </label>
      {valor && (
        <button type="button" className="mt-1 text-xs text-red-600" onClick={() => onChange("")}>
          Remover
        </button>
      )}
    </Field>
  );
}

function BannerForm({ banner, categorias, onFechar, onSalvo }) {
  const toast = useToast();
  const destinoInicial = banner?.produtoId ? "produto" : banner?.categoria ? "categoria" : banner?.busca ? "busca" : "nenhum";
  const [b, setB] = useState({ textoBotao: "Ver coleção", ativo: true, ...banner, destino: destinoInicial });
  const [produtos, setProdutos] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const faixa = useLayoutBanner() === "FAIXA";
  const set = (c) => (e) => setB({ ...b, [c]: e?.target ? e.target.value : e });

  useEffect(() => {
    if (b.destino !== "produto" || buscaProduto.length < 2) return undefined;
    const t = setTimeout(() => api.get("/produtos/busca", { params: { busca: buscaProduto } }).then(({ data }) => setProdutos(data)), 250);
    return () => clearTimeout(t);
  }, [buscaProduto, b.destino]);

  const salvar = async () => {
    setSalvando(true);
    try {
      if (banner?.id) await api.put(`/banners/${banner.id}`, b);
      else await api.post("/banners", b);
      toast({ titulo: banner?.id ? "Banner atualizado" : "Banner criado" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao salvar banner", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={banner?.id ? "Editar banner" : "Novo banner"}
      descricao="Use uma arte pronta. Clicar no banner leva ao destino escolhido abaixo."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={!b.imagemUrl} onClick={salvar}>
            Salvar banner
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <UploadArte label="Arte (computador)" dica={faixa ? "Faixa no topo: 2400 × 400 px (proporção 6:1)" : "Proporção 3:1, ex.: 1800 × 600 px"} valor={b.imagemUrl} onChange={set("imagemUrl")} />
          <UploadArte label="Arte para celular (opcional)" dica={faixa ? "Faixa no celular: 1200 × 430 px (proporção 2,8:1)" : "Proporção 16:9, ex.: 1200 × 675 px"} valor={b.imagemMobileUrl} onChange={set("imagemMobileUrl")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descrição da imagem (acessibilidade)">
            <Input value={b.alt || ""} onChange={set("alt")} placeholder="Ex.: Lançamento Pokémon 2 polegadas" />
          </Field>
          <Field label="Ao clicar no banner, leva para">
            <Select value={b.destino} onChange={set("destino")}>
              <option value="nenhum">Nada (só imagem)</option>
              <option value="categoria">Uma categoria</option>
              <option value="busca">Uma busca por texto</option>
              <option value="produto">Um produto</option>
            </Select>
          </Field>
          {b.destino === "categoria" && (
            <Field label="Categoria">
              <Select value={b.categoria || ""} onChange={set("categoria")}>
                <option value="">Selecione</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {b.destino === "busca" && (
            <Field label="Texto da busca" dica="Ex.: pokemon — mostra todos os produtos com esse termo">
              <Input value={b.busca || ""} onChange={set("busca")} />
            </Field>
          )}
          {b.destino === "produto" && (
            <Field label="Produto" dica={b.produtoNome || (b.produtoId ? "Produto selecionado" : "Busque pelo nome ou SKU")}>
              <div className="relative">
                <Input value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} placeholder="Buscar produto..." />
                {produtos.length > 0 && buscaProduto && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg">
                    {produtos.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setB({ ...b, produtoId: p.id, produtoNome: p.nome });
                          setBuscaProduto("");
                          setProdutos([]);
                        }}
                      >
                        {p.nome} <span className="text-xs text-muted-foreground">· SKU {p.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          )}
        </div>
        <Switch label="Ativo no catálogo" checked={b.ativo} onChange={set("ativo")} />
      </div>
    </Dialog>
  );
}

export default function Banners() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [banners, setBanners] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState(undefined);
  const layout = useLayoutBanner();

  const trocarLayout = async (faixa) => {
    const anterior = layout;
    definirLayoutBanner(faixa ? "FAIXA" : "CLASSICO");
    try {
      await api.put("/config/banner-layout", { bannerLayout: faixa ? "FAIXA" : "CLASSICO" });
      toast({ titulo: faixa ? "Banner em faixa no topo do catálogo" : "Banner voltou para o formato anterior" });
    } catch (error) {
      definirLayoutBanner(anterior);
      toast({ titulo: "Erro ao trocar o formato", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const carregar = () => api.get("/banners/todos").then(({ data }) => setBanners(data));
  useEffect(() => {
    carregar();
    api.get("/produtos/categorias").then(({ data }) => setCategorias(data)).catch(() => {});
  }, []);

  const mover = async (i, d) => {
    const lista = [...banners];
    [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
    setBanners(lista);
    try {
      const { data } = await api.put("/banners/ordem", { ids: lista.map((b) => b.id) });
      setBanners(data);
    } catch (error) {
      toast({ titulo: "Erro ao reordenar", descricao: mensagemErro(error), tipo: "erro" });
      carregar();
    }
  };

  const alternar = async (b) => {
    const { data } = await api.put(`/banners/${b.id}`, { ativo: !b.ativo });
    setBanners((l) => l.map((x) => (x.id === b.id ? data : x)));
  };

  const excluir = async (b) => {
    const ok = await confirmar({ titulo: "Excluir banner?", mensagem: "Ele sai do catálogo imediatamente.", perigo: true, confirmar: "Excluir" });
    if (!ok) return;
    await api.delete(`/banners/${b.id}`);
    toast({ titulo: "Banner excluído" });
    carregar();
  };

  const destino = (b) => (b.produtoId ? "Produto" : b.categoria ? `Categoria: ${b.categoria}` : b.busca ? `Busca: "${b.busca}"` : "Sem destino");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader titulo="Banners do catálogo" subtitulo="Destaques no topo do catálogo: trocam sozinhos; clicar no banner leva a uma categoria, busca ou produto.">
        <Button onClick={() => setForm(null)}>
          <Plus className="h-4 w-4" /> Novo banner
        </Button>
      </PageHeader>
      <Card className="mb-4 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Banner em faixa no topo</p>
          <p className="text-sm text-muted-foreground">
            Ligado: o banner ocupa a largura toda no lugar de “Catálogo Digital” e desliza sozinho. Desligado: volta ao cartão acima dos produtos.
          </p>
        </div>
        <Switch checked={layout === "FAIXA"} disabled={!layout} onChange={trocarLayout} />
      </Card>
      {!banners && <Skeleton className="h-48" />}
      {banners?.length === 0 && (
        <Card>
          <EmptyState icon={ImagePlus} titulo="Nenhum banner cadastrado" descricao="Crie o primeiro destaque do catálogo.">
            <Button className="mt-3" onClick={() => setForm(null)}>
              Novo banner
            </Button>
          </EmptyState>
        </Card>
      )}
      <div className="space-y-3">
        {banners?.map((b, i) => (
          <Card key={b.id} className={`flex flex-col gap-4 p-3 sm:flex-row sm:items-center ${b.ativo ? "" : "opacity-60"}`}>
            <img src={b.imagemUrl} alt={b.alt || ""} className="aspect-[3/1] w-full rounded-lg object-cover sm:w-72" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.alt || "Banner sem descrição"}</p>
              <p className="text-sm text-muted-foreground">
                Ao clicar → {destino(b)}
              </p>
              <div className="mt-1 flex gap-2">
                <Badge variant={b.ativo ? "success" : "default"}>{b.ativo ? "Ativo" : "Desativado"}</Badge>
                {b.imagemMobileUrl && <Badge variant="info">Arte de celular</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled={i === banners.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Switch checked={b.ativo} onChange={() => alternar(b)} />
              <Button variant="ghost" size="icon" onClick={() => setForm(b)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => excluir(b)} aria-label="Excluir">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {form !== undefined && (
        <BannerForm
          banner={form}
          categorias={categorias}
          onFechar={() => setForm(undefined)}
          onSalvo={() => {
            setForm(undefined);
            carregar();
          }}
        />
      )}
    </div>
  );
}
