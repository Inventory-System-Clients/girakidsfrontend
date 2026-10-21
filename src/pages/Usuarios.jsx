import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { TELAS, useAuth } from "../contexts/AuthContext";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Field,
  FiltroMulti,
  Input,
  PageHeader,
  Paginacao,
  RowMenu,
  Select,
  Skeleton,
  Switch,
  Table,
  Td,
  Th,
  useConfirm,
  useToast,
} from "../components/ui";
import EnderecoCampos from "../components/EnderecoCampos";
import { EditorEtiquetas, EtiquetasChips } from "../components/Etiquetas";
import { data, lerNumero, moeda } from "../utils/format";
import { ROLES } from "../utils/status";

const gerarSenha = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join("");
};

function UsuarioForm({ usuario, onFechar, onSalvo }) {
  const { usuario: eu } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const novo = !usuario;
  const [u, setU] = useState(() =>
    usuario
      ? { ...usuario, credito: String(usuario.credito || 0).replace(".", ",") }
      : { role: eu.role === "ADMIN" ? "FUNCIONARIO" : "CLIENTE", permissoes: [], documentoTipo: "CPF", outrosPagamentos: false, credito: "0" },
  );
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = { ...u, credito: lerNumero(u.credito) };
      if (novo) await api.post("/usuarios", { ...corpo, senha });
      else await api.put(`/usuarios/${usuario.id}`, corpo);
      toast({ titulo: novo ? "Usuário criado" : "Usuário atualizado" });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro ao salvar usuário", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const resetar = async () => {
    try {
      await api.put(`/usuarios/${usuario.id}/senha`, { senha: novaSenha });
      toast({ titulo: "Senha redefinida", descricao: "O usuário deverá trocá-la no próximo login." });
      setNovaSenha("");
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const excluir = async () => {
    const ok = await confirmar({ titulo: `Excluir ${usuario.nome}?`, mensagem: "Usuários com pedidos são apenas desativados, mantendo o histórico.", perigo: true, confirmar: "Excluir usuário" });
    if (!ok) return;
    try {
      const { data: d } = await api.delete(`/usuarios/${usuario.id}`);
      toast({ titulo: d.message });
      onSalvo();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const descricaoRole = {
    ADMIN: "Acesso total a todas as telas internas.",
    FUNCIONARIO: "Acesso interno configurável: o administrador define quais telas este funcionário pode acessar.",
    CLIENTE: "Acesso limitado: visualiza catálogo, faz pedidos e acompanha seus pedidos.",
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      tamanho="xl"
      titulo={novo ? "Criar Novo Usuário" : "Editar Usuário"}
      descricao={novo ? "Preencha os dados abaixo para cadastrar um novo usuário." : "Atualize os dados do usuário e mantenha as informações de acesso em dia."}
      rodape={
        <>
          {!novo && (
            <Button variant="danger-outline" className="mr-auto" onClick={excluir}>
              <Trash2 className="h-4 w-4" /> Excluir usuário
            </Button>
          )}
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={novo && senha.length < 8} onClick={salvar}>
            {novo ? "Criar Usuário" : "Salvar Alterações"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 font-semibold">Informações Básicas</h3>
          <EnderecoCampos valor={u} onChange={setU} obrigatorio={u.role === "CLIENTE"} />
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Cargo" obrigatorio dica={descricaoRole[u.role]}>
            <Select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })} disabled={eu.role !== "ADMIN"}>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          {u.role === "CLIENTE" && (
            <>
              <Field label="Crédito do cliente" dica="Saldo manual disponível para desconto em pedidos.">
                <Input value={u.credito} onChange={(e) => setU({ ...u, credito: e.target.value })} />
              </Field>
              <Field label="Outros pagamentos" dica="Libera boleto, dinheiro e cheque no checkout do cliente.">
                <Switch checked={u.outrosPagamentos} onChange={(v) => setU({ ...u, outrosPagamentos: v })} label={u.outrosPagamentos ? "Habilitado" : "Desabilitado"} />
              </Field>
            </>
          )}
          {!novo && (
            <Field label="Situação">
              <Switch checked={u.ativo} onChange={(v) => setU({ ...u, ativo: v })} label={u.ativo ? "Ativo" : "Inativo"} />
            </Field>
          )}
        </section>
        {u.role === "FUNCIONARIO" && (
          <section>
            <h3 className="font-semibold">Permissões de acesso</h3>
            <p className="mb-3 text-sm text-muted-foreground">Selecione quais telas internas este funcionário poderá acessar.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(TELAS).map(([chave, tela]) => (
                <div key={chave} className="rounded-lg border border-border p-3">
                  <Checkbox
                    checked={u.permissoes?.includes(chave)}
                    onChange={(v) => setU({ ...u, permissoes: v ? [...(u.permissoes || []), chave] : u.permissoes.filter((p) => p !== chave) })}
                    label={tela.label}
                    descricao={tela.descricao}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
        {novo ? (
          <Field label="Senha" obrigatorio dica="Mínimo de 8 caracteres">
            <div className="flex gap-2">
              <Input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Digite a senha" />
              <Button variant="outline" onClick={() => setSenha(gerarSenha())}>
                Gerar senha
              </Button>
            </div>
          </Field>
        ) : (
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold">Resetar Senha</h3>
            <p className="mb-2 text-sm text-muted-foreground">Defina uma nova senha para este usuário no próximo login.</p>
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-xs" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Digite a nova senha (mín. 8 caracteres)" />
              <Button variant="outline" onClick={() => setNovaSenha(gerarSenha())}>
                Gerar
              </Button>
              <Button disabled={novaSenha.length < 8} onClick={resetar}>
                <KeyRound className="h-4 w-4" /> Resetar Senha
              </Button>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}

export default function Usuarios() {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [roles, setRoles] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(30);
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(undefined);

  const carregar = useCallback(() => {
    api.get("/usuarios", { params: { busca: buscaAplicada || undefined, role: roles.join(",") || undefined, pagina, limite } }).then(({ data: d }) => setDados(d));
  }, [buscaAplicada, roles, pagina, limite]);
  useEffect(carregar, [carregar]);
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  return (
    <div className="container-app py-6">
      <PageHeader titulo="Gerenciamento de Usuários" subtitulo="Adicione, edite ou gerencie usuários da plataforma." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input className="input h-9 pl-9" placeholder="Buscar por nome, email ou documento..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <FiltroMulti titulo="Função" opcoes={ROLES} valores={roles} onChange={setRoles} />
        <Button className="ml-auto" onClick={() => setForm(null)}>
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            {["Nome", "Email", "Função", "Outros pagamentos", "Crédito", "Data de Criação", "Ações"].map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!dados && (
            <tr>
              <td colSpan={7} className="p-3">
                <Skeleton className="h-32" />
              </td>
            </tr>
          )}
          {dados?.itens.map((u) => (
            <tr key={u.id} className={u.ativo ? "" : "opacity-50"}>
              <Td className="text-left font-medium">
                {u.nome}
                {u.trocarSenha && <Badge variant="warning" className="ml-1">Trocar senha</Badge>}
                {u.role === "CLIENTE" && (
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <EtiquetasChips etiquetas={u.etiquetas} />
                    <EditorEtiquetas
                      compacto
                      clienteId={u.id}
                      etiquetas={u.etiquetas || []}
                      observacao={u.observacaoComercial}
                      onSalvo={(d) => setDados((x) => ({ ...x, itens: x.itens.map((y) => (y.id === u.id ? { ...y, ...d } : y)) }))}
                    />
                  </span>
                )}
                {u.observacaoComercial && <span className="block text-[11px] font-normal text-amber-800">{u.observacaoComercial}</span>}
              </Td>
              <Td className="text-left">{u.email}</Td>
              <Td>
                <Badge variant={u.role === "ADMIN" ? "primary" : u.role === "FUNCIONARIO" ? "info" : "default"}>{ROLES[u.role]}</Badge>
              </Td>
              <Td className="text-xs">
                {u.role === "CLIENTE" ? (
                  <>
                    <span className={u.outrosPagamentos ? "text-emerald-600" : ""}>{u.outrosPagamentos ? "Habilitado" : "Desabilitado"}</span>
                    <span className="block text-muted-foreground">Boleto, dinheiro e cheque</span>
                  </>
                ) : (
                  "-"
                )}
              </Td>
              <Td>{moeda(u.credito)}</Td>
              <Td>{data(u.createdAt)}</Td>
              <Td>
                <RowMenu itens={[{ label: "Editar", icone: Pencil, onClick: () => setForm(u) }]} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} onChange={setPagina} limite={limite} onLimite={setLimite} />}
      {form !== undefined && (
        <UsuarioForm
          usuario={form}
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
