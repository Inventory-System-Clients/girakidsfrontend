import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, MessageCircle, QrCode, RotateCcw, Send, ShieldCheck } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, MetricCard, PageHeader, Skeleton, Textarea, cx, useToast } from "../components/ui";
import { dataHora } from "../utils/format";

// Avisos automáticos de pedido no WhatsApp (Evolution API).
const ETAPAS = [
  { id: "CRIADO", label: "Pedido recebido", dica: "Quando o cliente finaliza o pedido ou a equipe tira o pedido para ele." },
  { id: "PRONTO", label: "Pedido pronto", dica: "Quando a expedição conclui a montagem: pronto para retirada ou pronto para envio." },
  { id: "A_CAMINHO", label: "A caminho", dica: "Quando a expedição expede: coletado pela transportadora ou postado nos Correios. Retirada não recebe." },
];
const ROTULO_ETAPA = { CRIADO: "Recebido", PRONTO: "Pronto", A_CAMINHO: "A caminho" };

const TEXTOS = [
  { id: "CRIADO", etapa: "CRIADO", label: "Pedido recebido" },
  { id: "PRONTO_RETIRADA", etapa: "PRONTO", label: "Pronto · retirada na loja" },
  { id: "PRONTO_ENVIO", etapa: "PRONTO", label: "Pronto · envio (Correios ou transportadora)" },
  { id: "A_CAMINHO", etapa: "A_CAMINHO", label: "A caminho (coletado / postado)" },
];

const VARIAVEIS = [
  { chave: "nome", label: "Nome do cliente", exemplo: "Maria" },
  { chave: "pedido", label: "Número do pedido", exemplo: "#63120" },
  { chave: "envio", label: "Como vai (ex.: pela transportadora Rodonaves)", exemplo: "pela transportadora Rodonaves" },
  { chave: "rastreio", label: "Código de rastreio (a linha some se não houver)", exemplo: "AB123456789BR" },
  { chave: "endereco", label: "Endereço da loja", exemplo: "Avenida Cachoeira Paulista, 17" },
];

const ESTADOS = {
  open: { label: "Conectado", variant: "success" },
  connecting: { label: "Aguardando o QR Code", variant: "warning" },
  close: { label: "Desconectado", variant: "danger" },
  inexistente: { label: "Número ainda não conectado", variant: "default" },
  erro: { label: "Evolution API indisponível", variant: "danger" },
};

const STATUS_MENSAGEM = {
  FILA: { label: "Na fila", variant: "info" },
  ENVIANDO: { label: "Enviando", variant: "info" },
  ENVIADO: { label: "Enviada", variant: "success" },
  ERRO: { label: "Erro", variant: "danger" },
  DESCARTADA: { label: "Não enviada", variant: "default" },
};

const previa = (modelo) => VARIAVEIS.reduce((texto, v) => texto.replaceAll(`{${v.chave}}`, v.exemplo), String(modelo || ""));

// Negrito e itálico do WhatsApp (*texto*, _texto_) na prévia.
const Formatado = ({ texto }) =>
  texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((parte, i) =>
    /^\*.+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : /^_.+_$/.test(parte) ? <em key={i}>{parte.slice(1, -1)}</em> : parte,
  );

const telefoneBonito = (t) => {
  const d = String(t || "").replace(/^55/, "");
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : t;
};

export default function WhatsappAvisos() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [dados, setDados] = useState(null);
  // Só o que foi alterado; o resto vem da configuração salva.
  const [edicao, setEdicao] = useState({});
  const [qr, setQr] = useState(null);
  const [telefoneTeste, setTelefoneTeste] = useState("");
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(
    () =>
      api
        .get("/whatsapp/avisos")
        .then(({ data }) => setDados(data))
        .catch((e) => toast({ titulo: "Erro ao carregar", descricao: mensagemErro(e), tipo: "erro" })),
    [toast],
  );

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 15000);
    return () => clearInterval(id);
  }, [carregar]);

  if (usuario?.role !== "ADMIN") return <p className="p-10 text-center text-muted-foreground">Só o administrador configura os avisos no WhatsApp.</p>;
  if (!dados) return <Skeleton className="m-6 h-96" />;

  const { config, conexao, fila } = dados;
  const form = {
    evolutionUrl: config.evolutionUrl || "",
    instancia: config.instancia || "girakids",
    apiKey: "",
    intervaloSegundos: config.intervaloSegundos,
    etapas: config.etapas,
    textos: { ...config.textosPadrao, ...config.textos },
    ...edicao,
  };
  const editar = (mudanca) => setEdicao((e) => ({ ...e, ...mudanca }));
  const conectado = conexao?.estado === "open";
  const estado = ESTADOS[conexao?.estado] || (conexao?.configurado ? ESTADOS.erro : null);
  const alterado = Object.keys(edicao).length > 0;

  const executar = async (chave, acao, sucesso) => {
    setOcupado(chave);
    try {
      const resultado = await acao();
      if (sucesso) toast(typeof sucesso === "string" ? { titulo: sucesso } : sucesso);
      return resultado;
    } catch (error) {
      toast({ titulo: "Não foi possível concluir", descricao: mensagemErro(error), tipo: "erro" });
      return null;
    } finally {
      setOcupado("");
    }
  };

  const salvar = () =>
    executar(
      "salvar",
      async () => {
        await api.put("/whatsapp/avisos", {
          evolutionUrl: form.evolutionUrl,
          instancia: form.instancia,
          intervaloSegundos: Number(form.intervaloSegundos),
          etapas: form.etapas,
          textos: form.textos,
          ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
        });
        setEdicao({});
        await carregar();
      },
      "Configuração salva",
    );

  const alternarAtivo = () =>
    executar(
      "ativo",
      async () => {
        await api.put("/whatsapp/avisos", { ativo: !config.ativo });
        await carregar();
      },
      config.ativo ? "Avisos desligados" : "Avisos ligados",
    );

  const conectar = () =>
    executar("conectar", async () => {
      const { data } = await api.post("/whatsapp/avisos/conectar");
      if (data.estado === "open") toast({ titulo: "O número já está conectado", descricao: "O retorno das respostas (SAIR) foi configurado." });
      setQr(data.qrBase64 ? data : null);
      await carregar();
    });

  const enviarTeste = () => executar("teste", () => api.post("/whatsapp/avisos/teste", { telefone: telefoneTeste }), { titulo: "Mensagem de teste enviada" });

  const reenviar = (m) =>
    executar(
      `reenviar-${m.id}`,
      async () => {
        await api.post(`/whatsapp/avisos/mensagens/${m.id}/reenviar`);
        await carregar();
      },
      "Aviso de volta na fila",
    );

  const alternarEtapa = (id) => editar({ etapas: form.etapas.includes(id) ? form.etapas.filter((e) => e !== id) : [...form.etapas, id] });

  return (
    <div className="container-app max-w-6xl space-y-5 py-6">
      <PageHeader titulo="Avisos no WhatsApp" subtitulo="Mensagens automáticas para o cliente: pedido recebido, pronto e a caminho." />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className={cx("flex h-11 w-11 items-center justify-center rounded-xl", config.ativo ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
            <MessageCircle className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-semibold">{config.ativo ? "Avisos ligados" : "Avisos desligados"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {estado && <Badge variant={estado.variant}>WhatsApp: {estado.label}</Badge>}
              {config.apiKeyConfigurada && <Badge variant="outline">Chave salva ✓</Badge>}
            </div>
            {fila?.pausa && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4" /> {fila.pausa}
              </p>
            )}
            {conexao?.erro && <p className="mt-1 text-xs text-red-600">{conexao.erro}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={ocupado === "conectar"} disabled={!conexao?.configurado} onClick={conectar}>
            <QrCode className="h-4 w-4" /> {conectado ? "Reconectar / atualizar retorno" : "Conectar número"}
          </Button>
          <Button variant={config.ativo ? "danger-outline" : "success"} loading={ocupado === "ativo"} onClick={alternarAtivo}>
            {config.ativo ? "Desligar avisos" : "Ligar avisos"}
          </Button>
        </div>
      </Card>

      {qr && !conectado && (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="font-semibold">No celular do número dos avisos: WhatsApp → Aparelhos conectados → Conectar um aparelho</p>
          <img src={qr.qrBase64} alt="QR Code do WhatsApp" className="h-64 w-64" />
          {qr.pairingCode && (
            <p className="text-sm text-muted-foreground">
              Ou use o código: <strong className="font-mono">{qr.pairingCode}</strong>
            </p>
          )}
          <p className="text-xs text-muted-foreground">Esta tela atualiza sozinha quando o número conectar.</p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Evolution API</h2>
          <Field label="URL do servidor">
            <Input className="font-mono" autoComplete="off" placeholder="https://evolution.seudominio.com" value={form.evolutionUrl} onChange={(e) => editar({ evolutionUrl: e.target.value })} />
          </Field>
          <Field label="Chave (apikey)" dica="Fica criptografada no servidor e nunca volta para a tela.">
            <Input
              type="password"
              autoComplete="new-password"
              className="font-mono"
              placeholder={config.apiKeyConfigurada ? "Chave salva ✓ — deixe em branco para manter" : "Cole a chave da Evolution"}
              value={form.apiKey}
              onChange={(e) => editar({ apiKey: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Instância">
              <Input className="font-mono" value={form.instancia} onChange={(e) => editar({ instancia: e.target.value })} />
            </Field>
            <Field label="Intervalo entre mensagens (s)" dica="Mínimo 8; varia ±30% para não parecer disparo.">
              <Input type="number" min={8} max={600} value={form.intervaloSegundos} onChange={(e) => editar({ intervaloSegundos: e.target.value })} />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Quais avisos enviar</p>
            <div className="space-y-2">
              {ETAPAS.map((e) => (
                <Checkbox key={e.id} className="rounded-lg bg-muted/50 p-3" checked={form.etapas.includes(e.id)} onChange={() => alternarEtapa(e.id)} label={e.label} descricao={e.dica} />
              ))}
            </div>
          </div>
          <Button className="w-full" loading={ocupado === "salvar"} disabled={!alterado} onClick={salvar}>
            Salvar configuração
          </Button>
          {config.atualizadoPor && (
            <p className="text-center text-xs text-muted-foreground">
              Última alteração: {config.atualizadoPor} · {dataHora(config.atualizadoEm)}
            </p>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Enviar teste</h2>
            <div className="flex gap-2">
              <Input placeholder="(11) 98765-4321" value={telefoneTeste} onChange={(e) => setTelefoneTeste(e.target.value)} />
              <Button className="shrink-0" loading={ocupado === "teste"} disabled={!conectado || !telefoneTeste.trim()} onClick={enviarTeste}>
                <Send className="h-4 w-4" /> Enviar
              </Button>
            </div>
            {!conectado && <p className="text-xs text-muted-foreground">Conecte o número para enviar o teste.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Fila de avisos</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard titulo="Na fila" valor={fila.naFila} />
              <MetricCard titulo="Enviadas (24h)" valor={fila.enviadas24h} />
              <MetricCard titulo="Erros (24h)" valor={fila.erros24h} />
              <MetricCard titulo="Pediram SAIR" valor={fila.sairam} />
            </div>
            {!fila.recentes.length ? (
              <EmptyState icon={MessageCircle} titulo="Nenhum aviso ainda" descricao="Os avisos aparecem aqui assim que os pedidos andarem." />
            ) : (
              <ul className="mt-3 max-h-[420px] divide-y divide-border overflow-y-auto text-sm">
                {fila.recentes.map((m) => {
                  const st = STATUS_MENSAGEM[m.status] || { label: m.status, variant: "default" };
                  return (
                    <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          #{m.pedidoNumero} · {ROTULO_ETAPA[m.etapa] || m.etapa} <span className="font-normal text-muted-foreground">· {m.clienteNome}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {telefoneBonito(m.telefone)} · {dataHora(m.enviadoEm || m.updatedAt)}
                        </p>
                        {m.erro && <p className="text-xs text-red-600">{m.erro}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {["ERRO", "DESCARTADA"].includes(m.status) && (
                          <Button size="icon" variant="ghost" title="Reenviar" loading={ocupado === `reenviar-${m.id}`} onClick={() => reenviar(m)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Mensagens</h2>
          <p className="text-sm text-muted-foreground">
            Edite o texto de cada aviso. Clique numa variável para colocá-la no fim do texto. O aviso &quot;responda SAIR&quot; vai sempre no final. Use *texto* para negrito.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {TEXTOS.map((t) => {
            const texto = form.textos[t.id] ?? "";
            const padrao = config.textosPadrao[t.id] ?? "";
            const setTexto = (valor) => editar({ textos: { ...form.textos, [t.id]: valor } });
            return (
              <div key={t.id} className="space-y-2 rounded-xl bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {t.label}
                    {!form.etapas.includes(t.etapa) && <span className="ml-2 text-xs font-normal text-muted-foreground">(desligado)</span>}
                  </p>
                  {texto !== padrao && (
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setTexto(padrao)}>
                      Restaurar padrão
                    </button>
                  )}
                </div>
                <Textarea rows={6} maxLength={1000} className="text-sm" value={texto} onChange={(e) => setTexto(e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  {VARIAVEIS.map((v) => (
                    <button
                      key={v.chave}
                      type="button"
                      title={v.label}
                      onClick={() => setTexto(`${texto}{${v.chave}}`)}
                      className="rounded-full border border-border bg-white px-2.5 py-0.5 font-mono text-xs hover:border-primary"
                    >
                      {`{${v.chave}}`}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg bg-[#dcf8c6] px-3 py-2 text-sm text-slate-800 shadow-sm">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prévia</p>
                  <p className="whitespace-pre-line">
                    <Formatado texto={previa(texto)} />
                  </p>
                  <p className="mt-2 whitespace-pre-line text-xs">
                    <Formatado texto={config.rodape} />
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <Button loading={ocupado === "salvar"} disabled={!alterado} onClick={salvar}>
          Salvar mensagens
        </Button>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <ShieldCheck className="h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p>
            A chave da Evolution fica <strong>criptografada (AES-256-GCM)</strong> no servidor e só o administrador acessa esta tela.
          </p>
          <p>
            <CheckCircle2 className="mr-1 inline h-4 w-4 align-[-3px]" />O cliente que responder <strong>SAIR</strong> para de receber na hora (e recebe uma confirmação); responder <strong>VOLTAR</strong> liga de
            novo. Dá para ligar ou desligar também no cadastro do cliente (Gerenciar Usuários) e no Meu Perfil dele.
          </p>
          <p>
            <Lock className="mr-1 inline h-4 w-4 align-[-3px]" />
            Só recebe quem tem celular válido com WhatsApp no cadastro (ou no pedido). Aviso parado mais de 12h na fila não é enviado atrasado.
          </p>
        </div>
      </div>
    </div>
  );
}
