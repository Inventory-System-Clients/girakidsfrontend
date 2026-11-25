import { useState } from "react";
import QRCode from "qrcode";
import { Copy, ShieldCheck, ShieldAlert } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Button, Card, Field, Input, useToast } from "./ui";

// Verificação em duas etapas (app autenticador). Obrigatória para ADMIN;
// qualquer conta pode ativar.
function CodigosRecuperacao({ codigos, onFechar }) {
  const toast = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
      toast({ titulo: "Códigos copiados" });
    } catch {
      toast({ titulo: "Não foi possível copiar", descricao: "Anote os códigos à mão.", tipo: "erro" });
    }
  };
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">Guarde estes códigos de recuperação</p>
      <p className="mb-3 text-sm text-amber-800">
        Cada um entra uma única vez se você perder o celular. Eles não aparecem de novo: copie e guarde num lugar seguro (fora do computador da loja).
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
        {codigos.map((c) => (
          <span key={c} className="rounded bg-white px-2 py-1 text-center">
            {c}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copiar}>
          <Copy className="h-4 w-4" /> Copiar
        </Button>
        <Button size="sm" onClick={onFechar}>
          Já guardei
        </Button>
      </div>
    </div>
  );
}

export default function SegurancaMfa() {
  const { usuario, atualizarSessao } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState(null); // { segredo, qr }
  const [codigo, setCodigo] = useState("");
  const [codigos, setCodigos] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [gerarNovos, setGerarNovos] = useState(false);
  const obrigatorio = usuario?.role === "ADMIN";

  const iniciar = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post("/auth/mfa/iniciar");
      const qr = await QRCode.toDataURL(data.url, { width: 220, margin: 1 });
      setConfig({ segredo: data.segredo, qr });
      setCodigo("");
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  const ativar = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post("/auth/mfa/ativar", { codigo });
      // As sessões antigas caem; esta segue com o token novo.
      atualizarSessao(data.token, data.usuario);
      setConfig(null);
      setCodigo("");
      setCodigos(data.codigosRecuperacao);
      toast({ titulo: "Verificação em duas etapas ativada" });
    } catch (error) {
      toast({ titulo: "Não foi possível ativar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  const novosCodigos = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post("/auth/mfa/codigos", { codigo });
      setCodigos(data.codigosRecuperacao);
      setGerarNovos(false);
      setCodigo("");
      atualizarSessao(null, { ...usuario, mfaCodigosRestantes: data.codigosRecuperacao.length });
    } catch (error) {
      toast({ titulo: "Não foi possível gerar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className="mb-6 p-5" id="duas-etapas">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {usuario?.mfaAtivo ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
            Verificação em duas etapas
          </h2>
          <p className="text-sm text-muted-foreground">
            Além da senha, o login pede um código do app autenticador do seu celular (Google Authenticator, Microsoft Authenticator ou Authy).
            {obrigatorio && " Obrigatória para administradores."}
          </p>
        </div>
        <Badge variant={usuario?.mfaAtivo ? "success" : "warning"}>{usuario?.mfaAtivo ? "Ativa" : "Desativada"}</Badge>
      </div>

      {codigos && <CodigosRecuperacao codigos={codigos} onFechar={() => setCodigos(null)} />}

      {!usuario?.mfaAtivo && !config && (
        <Button onClick={iniciar} loading={enviando}>
          Configurar agora
        </Button>
      )}

      {!usuario?.mfaAtivo && config && (
        <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
          <img src={config.qr} alt="QR code para o app autenticador" className="h-44 w-44 rounded-lg border border-border" />
          <div className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Instale um app autenticador no celular.</li>
              <li>No app, toque em adicionar e leia o QR code ao lado.</li>
              <li>Digite abaixo o código de 6 dígitos que aparecer.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Sem câmera? Digite esta chave no app: <span className="font-mono break-all text-foreground">{config.segredo}</span>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Código do app" className="w-40">
                <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Button onClick={ativar} loading={enviando} disabled={codigo.length !== 6}>
                Ativar
              </Button>
            </div>
          </div>
        </div>
      )}

      {usuario?.mfaAtivo && !codigos && (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Códigos de recuperação restantes: <strong className="text-foreground">{usuario.mfaCodigosRestantes ?? "-"}</strong>
          </p>
          {gerarNovos ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Código atual do app" className="w-40">
                <Input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Button onClick={novosCodigos} loading={enviando} disabled={codigo.length !== 6}>
                Gerar novos códigos
              </Button>
              <Button variant="ghost" onClick={() => setGerarNovos(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setGerarNovos(true)}>
              Gerar novos códigos de recuperação
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Trocou de celular ou perdeu o app? Peça a outro administrador para resetar a verificação em Gerenciar Usuários.</p>
        </div>
      )}
    </Card>
  );
}
