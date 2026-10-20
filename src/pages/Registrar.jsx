import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Field, Input, useToast } from "../components/ui";
import EnderecoCampos from "../components/EnderecoCampos";

export default function Registrar() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [dados, setDados] = useState({ documentoTipo: "CPF" });
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (senha.length < 8) return setErro("Senha deve ter no mínimo 8 caracteres");
    if (senha !== confirmacao) return setErro("As senhas não coincidem");
    setErro("");
    setEnviando(true);
    const r = await registrar({ ...dados, senha });
    setEnviando(false);
    if (!r.success) return setErro(r.error);
    toast({ titulo: "Conta criada com sucesso!", descricao: "Bem-vindo ao sistema Gira Kids!" });
    navigate("/");
  };

  return (
    <div className="toy-pattern-bg flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Criar Nova Conta</h1>
        <p className="mb-6 text-sm text-muted-foreground">Preencha os dados abaixo para se cadastrar</p>
        <form onSubmit={enviar} className="space-y-4">
          <EnderecoCampos valor={dados} onChange={setDados} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Senha" obrigatorio>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </Field>
            <Field label="Confirmar Senha" obrigatorio>
              <Input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="Digite a senha novamente" />
            </Field>
          </div>
          {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" loading={enviando}>
            {enviando ? "Criando conta..." : "Criar Conta"}
          </Button>
          <Link to="/login" className="block text-center text-sm text-muted-foreground hover:underline">
            Voltar para Login
          </Link>
        </form>
      </Card>
    </div>
  );
}
