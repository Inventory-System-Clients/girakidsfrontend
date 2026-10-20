import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import {
  Badge,
  Button,
  Dialog,
  Field,
  FiltroMulti,
  Input,
  MetricCard,
  PageHeader,
  RowMenu,
  Select,
  Skeleton,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  useConfirm,
  useToast,
} from "../components/ui";
import { UFS, data, hojeISO, lerNumero, mascaraCnpj, mascaraTelefone, moeda, moedaUnitaria, numero } from "../utils/format";

function BuscaProduto({ valor, onChange }) {
  const [busca, setBusca] = useState(valor?.nome || "");
  const [opcoes, setOpcoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto || busca.length < 2) return setOpcoes([]);
    const t = setTimeout(() => api.get("/produtos/busca", { params: { busca } }).then(({ data: d }) => setOpcoes(d)), 300);
    return () => clearTimeout(t);
  }, [busca, aberto]);
  return (
    <div className="relative">
      <Input
        value={busca}
        placeholder="Selecione um produto"
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        onChange={(e) => {
          setBusca(e.target.value);
          onChange(null);
        }}
      />
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {opcoes.map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={() => {
                onChange(p);
                setBusca(p.nome);
                setAberto(false);
              }}
            >
              {p.nome} <span className="text-xs text-muted-foreground">· SKU {p.sku} · estoque {numero(p.estoque)} · custo {p.custo != null ? moedaUnitaria(p.custo) : "-"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const itemVazio = () => ({ produto: null, quantidade: "", custoUnitario: "", observacao: "" });

function NovoRecebimento({ fornecedores, onFechar, onSalvo }) {
  const toast = useToast();
  const [form, setForm] = useState({ fornecedorId: "", documento: "", dataRecebimento: hojeISO(), observacoes: "" });
  const [itens, setItens] = useState([itemVazio()]);
  const [salvando, setSalvando] = useState(false);
  const total = itens.reduce((s, i) => s + lerNumero(i.quantidade) * lerNumero(i.custoUnitario), 0);
  const setItem = (i, campo, valor) => setItens(itens.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.post("/entradas/recebimentos", {
        ...form,
        itens: itens.map((i) => ({ produtoId: i.produto?.id, quantidade: lerNumero(i.quantidade), custoUnitario: lerNumero(i.custoUnitario), observacao: i.observacao })),
      });
      toast({ titulo: "Recebimento confirmado", descricao: "Estoque e custos atualizados." });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao confirmar recebimento", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="xl"
      titulo="Novo recebimento"
      descricao="Registre a entrada com múltiplos produtos, custo e referências do item sem alterar o preço de venda do produto."
      rodape={
        <>
          <span className="mr-auto self-center text-sm">
            Total previsto: <strong>{moeda(total)}</strong>
          </span>
          <Button
            variant="outline"
            onClick={() => {
              setItens([itemVazio()]);
              setForm({ fornecedorId: "", documento: "", dataRecebimento: hojeISO(), observacoes: "" });
            }}
          >
            Limpar
          </Button>
          <Button loading={salvando} disabled={!form.fornecedorId} onClick={salvar}>
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Dados do recebimento</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Fornecedor">
          <Select value={form.fornecedorId} onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })}>
            <option value="">Selecione um fornecedor</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Documento">
          <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="NF, pedido ou protocolo" />
        </Field>
        <Field label="Data de recebimento">
          <Input type="date" value={form.dataRecebimento} onChange={(e) => setForm({ ...form, dataRecebimento: e.target.value })} />
        </Field>
        <Field label="Observações" className="sm:col-span-3">
          <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </Field>
      </div>
      <p className="mt-5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Itens do recebimento</p>
      <p className="mb-2 text-xs text-muted-foreground">Cada item atualiza estoque (em unidades) e mantém o histórico de custo do produto.</p>
      <div className="space-y-3">
        {itens.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Item {i + 1}</p>
              {itens.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setItens(itens.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
              <Field label="Produto">
                <BuscaProduto
                  valor={item.produto}
                  onChange={(p) => setItens(itens.map((x, j) => (j === i ? { ...x, produto: p, custoUnitario: p?.custo != null && !x.custoUnitario ? String(p.custo).replace(".", ",") : x.custoUnitario } : x)))}
                />
              </Field>
              <Field label="Quantidade (un.)">
                <Input value={item.quantidade} onChange={(e) => setItem(i, "quantidade", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Custo unitário">
                <Input value={item.custoUnitario} onChange={(e) => setItem(i, "custoUnitario", e.target.value)} placeholder="0,00" />
              </Field>
              <div>
                <p className="label">Total da linha</p>
                <p className="py-2 font-semibold">{moeda(lerNumero(item.quantidade) * lerNumero(item.custoUnitario))}</p>
              </div>
              <Field label="Observação do item" className="sm:col-span-4">
                <Input value={item.observacao} onChange={(e) => setItem(i, "observacao", e.target.value)} />
              </Field>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setItens([...itens, itemVazio()])}>
          <Plus className="h-4 w-4" /> Adicionar item
        </Button>
      </div>
    </Dialog>
  );
}

function VerRecebimento({ recebimento, onFechar }) {
  return (
    <Dialog aberto onFechar={onFechar} tamanho="lg" titulo={`Recebimento ${recebimento.documento || ""}`} descricao={`${recebimento.fornecedor?.nome} · ${data(recebimento.dataRecebimento)} · por ${recebimento.usuarioNome}`}>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th className="py-2 text-left">Produto</th>
            <th>Qtd</th>
            <th className="text-right">Custo un.</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {recebimento.itens.map((i) => (
            <tr key={i.id} className="border-b border-border/60">
              <td className="py-2">
                {i.produtoNome}
                {i.observacao && <span className="block text-xs text-muted-foreground">{i.observacao}</span>}
              </td>
              <td className="text-center">{numero(i.quantidade)}</td>
              <td className="text-right">{moedaUnitaria(i.custoUnitario)}</td>
              <td className="text-right">{moeda(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right font-bold">Total: {moeda(recebimento.total)}</p>
      {recebimento.observacoes && <p className="mt-2 text-sm">Observações: {recebimento.observacoes}</p>}
      {recebimento.status === "ESTORNADO" && (
        <p className="mt-2 text-sm text-red-600">
          Estornado por {recebimento.estornadoPor}: {recebimento.motivoEstorno}
        </p>
      )}
    </Dialog>
  );
}

function Recebimentos({ fornecedores }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [lista, setLista] = useState(null);
  const [filtros, setFiltros] = useState({ fornecedorId: "", status: [], inicio: "", fim: "" });
  const [novo, setNovo] = useState(false);
  const [ver, setVer] = useState(null);

  const carregar = useCallback(() => {
    api
      .get("/entradas/recebimentos", { params: { fornecedorId: filtros.fornecedorId || undefined, status: filtros.status.length === 1 ? filtros.status[0] : undefined, inicio: filtros.inicio || undefined, fim: filtros.fim || undefined } })
      .then(({ data: d }) => setLista(d));
  }, [filtros]);
  useEffect(carregar, [carregar]);

  const estornar = async (r) => {
    const motivo = await confirmar({ titulo: "Estornar recebimento?", mensagem: "As quantidades deste recebimento serão retiradas do estoque.", perigo: true, confirmar: "Estornar", campo: { label: "Motivo do estorno", obrigatorio: true } });
    if (!motivo) return;
    try {
      await api.post(`/entradas/recebimentos/${r.id}/estornar`, { motivo });
      toast({ titulo: "Recebimento estornado" });
      carregar();
    } catch (error) {
      toast({ titulo: "Erro ao estornar", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Fornecedor" className="w-56">
          <Select value={filtros.fornecedorId} onChange={(e) => setFiltros({ ...filtros, fornecedorId: e.target.value })}>
            <option value="">Todos</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </Field>
        <FiltroMulti titulo="Status" opcoes={{ CONFIRMADO: "Confirmado", ESTORNADO: "Estornado" }} valores={filtros.status} onChange={(v) => setFiltros({ ...filtros, status: v })} />
        <Field label="De">
          <Input type="date" value={filtros.inicio} onChange={(e) => setFiltros({ ...filtros, inicio: e.target.value })} />
        </Field>
        <Field label="Até">
          <Input type="date" value={filtros.fim} onChange={(e) => setFiltros({ ...filtros, fim: e.target.value })} />
        </Field>
        <Button className="ml-auto" onClick={() => setNovo(true)}>
          <Plus className="h-4 w-4" /> Novo recebimento
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            {["Data", "Fornecedor", "Documento", "Itens", "Total", "Status", "Ações"].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!lista && (
            <tr>
              <td colSpan={7} className="p-3">
                <Skeleton className="h-20" />
              </td>
            </tr>
          )}
          {lista?.map((r) => (
            <tr key={r.id}>
              <Td>{data(r.dataRecebimento)}</Td>
              <Td>{r.fornecedor?.nome}</Td>
              <Td>{r.documento || "-"}</Td>
              <Td>{r.itens.length}</Td>
              <Td className="font-semibold">{moeda(r.total)}</Td>
              <Td>
                <Badge variant={r.status === "CONFIRMADO" ? "success" : "danger"}>{r.status === "CONFIRMADO" ? "Confirmado" : "Estornado"}</Badge>
              </Td>
              <Td>
                <RowMenu
                  itens={[
                    { label: "Ver recebimento", icone: Eye, onClick: () => setVer(r) },
                    r.status === "CONFIRMADO" && { label: "Estornar", icone: Undo2, perigo: true, onClick: () => estornar(r) },
                  ]}
                />
              </Td>
            </tr>
          ))}
          {lista && !lista.length && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-muted-foreground">
                Nenhum recebimento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      {novo && (
        <NovoRecebimento
          fornecedores={fornecedores}
          onFechar={() => setNovo(false)}
          onSalvo={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
      {ver && <VerRecebimento recebimento={ver} onFechar={() => setVer(null)} />}
    </div>
  );
}

function ParceiroForm({ parceiro, tipo, onFechar, onSalvo }) {
  const toast = useToast();
  const [p, setP] = useState(parceiro || { tipo, ativo: true });
  const set = (c) => (e) => setP({ ...p, [c]: e.target.value });
  const transportadora = (parceiro?.tipo || tipo) === "TRANSPORTADORA";
  const salvar = async () => {
    try {
      if (parceiro) await api.put(`/parceiros/${parceiro.id}`, p);
      else await api.post("/parceiros", { ...p, tipo });
      toast({ titulo: parceiro ? "Parceiro atualizado" : transportadora ? "Transportadora cadastrada" : "Fornecedor cadastrado" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="lg"
      titulo={parceiro ? `Editar ${parceiro.nome}` : transportadora ? "Nova transportadora" : "Novo fornecedor"}
      descricao={transportadora ? "Cadastre os dados básicos para vincular transportadoras aos pedidos." : "Cadastre os dados do fornecedor para registrar recebimentos e custos."}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!p.nome?.trim()}>
            {parceiro ? "Salvar" : transportadora ? "Cadastrar transportadora" : "Cadastrar fornecedor"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome / Razão social" className="sm:col-span-2">
          <Input value={p.nome || ""} onChange={set("nome")} />
        </Field>
        <Field label="CNPJ / CPF">
          <Input value={p.documento ? mascaraCnpj(p.documento) : ""} onChange={(e) => setP({ ...p, documento: e.target.value })} />
        </Field>
        <Field label="Contato principal">
          <Input value={p.contato || ""} onChange={set("contato")} />
        </Field>
        <Field label="Telefone">
          <Input value={p.telefone || ""} onChange={(e) => setP({ ...p, telefone: mascaraTelefone(e.target.value) })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={p.email || ""} onChange={set("email")} />
        </Field>
        <Field label="Cidade">
          <Input value={p.cidade || ""} onChange={set("cidade")} />
        </Field>
        <Field label="UF">
          <Select value={p.estado || ""} onChange={set("estado")}>
            <option value="">-</option>
            {Object.keys(UFS).map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={p.ativo ? "1" : "0"} onChange={(e) => setP({ ...p, ativo: e.target.value === "1" })}>
            <option value="1">{transportadora ? "Ativa" : "Ativo"}</option>
            <option value="0">{transportadora ? "Inativa" : "Inativo"}</option>
          </Select>
        </Field>
        <Field label="Observações internas" className="sm:col-span-2">
          <Textarea value={p.observacoes || ""} onChange={set("observacoes")} />
        </Field>
      </div>
    </Dialog>
  );
}

function Parceiros({ lista, recarregar }) {
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState(null);
  const filtrados = lista.filter((p) => !tipos.length || tipos.includes(p.tipo));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FiltroMulti titulo="Tipo" opcoes={{ FORNECEDOR: "Fornecedor", TRANSPORTADORA: "Transportadora" }} valores={tipos} onChange={setTipos} />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setForm({ tipo: "FORNECEDOR" })}>
            <Plus className="h-4 w-4" /> Novo fornecedor
          </Button>
          <Button onClick={() => setForm({ tipo: "TRANSPORTADORA" })}>
            <Plus className="h-4 w-4" /> Nova transportadora
          </Button>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            {["Tipo", "Parceiro", "Documento", "Contato", "Telefone", "Localização", "Status", "Ações"].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtrados.map((p) => (
            <tr key={p.id}>
              <Td>
                <Badge variant={p.tipo === "FORNECEDOR" ? "primary" : "info"}>{p.tipo === "FORNECEDOR" ? "Fornecedor" : "Transportadora"}</Badge>
              </Td>
              <Td className="font-medium">{p.nome}</Td>
              <Td className="text-xs">{p.documento || "-"}</Td>
              <Td>{p.contato || "-"}</Td>
              <Td>{p.telefone || "-"}</Td>
              <Td>{p.cidade ? `${p.cidade}/${p.estado || ""}` : p.estado || "-"}</Td>
              <Td>
                <Badge variant={p.ativo ? "success" : "default"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
              </Td>
              <Td>
                <RowMenu itens={[{ label: "Editar", icone: Pencil, onClick: () => setForm({ parceiro: p }) }]} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {form && (
        <ParceiroForm
          parceiro={form.parceiro}
          tipo={form.tipo}
          onFechar={() => setForm(null)}
          onSalvo={() => {
            setForm(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}

export default function Entradas() {
  const [aba, setAba] = useState("resumo");
  const [resumo, setResumo] = useState(null);
  const [parceiros, setParceiros] = useState([]);
  const carregarParceiros = () => api.get("/parceiros").then(({ data: d }) => setParceiros(d));
  useEffect(() => {
    carregarParceiros();
    api.get("/entradas/resumo").then(({ data: d }) => setResumo(d));
  }, [aba]);
  const fornecedores = parceiros.filter((p) => p.ativo);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader titulo="Entradas e parceiros" subtitulo="Controle entregas por fornecedor, custo de reposição e histórico de custos." />
      <Tabs className="mb-4" abas={[{ value: "resumo", label: "Resumo" }, { value: "recebimentos", label: "Recebimentos" }, { value: "parceiros", label: "Parceiros" }]} ativa={aba} onChange={setAba} />
      {aba === "resumo" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard titulo="Recebimentos" valor={resumo?.total ?? "..."} />
          <MetricCard titulo="Confirmados" valor={resumo?.confirmados ?? "..."} />
          <MetricCard titulo="Estornados" valor={resumo?.estornados ?? "..."} />
          <MetricCard titulo="Custo acumulado" valor={moeda(resumo?.custoAcumulado)} />
        </div>
      )}
      {aba === "recebimentos" && <Recebimentos fornecedores={fornecedores} />}
      {aba === "parceiros" && <Parceiros lista={parceiros} recarregar={carregarParceiros} />}
    </div>
  );
}
