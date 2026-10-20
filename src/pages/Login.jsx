import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Field, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const r = await login(email, senha);
    setEnviando(false);
    if (!r.success) return setErro(r.error);
    navigate(r.usuario.trocarSenha ? "/perfil" : location.state?.de || "/", { replace: true });
  };

  return (
    <div className="toy-pattern-bg flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <img src="/logo.webp" alt="Gira Kids" className="mx-auto h-20 w-20 object-contain" />
          <h1 className="mt-3 text-2xl font-bold">Acesso ao Sistema</h1>
          <p className="text-sm text-muted-foreground">Catálogo Digital de Brinquedos Gira Kids</p>
        </div>
        <form onSubmit={entrar} className="space-y-4">
          <Field label="Email">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Senha" dica={senha && senha.length < 8 ? "A senha deve ter mais de 8 caracteres" : undefined}>
            <div className="relative">
              <Input type={ver ? "text" : "password"} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              <button type="button" className="absolute top-2.5 right-3 text-muted-foreground" onClick={() => setVer(!ver)} aria-label="Mostrar senha">
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" loading={enviando}>
            Entrar no Sistema
          </Button>
          <Link to="/registrar" className="block">
            <Button type="button" variant="outline" className="w-full">
              Criar Nova Conta
            </Button>
          </Link>
          <Link to="/" className="block text-center text-sm text-muted-foreground hover:underline">
            Voltar
          </Link>
        </form>
      </Card>
    </div>
  );
}
