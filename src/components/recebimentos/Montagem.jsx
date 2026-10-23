import { useState } from "react";
import { AlertTriangle, Boxes, Plus, Settings2, ShoppingCart, Trash2 } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Button, Card, Dialog, EmptyState, Field, Input, RowMenu, Segmented, Select, Switch, Table, Td, Th, cx, useConfirm, useToast } from "../ui";
import { dataHora, lerNumero } from "../../utils/format";
import { Miniatura, ProdutoBusca, SALDOS, atualizarAlertasRecebimentos, un } from "./comum";

// Como Field, mas sem <label>: dentro de um label o clique no resultado da
// busca vira clique no campo de texto.
const Bloco = ({ label, obrigatorio, dica, className, children }) => (
  <div className={className}>
    <span className="label">
      {label} {obrigatorio && <span className="text-primary">*</span>}
    </span>
    {children}
    {dica && <span className="mt-1 block text-xs text-muted-foreground">{dica}</span>}
  </div>
);

const Num = ({ v, cor, forte }) => <span className={cx(forte && "font-semibold", cor)}>{un(v)}</span>;

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

// Liga a montagem de um produto e define as cápsulas usadas por unidade.
export function ConfigMontagem({ produto, onFechar, onSalvo }) {
  const toast = useToast();
  const [alvo, setAlvo] = useState(produto || null);
  // Itens de cápsula: todos são necessários; dentro de um item, qualquer
  // opção serve (ex.: branca OU vermelha).
  const [grupos, setGrupos] = useState(() =>
    (produto?.capsulas || []).map((g) => ({ opcoes: (g.opcoes || [g]).map((o) => ({ produtoId: o.produtoId, nome: o.nome, quantidade: String(o.quantidade) })) })),
  );
  const usadas = grupos.flatMap((g) => g.opcoes.map((o) => o.produtoId));
  const setOpcao = (gi, oi, mudanca) => setGrupos((l) => l.map((g, j) => (j === gi ? { opcoes: g.opcoes.map((o, k) => (k === oi ? { ...o, ...mudanca } : o)) } : g)));
  const tirarOpcao = (gi, oi) =>
    setGrupos((l) => l.map((g, j) => (j === gi ? { opcoes: g.opcoes.filter((_, k) => k !== oi) } : g)).filter((g) => g.opcoes.length));
  const novaOpcao = (gi, p) => setGrupos((l) => l.map((g, j) => (j === gi ? { opcoes: [...g.opcoes, { produtoId: p.id, nome: p.nome, quantidade: "1" }] } : g)));
  const [solto, setSolto] = useState(produto?.produtoSolto || null);
  const [prioridade, setPrioridade] = useState(String(produto?.prioridadeMontagem ?? 0));
  const [salvando, setSalvando] = useState(false);

  const salvar = async (ligar = true) => {
    setSalvando(true);
    try {
      const { data } = await api.put(`/recebimentos/montagem/produtos/${alvo.id}`, {
        controlaMontagem: ligar,
        capsulas: grupos.map((g) => ({ opcoes: g.opcoes.map((o) => ({ produtoId: o.produtoId, quantidade: lerNumero(o.quantidade) || 1 })) })),
        produtoSoltoId: solto?.id || null,
        prioridadeMontagem: lerNumero(prioridade),
      });
      toast({ titulo: ligar ? "Montagem configurada" : "Montagem desligada", descricao: ligar ? "O estoque do catálogo deste produto agora segue os brinquedos e as cápsulas." : "O estoque voltou a ser só montado + em montagem." });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={produto ? `Montagem · ${produto.nome}` : "Configurar produto para montagem em cápsula"}
      descricao="Diga quais cápsulas cada unidade usa. Os brinquedos que chegarem sem cápsula só aparecem no catálogo enquanto houver cápsulas para montá-los."
      rodape={
        <>
          {produto && (
            <Button variant="danger-outline" className="mr-auto" loading={salvando} onClick={() => salvar(false)}>
              Desligar montagem
            </Button>
          )}
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={!alvo || !grupos.length} onClick={() => salvar(true)}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!produto && (
          <Bloco label="Produto montado (o que vai para o catálogo encapsulado)" obrigatorio>
            {alvo ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Miniatura src={alvo.imagemUrl} />
                <span className="flex-1 text-sm font-medium">{alvo.nome}</span>
                <Button size="sm" variant="ghost" onClick={() => setAlvo(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <ProdutoBusca onEscolher={setAlvo} autoFocus placeholder="Ex.: Pokemon 1 polegada" />
            )}
            {alvo && !alvo.controlaMontagem && <p className="mt-1 text-xs text-muted-foreground">O estoque atual ({un(alvo.estoque)}) passa a contar como "prontos (montados)".</p>}
          </Bloco>
        )}

        <div>
          <p className="text-sm font-medium">
            Cápsulas e sleeves por unidade <span className="text-primary">*</span>
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Cada item abaixo é obrigatório (<strong>e</strong>). Dentro de um item, as opções são alternativas (<strong>ou</strong>): ex.: Pokemon 1 pol = um item com "branca" ou "vermelha" — 2 mil
            brancas + 3 mil vermelhas montam 5 mil.
          </p>
          <div className="space-y-2">
            {grupos.map((g, gi) => (
              <div key={gi} className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Item {gi + 1}
                  {g.opcoes.length > 1 && " · qualquer uma das opções"}
                </p>
                <div className="space-y-1.5">
                  {g.opcoes.map((o, oi) => (
                    <div key={o.produtoId} className="flex items-center gap-2">
                      {oi > 0 && <span className="w-6 text-center text-xs font-bold text-blue-700">ou</span>}
                      {oi === 0 && g.opcoes.length > 1 && <span className="w-6" />}
                      <span className="flex-1 text-sm">{o.nome}</span>
                      <Input className="h-8 w-16 text-center" inputMode="numeric" value={o.quantidade} onChange={(e) => setOpcao(gi, oi, { quantidade: e.target.value.replace(/\D/g, "") })} />
                      <span className="text-xs text-muted-foreground">por un.</span>
                      <button type="button" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => tirarOpcao(gi, oi)} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <ProdutoBusca placeholder="+ alternativa (ou) — ex.: Cápsula 1 pol vermelha ou outro sleeve" excluir={[alvo?.id, ...usadas].filter(Boolean)} onEscolher={(p) => novaOpcao(gi, p)} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <ProdutoBusca
              placeholder={grupos.length ? "+ outra cápsula ou sleeve obrigatório (e)..." : "Adicionar cápsula ou sleeve (ex.: Cápsula 1 pol branca)..."}
              excluir={[alvo?.id, ...usadas].filter(Boolean)}
              onEscolher={(p) => setGrupos((l) => [...l, { opcoes: [{ produtoId: p.id, nome: p.nome, quantidade: "1" }] }])}
            />
            <p className="mt-1 text-xs text-muted-foreground">Ainda não cadastrou a cor? Use "Nova cápsula ou sleeve" na aba Cápsulas, sleeves e compras.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Bloco label="Brinquedos soltos vêm do produto (opcional)" dica='Ex.: "Pokemon sem Caps". Assim o brinquedo solto é o estoque desse produto e continua podendo ser vendido sem cápsula.'>
            {solto ? (
              <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                <span className="flex-1 text-sm">{solto.nome}</span>
                <Button size="sm" variant="ghost" onClick={() => setSolto(null)}>
                  Remover
                </Button>
              </div>
            ) : (
              <ProdutoBusca placeholder="Sem vínculo (controle interno)" excluir={[alvo?.id, ...usadas].filter(Boolean)} onEscolher={setSolto} />
            )}
          </Bloco>
          <Field label="Prioridade" dica="Quando as cápsulas não dão para todos, a maior prioridade monta primeiro.">
            <Input inputMode="numeric" value={prioridade} onChange={(e) => setPrioridade(e.target.value.replace(/[^\d-]/g, ""))} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function EnviarMontagem({ produto, onFechar, onSalvo }) {
  const toast = useToast();
  const capacidadeItem = (g) => g.opcoes.reduce((s, o) => s + Math.floor(Math.max(0, o.estoque) / o.quantidade), 0);
  const capacidade = Math.max(0, Math.min(produto.solto, ...produto.capsulas.map(capacidadeItem)));
  const [quantidade, setQuantidade] = useState(String(capacidade || ""));
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const q = lerNumero(quantidade);
  const enviar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.post(`/recebimentos/montagem/produtos/${produto.id}/enviar`, { quantidade: q, observacao });
      toast({ titulo: "Enviado para montagem", descricao: `${un(q)} un. de ${produto.nome}. As cápsulas foram separadas e não podem mais ser vendidas.` });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Não foi possível enviar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Enviar para montagem · ${produto.nome}`}
      descricao="Separa os brinquedos e as cápsulas para fechar. A partir daqui essas cápsulas saem do estoque de venda."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button variant="info" loading={salvando} disabled={!q || q > capacidade} onClick={enviar}>
            Enviar {q ? un(q) : ""} para montagem
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <span className="text-muted-foreground">Brinquedos sem cápsula</span>
          <span className="text-right font-semibold">{un(produto.solto)}</span>
          {produto.capsulas.map((g, i) => (
            <span key={i} className="contents">
              <span className="text-muted-foreground">{g.opcoes.map((o) => `${o.nome} (${un(o.estoque)})`).join(" ou ")}</span>
              <span className="text-right font-semibold">dá {un(capacidadeItem(g))}</span>
            </span>
          ))}
          <span className="font-medium">Dá para enviar agora</span>
          <span className="text-right font-bold text-blue-700">{un(capacidade)}</span>
        </div>
        <Field label="Quantidade para montar" erro={q > capacidade ? `Máximo ${un(capacidade)}` : undefined}>
          <Input inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
        <Field label="Observação (opcional)">
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: montadora Maria, retorno sexta" />
        </Field>
      </div>
    </Dialog>
  );
}

// Ajuste manual de saldo (montado, em montagem, sem cápsula ou estoque).
export function AjustarSaldo({ produto, saldos, onFechar, onSalvo }) {
  const toast = useToast();
  const chaves = Object.keys(saldos);
  const [saldo, setSaldo] = useState(chaves[0]);
  const [quantidade, setQuantidade] = useState(String(saldos[chaves[0]].atual));
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.post(`/recebimentos/montagem/produtos/${produto.id}/ajustar`, { saldo, quantidade: lerNumero(quantidade), motivo });
      toast({ titulo: "Saldo ajustado" });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Erro ao ajustar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Ajuste manual · ${produto.nome}`}
      descricao="Use para corrigir contagens. Fica registrado no histórico com o motivo."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={quantidade === ""} onClick={salvar}>
            Salvar ajuste
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {chaves.length > 1 && (
          <Field label="Saldo" className="sm:col-span-2">
            <Select
              value={saldo}
              onChange={(e) => {
                setSaldo(e.target.value);
                setQuantidade(String(saldos[e.target.value].atual));
              }}
            >
              {chaves.map((k) => (
                <option key={k} value={k}>
                  {saldos[k].label} (hoje: {un(saldos[k].atual)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Quantidade correta (unidades)">
          <Input inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
        <Field label="Observação (opcional)">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: contagem física de 21/10" />
        </Field>
      </div>
    </Dialog>
  );
}

function FecharOrdem({ ordem, acao, onFechar, onSalvo }) {
  const toast = useToast();
  const aberto = ordem.quantidade - ordem.quantidadeConcluida - ordem.quantidadeCancelada;
  const [quantidade, setQuantidade] = useState(String(aberto));
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const q = lerNumero(quantidade);
  const concluir = acao === "concluir";
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.post(`/recebimentos/montagem/ordens/${ordem.id}/${acao}`, { quantidade: q, motivo });
      toast({ titulo: concluir ? "Montagem concluída" : "Montagem cancelada", descricao: concluir ? `${un(q)} un. agora estão prontas.` : "Brinquedos e cápsulas voltaram a ficar livres." });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`${concluir ? "Concluir" : "Cancelar"} montagem · ${ordem.produtoNome}`}
      descricao={concluir ? "Informe quantas unidades voltaram montadas (pode ser parcial)." : "As unidades canceladas voltam para 'sem cápsula' e as cápsulas voltam ao estoque."}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Voltar
          </Button>
          <Button variant={concluir ? "success" : "danger"} loading={salvando} disabled={!q || q > aberto} onClick={salvar}>
            {concluir ? "Concluir" : "Cancelar"} {q ? un(q) : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={`Quantidade (em aberto: ${un(aberto)})`}>
          <Input inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} autoFocus />
        </Field>
        {!concluir && (
          <Field label="Motivo (opcional)">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Aba Montagem
// ---------------------------------------------------------------------------

export function AbaMontagem({ painel, onPainel }) {
  const [dialogo, setDialogo] = useState(null);
  const fechar = () => setDialogo(null);
  const salvo = (d) => {
    setDialogo(null);
    onPainel(d);
    atualizarAlertasRecebimentos();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Produtos montados em cápsula: o catálogo mostra <strong>prontos + em montagem + o que dá para montar</strong> com os brinquedos sem cápsula e as cápsulas livres. Vender cápsulas diminui
          automaticamente o que dá para montar.
        </p>
        <Button onClick={() => setDialogo({ nome: "config" })}>
          <Settings2 className="h-4 w-4" /> Configurar produto
        </Button>
      </div>

      {!painel.produtos.length ? (
        <Card>
          <EmptyState icon={Boxes} titulo="Nenhum produto com montagem em cápsula" descricao='Clique em "Configurar produto" e escolha as cápsulas de cada brinquedo (ex.: Pokemon 1 pol = 1 cápsula vermelha + 1 branca).' />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              {["Produto", "Prontos", "Em montagem", "Sem cápsula", "Dá p/ montar", "Pendente de cápsula", "No catálogo", "Cápsulas por unidade", ""].map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {painel.produtos.map((p) => (
              <tr key={p.id} className={cx("hover:bg-muted/40", p.pendente > 0 && "bg-amber-50")}>
                <Td className="text-left">
                  <div className="flex items-center gap-2">
                    <Miniatura src={p.imagemUrl} />
                    <div className="min-w-0">
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU {p.sku}
                        {p.produtoSolto && ` · soltos em "${p.produtoSolto.nome}"`}
                        {p.prioridadeMontagem ? ` · prioridade ${p.prioridadeMontagem}` : ""}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Num v={p.montado} cor={p.montado < 0 && "text-red-600"} />
                </Td>
                <Td>
                  <Num v={p.emMontagem} cor={p.emMontagem > 0 && "text-violet-700"} forte={p.emMontagem > 0} />
                </Td>
                <Td>
                  <Num v={p.solto} />
                </Td>
                <Td>
                  <Num v={p.podeMontar} cor="text-blue-700" forte />
                </Td>
                <Td>{p.pendente > 0 ? <span className="inline-flex items-center gap-1 font-bold text-red-600"><AlertTriangle className="h-4 w-4" />{un(p.pendente)}</span> : <span className="text-emerald-700">0</span>}</Td>
                <Td>
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">{un(p.estoque)}</span>
                </Td>
                <Td className="text-left text-xs">
                  {p.capsulas.map((g, i) => (
                    <span key={i} className="block">
                      {g.opcoes.map((o, k) => (
                        <span key={o.produtoId} className="whitespace-nowrap">
                          {k > 0 && <strong className="text-blue-700"> ou </strong>}
                          {o.quantidade}× {o.nome} <span className="text-muted-foreground">({un(o.estoque)})</span>
                        </span>
                      ))}
                      {g.falta > 0 && <span className="ml-1 font-semibold text-red-600">· faltam {un(g.falta)}</span>}
                    </span>
                  ))}
                </Td>
                <Td>
                  <RowMenu
                    itens={[
                      { label: "Enviar para montagem", icone: Boxes, cor: "font-semibold text-blue-700 hover:bg-blue-50", onClick: () => setDialogo({ nome: "enviar", produto: p }) },
                      {
                        label: "Ajustar saldos",
                        icone: Settings2,
                        onClick: () =>
                          setDialogo({
                            nome: "ajustar",
                            produto: p,
                            saldos: {
                              SEM_CAPSULA: { label: SALDOS.SEM_CAPSULA, atual: p.solto },
                              MONTADO: { label: SALDOS.MONTADO, atual: p.montado },
                              EM_MONTAGEM: { label: SALDOS.EM_MONTAGEM, atual: p.emMontagem },
                            },
                          }),
                      },
                      { label: "Configurar cápsulas", icone: Settings2, onClick: () => setDialogo({ nome: "config", produto: p }) },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div>
        <h3 className="mb-2 font-semibold">Em montagem agora</h3>
        {!painel.ordens.length ? (
          <p className="text-sm text-muted-foreground">Nenhum lote em montagem.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                {["Produto", "Enviado", "Quantidade", "Concluído", "Em aberto", "Cápsulas separadas", ""].map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {painel.ordens.map((o) => (
                <tr key={o.id}>
                  <Td className="text-left font-medium">
                    {o.produtoNome}
                    {o.observacao && <span className="block text-xs font-normal text-muted-foreground">{o.observacao}</span>}
                  </Td>
                  <Td className="text-xs">
                    {dataHora(o.createdAt)}
                    <span className="block text-muted-foreground">{o.enviadoPor}</span>
                  </Td>
                  <Td>{un(o.quantidade)}</Td>
                  <Td>{un(o.quantidadeConcluida)}</Td>
                  <Td className="font-semibold text-violet-700">{un(o.quantidade - o.quantidadeConcluida - o.quantidadeCancelada)}</Td>
                  <Td className="text-left text-xs">
                    {o.capsulas.map((c) => (
                      <span key={c.produtoId} className="block">
                        {un(c.quantidade)} {c.nome}
                      </span>
                    ))}
                  </Td>
                  <Td>
                    <div className="flex justify-center gap-1">
                      <Button size="sm" variant="success" onClick={() => setDialogo({ nome: "concluir", ordem: o })}>
                        Concluir
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialogo({ nome: "cancelar", ordem: o })}>
                        Cancelar
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {dialogo?.nome === "config" && <ConfigMontagem produto={dialogo.produto} onFechar={fechar} onSalvo={(d) => salvo({ ...painel, ...d })} />}
      {dialogo?.nome === "enviar" && <EnviarMontagem produto={dialogo.produto} onFechar={fechar} onSalvo={(d) => salvo(d)} />}
      {dialogo?.nome === "ajustar" && <AjustarSaldo produto={dialogo.produto} saldos={dialogo.saldos} onFechar={fechar} onSalvo={(d) => salvo({ ...painel, ...d })} />}
      {(dialogo?.nome === "concluir" || dialogo?.nome === "cancelar") && <FecharOrdem ordem={dialogo.ordem} acao={dialogo.nome} onFechar={fechar} onSalvo={(d) => salvo(d)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Cápsulas (estoque e o que comprar)
// ---------------------------------------------------------------------------

function NovaCapsula({ fornecedores, onFechar, onSalvo }) {
  const toast = useToast();
  const [f, setF] = useState({ tipoInsumo: "CAPSULA", nome: "", tamanho: "1", venderNoCatalogo: false, precoVenda: "", unidadesPacote: "1", estoqueInicial: "", fornecedorId: "", margemPerda: "", avisoCompraAbaixo: "" });
  const [salvando, setSalvando] = useState(false);
  const set = (c) => (e) => setF({ ...f, [c]: e.target.value });
  const sleeve = f.tipoInsumo === "SLEEVE";
  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post("/recebimentos/capsulas", { ...f, precoVenda: lerNumero(f.precoVenda), estoqueInicial: lerNumero(f.estoqueInicial) });
      toast({ titulo: sleeve ? "Sleeve cadastrado" : "Cápsula cadastrada" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao cadastrar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={sleeve ? "Novo sleeve" : "Nova cápsula"}
      descricao="Cadastre cada cápsula (cor/tamanho) ou sleeve que vocês compram. Fica disponível para montar produtos e para receber de fornecedores."
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={!f.nome.trim()} onClick={salvar}>
            Cadastrar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo" className="sm:col-span-2">
          <Segmented
            value={f.tipoInsumo}
            onChange={(v) => setF({ ...f, tipoInsumo: v })}
            opcoes={[
              { value: "CAPSULA", label: "Cápsula" },
              { value: "SLEEVE", label: "Sleeve" },
            ]}
          />
        </Field>
        <Field label="Nome" obrigatorio className="sm:col-span-2">
          <Input value={f.nome} onChange={set("nome")} placeholder={sleeve ? "Ex.: Sleeve Minecraft 1 polegada" : "Ex.: Cápsula 1 pol vermelha"} autoFocus />
        </Field>
        {!sleeve && (
          <Field label="Tamanho">
            <Select value={f.tamanho} onChange={set("tamanho")}>
              <option value="1">1 polegada</option>
              <option value="2">2 polegadas</option>
              <option value="105">105 mm</option>
            </Select>
          </Field>
        )}
        <Field label="Fornecedor de costume">
          <Select value={f.fornecedorId} onChange={set("fornecedorId")}>
            <option value="">—</option>
            {fornecedores.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estoque atual (unidades)">
          <Input inputMode="numeric" value={f.estoqueInicial} onChange={set("estoqueInicial")} placeholder="0" />
        </Field>
        <Field label="Margem de perda (%)" dica={`Vazio = padrão (${sleeve ? "10%" : "0%"}). Entra a mais na sugestão de compra.`}>
          <Input inputMode="decimal" value={f.margemPerda} onChange={set("margemPerda")} placeholder={sleeve ? "10" : "0"} />
        </Field>
        <Field label="Avisar quando chegar em" dica={`Vazio = padrão (${sleeve ? "500 un." : "sem aviso"}).`}>
          <Input inputMode="numeric" value={f.avisoCompraAbaixo} onChange={set("avisoCompraAbaixo")} placeholder={sleeve ? "500" : "—"} />
        </Field>
        <div className="flex items-end pb-2">
          <Switch label="Vender no catálogo" checked={f.venderNoCatalogo} onChange={(v) => setF({ ...f, venderNoCatalogo: v })} />
        </div>
        {f.venderNoCatalogo && (
          <>
            <Field label="Preço por unidade (R$)">
              <Input inputMode="decimal" value={f.precoVenda} onChange={set("precoVenda")} />
            </Field>
            <Field label="Unidades por pacote">
              <Input inputMode="numeric" value={f.unidadesPacote} onChange={set("unidadesPacote")} />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}

// Regras de compra de um insumo já cadastrado.
function RegrasInsumo({ insumo, onFechar, onSalvo }) {
  const toast = useToast();
  const [f, setF] = useState({
    tipoInsumo: insumo.tipoInsumo,
    margemPerda: insumo.margemDefinida ? String(insumo.margemPerda) : "",
    avisoCompraAbaixo: insumo.avisoDefinido ? String(insumo.avisoCompraAbaixo ?? "") : "",
  });
  const [salvando, setSalvando] = useState(false);
  const sleeve = f.tipoInsumo === "SLEEVE";
  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.put(`/recebimentos/insumos/${insumo.id}`, f);
      toast({ titulo: "Regras de compra salvas" });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={`Regras de compra · ${insumo.nome}`}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} onClick={salvar}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Tipo">
          <Segmented
            value={f.tipoInsumo}
            onChange={(v) => setF({ ...f, tipoInsumo: v })}
            opcoes={[
              { value: "CAPSULA", label: "Cápsula" },
              { value: "SLEEVE", label: "Sleeve" },
            ]}
          />
        </Field>
        <Field label="Margem de perda (%)" dica={`A sugestão de compra soma esta % a mais. Vazio = padrão (${sleeve ? "10%" : "0%"}).`}>
          <Input inputMode="decimal" value={f.margemPerda} onChange={(e) => setF({ ...f, margemPerda: e.target.value })} placeholder={sleeve ? "10" : "0"} />
        </Field>
        <Field label="Avisar que está acabando quando chegar em (unidades)" dica={`Vazio = padrão (${sleeve ? "500" : "sem aviso"}). Use 0 para não avisar.`}>
          <Input inputMode="numeric" value={f.avisoCompraAbaixo} onChange={(e) => setF({ ...f, avisoCompraAbaixo: e.target.value.replace(/\D/g, "") })} placeholder={sleeve ? "500" : "—"} />
        </Field>
      </div>
    </Dialog>
  );
}

export function AbaCapsulas({ painel, fornecedores, onPainel, onRecarregar, onComprar }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [dialogo, setDialogo] = useState(null);
  const faltando = painel.faltas || [];
  const acabando = painel.acabando || [];
  const comprarFaltas = (lista) => onComprar(lista.map((f) => ({ ...f.opcoes[0], falta: f.sugestao ?? f.falta })));

  const marcar = async (p, ehCapsula) => {
    if (!ehCapsula) {
      const ok = await confirmar({ titulo: `Tirar "${p.nome}" desta lista?`, mensagem: "Ele continua existindo como produto, só deixa de ser cápsula/sleeve de montagem.", confirmar: "Tirar" });
      if (!ok) return;
    }
    try {
      const { data } = await api.put(`/recebimentos/capsulas/${p.id}`, { ehCapsula });
      onPainel(data);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  return (
    <div className="space-y-4">
      {faltando.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <ShoppingCart className="h-5 w-5" /> Comprar para montar tudo o que chegou
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
              {faltando.map((c) => (
                <li key={c.chave}>
                  <strong>{un(c.sugestao)}</strong> {c.nome}
                  {c.margem > 0 && (
                    <span className="text-xs">
                      {" "}
                      (faltam {un(c.falta)} + {c.margem}% de perda)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <Button variant="info" onClick={() => comprarFaltas(faltando)}>
            Criar pré-recebimento da compra
          </Button>
        </div>
      )}

      {acabando.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold text-red-800">
              <AlertTriangle className="h-5 w-5" /> Está acabando — precisa comprar
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-red-900">
              {acabando.map((c) => (
                <li key={c.id}>
                  {c.nome}: restam <strong>{un(c.estoque)}</strong> (aviso em {un(c.avisoCompraAbaixo)})
                </li>
              ))}
            </ul>
          </div>
          <Button variant="danger" onClick={() => onComprar(acabando.map((c) => ({ ...c, falta: c.sugestao })))}>
            Comprar os que estão acabando
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDialogo({ nome: "nova" })}>
          <Plus className="h-4 w-4" /> Nova cápsula ou sleeve
        </Button>
        <div className="w-full sm:w-80">
          <ProdutoBusca placeholder="Marcar produto existente (ex.: SLEEVE MINECRAFT)..." onEscolher={(p) => marcar(p, true)} />
        </div>
      </div>

      {!painel.capsulas.length ? (
        <Card>
          <EmptyState
            icon={Boxes}
            titulo="Nenhuma cápsula ou sleeve cadastrado"
            descricao="Cadastre as cápsulas e sleeves ou marque produtos existentes, como 'Cápsulas 1 pol vazias' ou 'SLEEVE MINECRAFT 1 POLEGADA'."
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              {["Item", "Em estoque", "Aviso em", "Perda", "Falta", "Sugestão de compra", "Usado em", ""].map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {painel.capsulas.map((c) => (
              <tr key={c.id} className={cx("hover:bg-muted/40", c.acabando ? "bg-red-50" : c.falta > 0 && "bg-amber-50")}>
                <Td className="text-left">
                  <div className="flex items-center gap-2">
                    <Miniatura src={c.imagemUrl} />
                    <div>
                      <p className="flex items-center gap-1.5 font-medium">
                        {c.nome}
                        <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-bold", c.tipoInsumo === "SLEEVE" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800")}>
                          {c.tipoInsumo === "SLEEVE" ? "Sleeve" : "Cápsula"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        SKU {c.sku}
                        {c.arquivado ? " · só controle (fora do catálogo)" : " · à venda no catálogo"}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className={cx("font-semibold", c.acabando && "text-red-600")}>{un(c.estoque)}</span>
                  {c.acabando && <span className="block text-[11px] font-bold text-red-600">acabando</span>}
                </Td>
                <Td className="text-xs">{c.avisoCompraAbaixo ? un(c.avisoCompraAbaixo) : "—"}</Td>
                <Td className="text-xs">{c.margemPerda ? `${c.margemPerda}%` : "—"}</Td>
                <Td>
                  {c.falta > 0 ? <span className="font-bold text-red-600">{un(c.falta)}</span> : <span className="text-emerald-700">0</span>}
                  {c.faltaEmAlternativas?.map((f) => (
                    <span key={f.nome} className="block text-[11px] text-amber-800">
                      {un(f.falta)} de {f.nome}
                    </span>
                  ))}
                </Td>
                <Td>{c.sugestaoCompra > 0 ? <strong className="text-blue-700">{un(c.sugestaoCompra)}</strong> : "—"}</Td>
                <Td className="text-left text-xs">
                  {c.produtos.length
                    ? c.produtos.map((p) => (
                        <span key={p.id} className="block">
                          {p.nome}
                          {p.alternativa && <span className="text-muted-foreground"> (alternativa)</span>}
                        </span>
                      ))
                    : "—"}
                </Td>
                <Td>
                  <RowMenu
                    itens={[
                      { label: "Regras de compra (perda e aviso)", icone: Settings2, onClick: () => setDialogo({ nome: "regras", insumo: c }) },
                      {
                        label: "Ajustar estoque",
                        icone: Settings2,
                        onClick: () => setDialogo({ nome: "ajustar", produto: c, saldos: { ESTOQUE: { label: "Estoque", atual: c.estoque } } }),
                      },
                      { label: "Comprar", icone: ShoppingCart, onClick: () => onComprar([{ ...c, falta: c.sugestaoCompra || 0 }]) },
                      { label: "Tirar desta lista", icone: Trash2, perigo: true, onClick: () => marcar(c, false) },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {dialogo?.nome === "nova" && (
        <NovaCapsula
          fornecedores={fornecedores}
          onFechar={() => setDialogo(null)}
          onSalvo={() => {
            setDialogo(null);
            onRecarregar();
          }}
        />
      )}
      {dialogo?.nome === "regras" && (
        <RegrasInsumo
          insumo={dialogo.insumo}
          onFechar={() => setDialogo(null)}
          onSalvo={(d) => {
            setDialogo(null);
            onPainel(d);
            atualizarAlertasRecebimentos();
          }}
        />
      )}
      {dialogo?.nome === "ajustar" && (
        <AjustarSaldo
          produto={dialogo.produto}
          saldos={dialogo.saldos}
          onFechar={() => setDialogo(null)}
          onSalvo={(d) => {
            setDialogo(null);
            onPainel(d);
            atualizarAlertasRecebimentos();
          }}
        />
      )}
    </div>
  );
}
