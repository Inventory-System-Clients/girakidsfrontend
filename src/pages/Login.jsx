import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Dialog, Field, Input } from "../components/ui";
import { BotaoWhatsapp, IconeWhatsapp, linkWhatsapp, useWhatsappComercial } from "../components/Whatsapp";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [esqueceu, setEsqueceu] = useState(false);
  const whatsapp = useWhatsappComercial();
  const textoSenha = `Olá! Esqueci a senha de acesso ao catálogo Gira Kids${email ? ` (email: ${email})` : ""}. Podem me ajudar a alterar?`;

  const entrar = async (e) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const r = await login(email, senha);
    setEnviando(false);
    if (!r.success) return setErro(r.error);
    if (r.usuario.role === "FORNECEDOR") return navigate("/fornecedor/portal", { replace: true });
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
          <div className="-mt-2 text-right">
            <button type="button" onClick={() => setEsqueceu(true)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
              <KeyRound className="h-3.5 w-3.5" />
              Esqueceu a senha?
            </button>
          </div>
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

      <Dialog aberto={esqueceu} onFechar={() => setEsqueceu(false)} titulo="Esqueceu a senha?" tamanho="sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <a
            href={linkWhatsapp(whatsapp, textoSenha)}
            target="_blank"
            rel="noreferrer"
            aria-label="Falar conosco no WhatsApp"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md transition hover:scale-105"
          >
            <IconeWhatsapp className="h-9 w-9" />
          </a>
          <p className="text-base">Entre em contato conosco aqui que alteramos sua senha rapidinho!</p>
          <BotaoWhatsapp
            telefone={whatsapp}
            texto={textoSenha}
            className="w-full py-2.5"
          >
            Falar no WhatsApp
          </BotaoWhatsapp>
        </div>
      </Dialog>
    </div>
  );
}
