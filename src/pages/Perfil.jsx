import { useState } from "react";
import { useLocation } from "react-router-dom";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Field, Input, PageHeader, useToast } from "../components/ui";
import EnderecoCampos from "../components/EnderecoCampos";

export default function Perfil() {
  const { usuario, atualizarUsuario } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState(usuario);
  const [salvando, setSalvando] = useState(false);
  const [senhas, setSenhas] = useState({ senhaAtual: "", novaSenha: "", confirmacao: "" });
  const trocaObrigatoria = usuario?.trocarSenha || location.state?.trocarSenha;

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.put("/auth/perfil", dados);
      atualizarUsuario(data);
      setEditando(false);
      toast({ titulo: "Dados atualizados" });
    } catch (error) {
      toast({ titulo: "Erro ao salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const trocarSenha = async () => {
    if (senhas.novaSenha !== senhas.confirmacao) return toast({ titulo: "As senhas não coincidem", tipo: "erro" });
    try {
      await api.put("/auth/senha", senhas);
      atualizarUsuario({ ...usuario, trocarSenha: false });
      setSenhas({ senhaAtual: "", novaSenha: "", confirmacao: "" });
      toast({ titulo: "Senha alterada com sucesso" });
    } catch (error) {
      toast({ titulo: "Erro ao alterar senha", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader titulo="Meu Perfil" subtitulo="Gerencie seus dados de cadastro e segurança da conta" voltar={!trocaObrigatoria} />
      {trocaObrigatoria && <p className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Por segurança, defina uma nova senha para continuar usando o sistema.</p>}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-semibold">Informações Pessoais</h2>
            <p className="text-sm text-muted-foreground">Dados atuais da conta</p>
          </div>
          {editando ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDados(usuario);
                  setEditando(false);
                }}
              >
                Cancelar
              </Button>
              <Button loading={salvando} onClick={salvar}>
                Salvar
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
        </div>
        <EnderecoCampos valor={dados || {}} onChange={setDados} desabilitado={!editando} obrigatorio={usuario?.role === "CLIENTE"} />
        <p className="mt-2 text-xs text-muted-foreground">Endereço: dados usados para entregas e pedidos.</p>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Segurança</h2>
        <p className="mb-4 text-sm text-muted-foreground">Atualize sua senha de acesso</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {!usuario?.trocarSenha && (
            <Field label="Senha atual">
              <Input type="password" value={senhas.senhaAtual} onChange={(e) => setSenhas({ ...senhas, senhaAtual: e.target.value })} />
            </Field>
          )}
          <Field label="Nova senha">
            <Input type="password" value={senhas.novaSenha} onChange={(e) => setSenhas({ ...senhas, novaSenha: e.target.value })} placeholder="Mínimo 8 caracteres" />
          </Field>
          <Field label="Confirmar nova senha">
            <Input type="password" value={senhas.confirmacao} onChange={(e) => setSenhas({ ...senhas, confirmacao: e.target.value })} />
          </Field>
        </div>
        <Button className="mt-4" disabled={senhas.novaSenha.length < 8} onClick={trocarSenha}>
          Alterar Senha
        </Button>
      </Card>
    </div>
  );
}
