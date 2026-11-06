import { useState } from "react";
import { Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, EmptyState, Field, Input, Switch, Table, Td, Textarea, Th, useConfirm, useToast } from "../ui";
import { BotaoWhatsapp } from "../Whatsapp";
import { contemTexto, mascaraDocumento, mascaraTelefone } from "../../utils/format";

export function FornecedorForm({ fornecedor, onFechar, onSalvo }) {
  const toast = useToast();
  const [f, setF] = useState({ ativo: true, ...fornecedor });
  const [salvando, setSalvando] = useState(false);
  const set = (c, mascara) => (e) => setF({ ...f, [c]: mascara ? mascara(e.target.value) : e.target.value });

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = f.id ? await api.put(`/parceiros/${f.id}`, f) : await api.post("/parceiros", { ...f, tipo: "FORNECEDOR" });
      toast({ titulo: f.id ? "Fornecedor atualizado" : "Fornecedor cadastrado" });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Erro ao salvar fornecedor", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo={f.id ? "Editar fornecedor" : "Novo fornecedor"}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={!f.nome?.trim()} onClick={salvar}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome / razão social" obrigatorio className="sm:col-span-2">
          <Input value={f.nome || ""} onChange={set("nome")} autoFocus />
        </Field>
        <Field label="CNPJ / CPF">
          <Input value={f.documento || ""} onChange={set("documento", mascaraDocumento)} />
        </Field>
        <Field label="Pessoa de contato">
          <Input value={f.contato || ""} onChange={set("contato")} />
        </Field>
        <Field label="WhatsApp / telefone" dica="Usado para enviar o link do pré-recebimento">
          <Input value={f.telefone || ""} onChange={set("telefone", mascaraTelefone)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={f.email || ""} onChange={set("email")} />
        </Field>
        <Field label="Cidade">
          <Input value={f.cidade || ""} onChange={set("cidade")} />
        </Field>
        <Field label="UF">
          <Input value={f.estado || ""} maxLength={2} onChange={(e) => setF({ ...f, estado: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={2} value={f.observacoes || ""} onChange={set("observacoes")} placeholder="Ex.: fornece brinquedos 1 pol; prazo médio 15 dias" />
        </Field>
        <Switch label="Ativo" checked={f.ativo} onChange={(v) => setF({ ...f, ativo: v })} />
      </div>
    </Dialog>
  );
}

export default function Fornecedores({ fornecedores, onAtualizar }) {
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(undefined);
  const [excluindo, setExcluindo] = useState(null);
  const toast = useToast();
  const confirmar = useConfirm();
  const excluir = async (f) => {
    const ok = await confirmar({
      titulo: `Excluir ${f.nome}?`,
      mensagem: "O fornecedor sai da lista. Os recebimentos e compras já feitos continuam no histórico com o nome dele.",
      perigo: true,
      confirmar: "Excluir fornecedor",
    });
    if (!ok) return;
    setExcluindo(f.id);
    try {
      await api.delete(`/parceiros/${f.id}`);
      toast({ titulo: "Fornecedor excluído" });
      onAtualizar();
    } catch (error) {
      toast({ titulo: "Não foi possível excluir", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setExcluindo(null);
    }
  };
  const lista = fornecedores.filter((f) => !busca || contemTexto(`${f.nome} ${f.documento || ""} ${f.contato || ""}`, busca));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Buscar fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button className="ml-auto" onClick={() => setForm(null)}>
          <Plus className="h-4 w-4" /> Novo fornecedor
        </Button>
      </div>
      {!fornecedores.length ? (
        <EmptyState icon={Truck} titulo="Nenhum fornecedor cadastrado" descricao="Cadastre quem traz brinquedos, cápsulas e produtos." />
      ) : (
        <Table>
          <thead>
            <tr>
              {["Fornecedor", "Documento", "Contato", "Telefone", "Cidade", "Situação", ""].map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id} className="hover:bg-muted/40">
                <Td className="text-left font-medium">
                  {f.nome}
                  {f.observacoes && <span className="block max-w-72 truncate text-xs font-normal text-muted-foreground">{f.observacoes}</span>}
                </Td>
                <Td className="text-xs">{f.documento || "-"}</Td>
                <Td>{f.contato || "-"}</Td>
                <Td>
                  {f.telefone ? (
                    <BotaoWhatsapp telefone={f.telefone} texto="Olá! Aqui é da Gira Kids." variante="link">
                      {f.telefone}
                    </BotaoWhatsapp>
                  ) : (
                    "-"
                  )}
                </Td>
                <Td>{f.cidade ? `${f.cidade}${f.estado ? `/${f.estado}` : ""}` : "-"}</Td>
                <Td>
                  <Badge variant={f.ativo ? "success" : "default"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setForm(f)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50" loading={excluindo === f.id} onClick={() => excluir(f)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {form !== undefined && (
        <FornecedorForm
          fornecedor={form}
          onFechar={() => setForm(undefined)}
          onSalvo={() => {
            setForm(undefined);
            onAtualizar();
          }}
        />
      )}
    </div>
  );
}
