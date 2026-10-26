import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Boxes, History, PackageX, Pencil, Plus, Search, TriangleAlert, Upload, Download, Eye, EyeOff } from "lucide-react";
import api, { enviarArquivo, mensagemErro } from "../services/api";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Field,
  FiltroMulti,
  Input,
  MetricCard,
  PageHeader,
  Paginacao,
  Popover,
  RowMenu,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  cx,
  useConfirm,
  useToast,
} from "../components/ui";
import { comprimirImagem, dataHora, exportarCsv, lerNumero, moeda, moedaUnitaria, numero, percentual } from "../utils/format";
import { TIPOS_EMBALAGEM } from "../utils/status";

const STATUS = { EM_ESTOQUE: "Em estoque", ESTOQUE_BAIXO: "Estoque baixo", SEM_ESTOQUE: "Sem estoque" };
const corStatus = { EM_ESTOQUE: "success", ESTOQUE_BAIXO: "warning", SEM_ESTOQUE: "danger" };

// Carrossel do produto: envia várias imagens direto pelo site (o backend
// salva no Cloudinary), reordena e remove. A primeira é a capa.
function GaleriaImagens({ imagens, onChange, desabilitado }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(0);
  const atual = useRef(imagens);
  useEffect(() => {
    atual.current = imagens;
  }, [imagens]);

  const enviar = async (arquivos) => {
    const lista = [...(arquivos || [])].filter((a) => a.type.startsWith("image/"));
    if (!lista.length) return;
    setEnviando(lista.length);
    for (const arquivo of lista) {
      try {
        const url = await enviarArquivo(await comprimirImagem(arquivo), "produtos");
        onChange([...atual.current, url]);
      } catch (error) {
        toast({ titulo: `Erro ao enviar ${arquivo.name}`, descricao: mensagemErro(error), tipo: "erro" });
      } finally {
        setEnviando((n) => n - 1);
      }
    }
  };
  const moverPara = (de, para) => {
    if (de === para || de == null || para == null) return;
    const nova = [...imagens];
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    onChange(nova);
  };
  const mover = (i, delta) => moverPara(i, i + delta);
  // Arrastar uma imagem sobre outra muda a ordem (as setas seguem valendo no celular).
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const soltar = () => {
    moverPara(arrastando, sobre);
    setArrastando(null);
    setSobre(null);
  };

  return (
    <div>
      <p className="label">Imagens do produto (carrossel)</p>
      <p className="mb-2 text-xs text-muted-foreground">A primeira imagem é a capa no catálogo. Arraste as imagens para mudar a ordem (ou use as setas). Para adicionar, arraste várias de uma vez para o quadro tracejado.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {imagens.map((url, i) => (
          <div
            key={url}
            draggable={!desabilitado}
            onDragStart={(e) => {
              setArrastando(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragEnter={() => arrastando != null && setSobre(i)}
            onDragOver={(e) => arrastando != null && e.preventDefault()}
            onDrop={(e) => {
              if (arrastando == null) return;
              e.preventDefault();
              soltar();
            }}
            onDragEnd={() => {
              setArrastando(null);
              setSobre(null);
            }}
            title="Arraste para mudar a ordem"
            className={cx(
              "group relative cursor-grab overflow-hidden rounded-lg border border-border bg-muted transition active:cursor-grabbing",
              arrastando === i && "opacity-40",
              sobre === i && arrastando !== i && "ring-2 ring-primary ring-offset-2",
            )}
          >
            <img src={url} alt="" draggable={false} className="pointer-events-none aspect-square w-full object-cover select-none" />
            {i === 0 && <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">Capa</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 text-white">
              <button type="button" className="rounded px-1.5 hover:bg-white/20 disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Mover para a esquerda">
                ‹
              </button>
              <button type="button" className="rounded px-1.5 text-xs hover:bg-white/20" onClick={() => onChange(imagens.filter((_, j) => j !== i))}>
                Remover
              </button>
              <button type="button" className="rounded px-1.5 hover:bg-white/20 disabled:opacity-30" disabled={i === imagens.length - 1} onClick={() => mover(i, 1)} aria-label="Mover para a direita">
                ›
              </button>
            </div>
          </div>
        ))}
        <label
          className={cx(
            "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border p-2 text-center text-xs text-muted-foreground hover:border-primary",
            desabilitado && "pointer-events-none opacity-50",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            enviar(e.dataTransfer.files);
          }}
        >
          <Upload className="h-6 w-6" />
          {enviando ? `Enviando ${enviando}...` : "Adicionar imagens"}
          <span>PNG, JPG ou WEBP</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
        </label>
      </div>
    </div>
  );
}

function UploadImagem({ label, valor, onChange, desabilitado }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      onChange(await enviarArquivo(await comprimirImagem(arquivo)));
    } catch (error) {
      toast({ titulo: "Erro ao enviar imagem", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Field label={label}>
      <label
        className={cx("flex h-40 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-dashed border-border text-center text-xs text-muted-foreground hover:border-primary", desabilitado && "pointer-events-none opacity-50")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          enviar(e.dataTransfer.files?.[0]);
        }}
      >
        {valor ? <img src={valor} alt="" className="h-28 object-contain" /> : <Upload className="h-6 w-6" />}
        {enviando ? "Enviando..." : valor ? "Clique ou arraste para substituir" : "Clique para enviar ou arraste uma imagem"}
        <span>PNG, JPG ou WEBP — comprimida automaticamente</span>
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

function ProdutoForm({ produtoId, categorias, onFechar, onSalvo }) {
  const toast = useToast();
  const [p, setP] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [componentesBusca, setComponentesBusca] = useState("");
  const [componentesOpcoes, setComponentesOpcoes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const novo = !produtoId;

  useEffect(() => {
    api.get("/parceiros", { params: { ativos: "true" } }).then(({ data }) => setFornecedores(data));
    if (novo) {
      setP({ tipo: "SIMPLES", modoVenda: "PADRAO", precoVenda: "", custo: "", unidadesPacote: 1, pesoPacoteGramas: "", estoque: 0, estoqueMinimo: "", tipoEmbalagem: "", componentes: [], destaque: false, imagens: [] });
    } else {
      api.get(`/produtos/${produtoId}`).then(({ data }) =>
        setP({ ...data, imagens: data.imagens?.length ? data.imagens : data.imagemUrl ? [data.imagemUrl] : [], precoVenda: String(data.precoVenda).replace(".", ","), custo: data.custo != null ? String(data.custo).replace(".", ",") : "", estoqueMinimo: data.estoqueMinimo ?? "", tipoEmbalagem: data.tipoEmbalagem || "" }),
      );
    }
  }, [produtoId, novo]);

  useEffect(() => {
    if (componentesBusca.length < 2) return setComponentesOpcoes([]);
    const t = setTimeout(() => api.get("/produtos/busca", { params: { busca: componentesBusca } }).then(({ data }) => setComponentesOpcoes(data)), 300);
    return () => clearTimeout(t);
  }, [componentesBusca]);

  if (!p) {
    return (
      <Dialog aberto onFechar={onFechar} titulo="Carregando produto..." tamanho="xl">
        <Skeleton className="h-96" />
      </Dialog>
    );
  }
  const set = (campo) => (e) => setP({ ...p, [campo]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });
  const venda = lerNumero(p.precoVenda);
  const custo = p.custo === "" ? null : lerNumero(p.custo);
  const margem = custo != null ? venda - custo : null;
  const unidades = Number(p.unidadesPacote) || 1;

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = { ...p, precoVenda: venda, custo, componentes: p.tipo === "COMPOSTO" ? p.componentes : [] };
      if (novo) await api.post("/produtos", corpo);
      else await api.put(`/produtos/${produtoId}`, corpo);
      toast({ titulo: novo ? "Produto criado" : "Produto atualizado" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao salvar produto", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="xl"
      titulo={novo ? "Adicionar Novo Produto" : `Editando: ${p.nome}`}
      descricao={novo ? "As imagens serão automaticamente salvas no banco de dados após o upload" : "Revise os dados comerciais e operacionais deste produto."}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} onClick={salvar}>
            {novo ? "Salvar Produto" : "Salvar Alterações"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Venda por unidade</p>
            <p className="text-lg font-bold">{moedaUnitaria(venda)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Custo por unidade</p>
            <p className="text-lg font-bold">{custo != null ? moedaUnitaria(custo) : "Sem custo definido"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Margem por unidade</p>
            <p className="text-lg font-bold">{margem != null ? moedaUnitaria(margem) : "pendente"}</p>
            {margem != null && venda > 0 && <p className="text-xs text-muted-foreground">{percentual((margem / venda) * 100)}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Status</p>
            <Badge variant={custo == null ? "warning" : "success"}>{custo == null ? "Custo pendente" : "Em dia"}</Badge>
          </div>
          {unidades > 1 && (
            <p className="text-xs text-muted-foreground sm:col-span-4">
              Referência do pacote ({unidades} un.): venda {moeda(venda * unidades)} • custo {custo != null ? moeda(custo * unidades) : "-"} • margem {margem != null ? moeda(margem * unidades) : "-"}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-3 font-semibold">Informações do Produto</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de Produto">
              <Segmented value={p.tipo} onChange={set("tipo")} opcoes={[{ value: "SIMPLES", label: "Simples" }, { value: "COMPOSTO", label: "Composto" }]} />
            </Field>
            <Field label="Modo de Venda" dica="Produtos por encomenda aparecem na fila operacional quando estiverem sem estoque">
              <Segmented value={p.modoVenda} onChange={set("modoVenda")} opcoes={[{ value: "PADRAO", label: "Padrão" }, { value: "ENCOMENDA", label: "Por encomenda" }]} />
            </Field>
            <Field label="SKU" obrigatorio>
              <Input value={p.sku || ""} onChange={set("sku")} />
            </Field>
            <Field label="Nome do Item" obrigatorio>
              <Input value={p.nome || ""} onChange={set("nome")} />
            </Field>
            <Field label="Categoria do Item" obrigatorio>
              <Input list="categorias-produto" value={p.categoria || ""} onChange={set("categoria")} placeholder="Selecione ou digite uma categoria" />
              <datalist id="categorias-produto">
                {categorias.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </Field>
            <Field label="Destaque no catálogo">
              <Checkbox checked={p.destaque} onChange={set("destaque")} label='Selo "Mais vendido"' descricao="Aparece primeiro no catálogo." />
            </Field>
            <Field label="Descrição do Item" obrigatorio className="sm:col-span-2">
              <Textarea value={p.descricao || ""} onChange={set("descricao")} />
            </Field>
            <Field label="Vídeo demonstrativo (link do YouTube)" dica="Aparece no fim dos detalhes do produto no catálogo." className="sm:col-span-2">
              <Input value={p.videoUrl || ""} onChange={set("videoUrl")} placeholder="https://www.youtube.com/watch?v=..." />
            </Field>
          </div>
          {p.tipo === "COMPOSTO" && (
            <div className="mt-4 rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium">Componentes (por unidade do kit)</p>
              {p.componentes.map((c, i) => (
                <div key={c.produtoId} className="mb-2 flex items-center gap-2 text-sm">
                  <span className="flex-1">{c.nome}</span>
                  <Input className="h-8 w-20" value={c.quantidade} onChange={(e) => setP({ ...p, componentes: p.componentes.map((x, j) => (j === i ? { ...x, quantidade: Number(e.target.value) || 1 } : x)) })} />
                  <Button variant="ghost" size="sm" onClick={() => setP({ ...p, componentes: p.componentes.filter((_, j) => j !== i) })}>
                    Remover
                  </Button>
                </div>
              ))}
              <div className="relative">
                <Input placeholder="Adicionar componente..." value={componentesBusca} onChange={(e) => setComponentesBusca(e.target.value)} />
                {componentesOpcoes.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-white shadow">
                    {componentesOpcoes.map((o) => (
                      <button
                        key={o.id}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setP({ ...p, componentes: [...p.componentes, { produtoId: o.id, nome: o.nome, quantidade: 1 }] });
                          setComponentesBusca("");
                        }}
                      >
                        {o.nome} · SKU {o.sku}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 font-semibold">Comercial e Estoque</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor de venda (R$)" obrigatorio dica="Preço por unidade">
              <Input value={p.precoVenda} onChange={set("precoVenda")} placeholder="0,00" />
            </Field>
            <Field label="Unidades no Pacote" obrigatorio>
              <Input value={p.unidadesPacote} onChange={set("unidadesPacote")} />
            </Field>
            {novo ? (
              <Field label="Estoque" obrigatorio dica="Em unidades">
                <Input value={p.estoque} onChange={set("estoque")} />
              </Field>
            ) : (
              <div>
                <p className="label">Estoque atual</p>
                <p className="text-lg font-bold">{numero(p.estoque)} un.</p>
                <p className="text-xs text-muted-foreground">Ajuste pela lista de produtos</p>
              </div>
            )}
            <Field label="Alerta de Estoque Baixo" dica="Alerta quando o estoque ficar abaixo deste valor">
              <Input value={p.estoqueMinimo} onChange={set("estoqueMinimo")} />
            </Field>
            <Field label="Peso do Pacote (gramas)" obrigatorio dica={p.pesoPacoteGramas ? `Equivalente: ${numero(lerNumero(p.pesoPacoteGramas) / 1000, 2)} kg` : undefined}>
              <Input value={p.pesoPacoteGramas} onChange={set("pesoPacoteGramas")} />
            </Field>
            <Field label="Tipo de Empacotamento (Frete)" dica="Usado no cálculo de frete">
              <Select value={p.tipoEmbalagem} onChange={set("tipoEmbalagem")}>
                {Object.entries(TIPOS_EMBALAGEM).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-semibold">Compra e fornecedor</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor de custo (R$)" dica="Atualizado automaticamente pelos recebimentos do fornecedor">
              <Input value={p.custo} onChange={set("custo")} placeholder="Sem custo definido" />
            </Field>
            <Field label="Fornecedor Preferencial">
              <Select value={p.fornecedorPreferencialId || ""} onChange={set("fornecedorPreferencialId")}>
                <option value="">Sem fornecedor preferencial</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações de Compra" className="sm:col-span-2">
              <Textarea value={p.observacoesCompra || ""} onChange={set("observacoesCompra")} />
            </Field>
          </div>
          {!novo && (
            <div className="mt-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Histórico de Preços</p>
              <p className="text-xs text-muted-foreground">Últimas alterações de custo e valor de venda deste produto.</p>
              {p.historicoRecente?.length ? (
                p.historicoRecente.map((h) => (
                  <p key={h.id} className="mt-1 text-xs">
                    {dataHora(h.createdAt)} · {h.campo === "CUSTO" ? "Custo" : "Venda"}: {h.valorAnterior != null ? moedaUnitaria(h.valorAnterior) : "-"} → {moedaUnitaria(h.valorNovo)} ({h.origem === "RECEBIMENTO" ? "recebimento" : h.usuarioNome})
                  </p>
                ))
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma alteração registrada para este produto.</p>
              )}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 font-semibold">Imagens</h3>
          <GaleriaImagens imagens={p.imagens || []} onChange={(imagens) => setP({ ...p, imagens })} desabilitado={!p.sku} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <UploadImagem label="Imagem fora de Estoque (opcional)" valor={p.imagemSemEstoqueUrl} onChange={set("imagemSemEstoqueUrl")} desabilitado={!p.sku} />
          </div>
          {!p.sku && <p className="mt-1 text-xs text-muted-foreground">Preencha o SKU primeiro para habilitar o upload de imagem</p>}
        </section>
      </div>
    </Dialog>
  );
}

// Estoque editável direto na tabela: clica, digita e Enter (sem explicação).
function EstoqueEditavel({ produto, onSalvo }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    const nova = Number(valor);
    if (valor === "" || nova === produto.estoque) return setEditando(false);
    setSalvando(true);
    try {
      await api.post(`/produtos/${produto.id}/estoque`, { quantidade: nova });
      toast({ titulo: "Estoque ajustado", descricao: `${produto.nome}: ${numero(nova)} un. (já vale no catálogo)` });
      setEditando(false);
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao ajustar estoque", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  if (!editando) {
    return (
      <button
        type="button"
        title="Clique para ajustar o estoque"
        className="rounded px-2 py-1 font-medium hover:bg-primary-soft hover:text-primary"
        onClick={() => {
          setValor(String(produto.estoque));
          setEditando(true);
        }}
      >
        {numero(produto.estoque)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      inputMode="numeric"
      disabled={salvando}
      className="input h-8 w-24 text-center"
      value={valor}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditando(false);
      }}
    />
  );
}

function AjustarEstoque({ produto, onFechar, onSalvo }) {
  const toast = useToast();
  const [quantidade, setQuantidade] = useState(String(produto.estoque));
  const erro = !/^\d+$/.test(quantidade) ? "Quantidade deve ser um número válido" : "";
  const salvar = async () => {
    try {
      await api.post(`/produtos/${produto.id}/estoque`, { quantidade: Number(quantidade) });
      toast({ titulo: "Estoque ajustado" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao ajustar estoque", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Ajustar Estoque · ${produto.nome}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={Boolean(erro)} onClick={salvar}>
            Confirmar Ajuste
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm">
          Quantidade Atual: <strong>{numero(produto.estoque)} un.</strong>
        </p>
        <Field label="Nova Quantidade" obrigatorio>
          <Input
            autoFocus
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && !erro && salvar()}
            placeholder="Digite a nova quantidade"
          />
        </Field>
        <p className="text-xs text-muted-foreground">O catálogo passa a mostrar a nova quantidade na hora.</p>
      </div>
    </Dialog>
  );
}

function HistoricoPrecos({ produto, onFechar }) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    api.get(`/produtos/${produto.id}/historico-precos`).then(({ data }) => setLista(data));
  }, [produto.id]);
  return (
    <Dialog aberto onFechar={onFechar} tamanho="lg" titulo={`Histórico de preços · ${produto.nome}`}>
      {!lista && <Skeleton className="h-32" />}
      {lista?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração registrada para este produto.</p>}
      <table className="w-full text-sm">
        <tbody>
          {lista?.map((h) => (
            <tr key={h.id} className="border-b border-border/60">
              <td className="py-2">{dataHora(h.createdAt)}</td>
              <td>
                <Badge variant={h.campo === "CUSTO" ? "info" : "primary"}>{h.campo === "CUSTO" ? "Custo" : "Venda"}</Badge>
              </td>
              <td>
                {h.valorAnterior != null ? moedaUnitaria(h.valorAnterior) : "-"} → <strong>{moedaUnitaria(h.valorNovo)}</strong>
              </td>
              <td className="text-xs text-muted-foreground">{h.origem === "RECEBIMENTO" ? "Recebimento" : "Edição"} · {h.usuarioNome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

const COLUNAS_CSV = ["sku", "nome", "descricao", "categoria", "precoVenda", "custo", "unidadesPacote", "pesoPacoteGramas", "estoque", "estoqueMinimo", "tipoEmbalagem"];

function lerCsv(texto) {
  const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = linhas[0].includes(";") ? ";" : ",";
  const dividir = (l) => {
    const out = [];
    let atual = "";
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) {
        out.push(atual);
        atual = "";
      } else atual += ch;
    }
    out.push(atual);
    return out.map((v) => v.trim());
  };
  const cab = dividir(linhas[0]);
  return linhas.slice(1).map((l) => Object.fromEntries(dividir(l).map((v, i) => [cab[i], v])));
}

function GerenciarProdutos({ categorias }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [f, setF] = useState({ tipo: [], venda: [], categoria: [], status: [] });
  const [arquivados, setArquivados] = useState(false);
  const [maisVendido, setMaisVendido] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(30);
  const [dados, setDados] = useState(null);
  const [editar, setEditar] = useState(undefined);
  const [ajustar, setAjustar] = useState(null);
  const [historico, setHistorico] = useState(null);
  const inputCsv = useRef(null);

  const carregar = useCallback(() => {
    api
      .get("/produtos", {
        params: {
          busca: buscaAplicada || undefined,
          tipo: f.tipo.join(",") || undefined,
          venda: f.venda.join(",") || undefined,
          categoria: f.categoria.join(",") || undefined,
          status: f.status.join(",") || undefined,
          arquivados: arquivados ? "true" : undefined,
          destaque: maisVendido ? "true" : undefined,
          pagina,
          limite,
        },
      })
      .then(({ data }) => setDados(data));
  }, [buscaAplicada, f, arquivados, maisVendido, pagina, limite]);
  useEffect(carregar, [carregar]);
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const arquivar = async (p) => {
    const ok = await confirmar({ titulo: p.arquivado ? "Restaurar produto?" : "Arquivar produto?", mensagem: p.arquivado ? "O produto volta para o catálogo." : "O produto deixa de aparecer no catálogo, mas continua no histórico.", perigo: !p.arquivado });
    if (!ok) return;
    try {
      await api.put(`/produtos/${p.id}/arquivar`, { arquivado: !p.arquivado });
      toast({ titulo: p.arquivado ? "Produto restaurado" : "Produto arquivado" });
      carregar();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const importar = async (arquivo) => {
    if (!arquivo) return;
    try {
      const linhas = lerCsv(await arquivo.text());
      const { data } = await api.post("/produtos/importar", { linhas });
      toast({ titulo: "Importação concluída", descricao: `${data.criados} criados, ${data.atualizados} atualizados${data.erros.length ? `, ${data.erros.length} com erro (linha ${data.erros[0].linha}: ${data.erros[0].erro})` : ""}`, tipo: data.erros.length ? "aviso" : "sucesso" });
      carregar();
    } catch (error) {
      toast({ titulo: "Erro ao importar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      inputCsv.current.value = "";
    }
  };

  const set = (k) => (v) => {
    setF({ ...f, [k]: v });
    setPagina(1);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard titulo="Total de Produtos" valor={dados?.resumo.total ?? "..."} icone={Boxes} />
        <MetricCard titulo="Estoque Baixo" valor={dados?.resumo.estoqueBaixo ?? "..."} icone={TriangleAlert} destaque="text-amber-500" />
        <MetricCard titulo="Sem Estoque" valor={dados?.resumo.semEstoque ?? "..."} icone={PackageX} destaque="text-red-500" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Buscar por nome, SKU ou categoria..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <FiltroMulti titulo="Tipo" opcoes={{ SIMPLES: "SIMPLES", COMPOSTO: "COMPOSTO" }} valores={f.tipo} onChange={set("tipo")} />
        <FiltroMulti titulo="Venda" opcoes={{ PADRAO: "Padrão", ENCOMENDA: "Por encomenda" }} valores={f.venda} onChange={set("venda")} />
        <FiltroMulti titulo="Categoria" opcoes={Object.fromEntries(categorias.map((c) => [c.nome, c.nome]))} valores={f.categoria} onChange={set("categoria")} />
        <FiltroMulti titulo="Status" opcoes={STATUS} valores={f.status} onChange={set("status")} />
        <Checkbox className="ml-1" checked={maisVendido} onChange={setMaisVendido} label="Mais vendido" />
        <Checkbox className="ml-1" checked={arquivados} onChange={setArquivados} label="Arquivados" />
        <div className="ml-auto flex gap-2">
          <Popover
            alinhamento="end"
            gatilho={
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4" /> Importar
              </Button>
            }
          >
            {(fechar) => (
              <div className="flex w-48 flex-col">
                <button
                  className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    fechar();
                    exportarCsv("modelo-produtos", COLUNAS_CSV.map((c) => ({ titulo: c, valor: (l) => l[c] })), [{ sku: "12345", nome: "Exemplo", descricao: "Descrição", categoria: "Bolinha 32mm", precoVenda: "0,61", custo: "0,48", unidadesPacote: 100, pesoPacoteGramas: 2000, estoque: 1000, estoqueMinimo: 200, tipoEmbalagem: "ball_32mm" }]);
                  }}
                >
                  <Download className="mr-2 inline h-4 w-4" /> Baixar Modelo
                </button>
                <button
                  className="rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    fechar();
                    inputCsv.current.click();
                  }}
                >
                  <Upload className="mr-2 inline h-4 w-4" /> Importar CSV
                </button>
              </div>
            )}
          </Popover>
          <input ref={inputCsv} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => importar(e.target.files?.[0])} />
          <Button size="sm" onClick={() => setEditar(null)}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            {["SKU", "Nome", "Tipo", "Categoria", "Preço de venda", "Custo", "Margem", "Estoque", "Status", "Ações"].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!dados && (
            <tr>
              <td colSpan={10} className="p-3">
                <Skeleton className="h-40" />
              </td>
            </tr>
          )}
          {dados?.itens.map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <Td className="font-mono text-xs">{p.sku}</Td>
              <Td className="text-left">
                <span className="flex items-center gap-2">
                  {p.imagemUrl && <img src={p.imagemUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                  <span>
                    {p.nome}
                    {p.destaque && <Badge variant="success" className="ml-1">Mais vendido</Badge>}
                  </span>
                </span>
              </Td>
              <Td>
                <Badge variant="outline">{p.tipo}</Badge>
                {p.modoVenda === "ENCOMENDA" && <Badge variant="info" className="mt-1">Encomenda</Badge>}
              </Td>
              <Td className="text-xs">{p.categoria}</Td>
              <Td>{moedaUnitaria(p.precoVenda)}</Td>
              <Td>{p.custo != null ? moedaUnitaria(p.custo) : <span className="text-xs text-amber-600">Sem custo</span>}</Td>
              <Td>
                {p.margemValor != null ? (
                  <>
                    {moedaUnitaria(p.margemValor)}
                    <span className="block text-xs text-muted-foreground">{percentual(p.margemPercentual)}</span>
                  </>
                ) : (
                  "-"
                )}
              </Td>
              <Td>
                <EstoqueEditavel produto={p} onSalvo={carregar} />
              </Td>
              <Td>
                <Badge variant={corStatus[p.statusEstoque]}>{STATUS[p.statusEstoque]}</Badge>
              </Td>
              <Td>
                <RowMenu
                  itens={[
                    { label: "Editar", icone: Pencil, onClick: () => setEditar(p.id) },
                    { label: "Ajustar Estoque", icone: Boxes, onClick: () => setAjustar(p) },
                    { label: "Histórico de preços", icone: History, onClick: () => setHistorico(p) },
                    { label: p.arquivado ? "Restaurar" : "Arquivar", icone: p.arquivado ? ArchiveRestore : Archive, perigo: !p.arquivado, onClick: () => arquivar(p) },
                  ]}
                />
              </Td>
            </tr>
          ))}
          {dados && !dados.itens.length && (
            <tr>
              <td colSpan={10} className="py-10 text-center text-muted-foreground">
                Nenhum produto encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} onChange={setPagina} limite={limite} onLimite={setLimite} />}
      {editar !== undefined && (
        <ProdutoForm
          produtoId={editar}
          categorias={categorias}
          onFechar={() => setEditar(undefined)}
          onSalvo={() => {
            setEditar(undefined);
            carregar();
          }}
        />
      )}
      {ajustar && (
        <AjustarEstoque
          produto={ajustar}
          onFechar={() => setAjustar(null)}
          onSalvo={() => {
            setAjustar(null);
            carregar();
          }}
        />
      )}
      {historico && <HistoricoPrecos produto={historico} onFechar={() => setHistorico(null)} />}
    </div>
  );
}

function Categorias({ categorias, recarregar }) {
  const toast = useToast();
  const [nova, setNova] = useState("");
  const [renomear, setRenomear] = useState(null);
  const salvar = async (id, corpo, msg) => {
    try {
      if (id) await api.put(`/produtos/categorias/${id}`, corpo);
      else await api.post("/produtos/categorias", corpo);
      toast({ titulo: msg });
      recarregar();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Categorias no Catálogo</h2>
      <p className="mb-4 text-sm text-muted-foreground">Oculte ou exiba categorias inteiras no catálogo público. Produtos individuais arquivados continuam ocultos independentemente.</p>
      <div className="mb-4 flex gap-2">
        <Input className="max-w-xs" placeholder="Nova categoria" value={nova} onChange={(e) => setNova(e.target.value)} />
        <Button
          disabled={!nova.trim()}
          onClick={() => {
            salvar(null, { nome: nova.trim() }, "Categoria criada");
            setNova("");
          }}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      <div className="divide-y divide-border">
        {categorias.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            {renomear?.id === c.id ? (
              <span className="flex gap-2">
                <Input className="h-8" value={renomear.nome} onChange={(e) => setRenomear({ ...renomear, nome: e.target.value })} />
                <Button
                  size="sm"
                  onClick={() => {
                    salvar(c.id, { nome: renomear.nome }, "Categoria renomeada");
                    setRenomear(null);
                  }}
                >
                  Salvar
                </Button>
              </span>
            ) : (
              <span>
                <span className="font-medium">{c.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.totalProdutos} {c.totalProdutos === 1 ? "produto" : "produtos"}
                </span>
              </span>
            )}
            <span className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setRenomear({ id: c.id, nome: c.nome })}>
                <Pencil className="h-4 w-4" />
              </Button>
              {c.visivel ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={c.visivel} onChange={(v) => salvar(c.id, { visivel: v }, v ? "Categoria visível no catálogo" : "Categoria oculta do catálogo")} />
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Produtos() {
  const [aba, setAba] = useState("produtos");
  const [categorias, setCategorias] = useState([]);
  const carregarCategorias = () => api.get("/produtos/categorias").then(({ data }) => setCategorias(data));
  useEffect(() => {
    carregarCategorias();
  }, []);
  return (
    <div className="container-app py-6">
      <PageHeader titulo="Gerenciamento de Produtos" subtitulo="Adicione, edite ou arquive produtos do catálogo" />
      <Tabs className="mb-4" abas={[{ value: "produtos", label: "Gerenciar Produtos" }, { value: "categorias", label: "Categorias" }]} ativa={aba} onChange={setAba} />
      {aba === "produtos" ? <GerenciarProdutos categorias={categorias} /> : <Categorias categorias={categorias} recarregar={carregarCategorias} />}
    </div>
  );
}
