import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, CreditCard, KeyRound, Lock, Plus, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import api, { mensagemErro } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Switch, cx, useConfirm, useToast } from "../components/ui";
import { dataHora, moeda } from "../utils/format";

const LOGOS = {
  mercadopago: { sigla: "MP", cor: "bg-sky-500/15 text-sky-700" },
  sumup: { sigla: "SU", cor: "bg-slate-900 text-white" },
  stone: { sigla: "ST", cor: "bg-emerald-500/15 text-emerald-700" },
};

const CANAIS = [
  {
    chave: "online",
    titulo: "Pagamento online no site",
    descricao: "PIX com QR Code e cartão no checkout. A confirmação do banco libera o pedido sozinha.",
    detalhes: {
      mercadopago: "PIX com QR Code na tela e cartão na página do Mercado Pago. Confirmação por webhook.",
      sumup: "PIX com QR Code na tela e cartão na página da SumUp. Confirmação por consulta automática.",
    },
  },
  {
    chave: "maquininha",
    titulo: "Maquininha (venda presencial)",
    descricao: "A equipe envia a cobrança do pedido para a tela da maquininha e o sistema confirma sozinho.",
    detalhes: {
      mercadopago: "Maquininha Point em modo integrado.",
      sumup: "Maquininha SumUp pareada pela Cloud API.",
      stone: "Maquininha Stone (Stone Connect) pelo número de série.",
    },
  },
];

const Logo = ({ nome }) => (
  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black", LOGOS[nome]?.cor)}>{LOGOS[nome]?.sigla}</span>
);

function Canal({ canal, dados, onEscolher, salvando }) {
  const escolha = dados.canais[canal.chave];
  const atual = dados.emUso?.[canal.chave] || null;
  const automatico = dados.emUso?.[`${canal.chave}Automatico`];
  const opcoes = dados.provedores.filter((p) => p.canais.includes(canal.chave));
  return (
    <Card className="p-5">
      <h2 className="font-semibold">{canal.titulo}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{canal.descricao}</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {opcoes.map((p) => (
          <button
            key={p.nome}
            type="button"
            disabled={salvando}
            onClick={() => onEscolher(canal.chave, p.nome)}
            className={cx(
              "flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60",
              atual === p.nome ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "border-border bg-white hover:border-primary/40",
            )}
          >
            <Logo nome={p.nome} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                {p.rotulo}
                {atual === p.nome && <Badge variant="primary">{automatico ? "Em uso (automático)" : "Em uso"}</Badge>}
                {p.configurado ? <Badge variant="success">Configurado</Badge> : <Badge variant="warning">Sem credenciais</Badge>}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{canal.detalhes[p.nome]}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          disabled={salvando}
          onClick={() => onEscolher(canal.chave, null)}
          className={cx("rounded-xl border p-3 text-left text-sm transition", !escolha ? "border-primary bg-primary-soft" : "border-border bg-white hover:border-primary/40")}
        >
          <span className="font-semibold">Automático</span>
          <span className="block text-xs text-muted-foreground">Usa o banco que tiver credenciais (se houver mais de um, o cadastrado primeiro).</span>
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => onEscolher(canal.chave, "desligado")}
          className={cx("rounded-xl border p-3 text-left text-sm transition", escolha === "desligado" ? "border-primary bg-primary-soft" : "border-border bg-white hover:border-primary/40")}
        >
          <span className="font-semibold">Desligado</span>
          <span className="block text-xs text-muted-foreground">{canal.chave === "online" ? "Pedidos online seguem o fluxo manual (financeiro confirma)." : "Maquininha usada sem integração."}</span>
        </button>
      </div>
    </Card>
  );
}

function Credenciais({ provedor, onSalvo }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [valores, setValores] = useState(() => Object.fromEntries(provedor.campos.filter((c) => !c.secreto).map((c) => [c.chave, provedor.resumo[c.chave] || ""])));
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.put(`/pagamentos/config/credenciais/${provedor.nome}`, { valores });
      setValores((v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, provedor.campos.find((c) => c.chave === k)?.secreto ? "" : x])));
      toast({ titulo: `${provedor.rotulo} conectado`, descricao: "Credenciais testadas no banco e guardadas criptografadas." });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Não foi possível salvar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    const ok = await confirmar({ titulo: `Remover credenciais do ${provedor.rotulo}?`, mensagem: "O banco deixa de cobrar nos canais em que estava ativo.", perigo: true, confirmar: "Remover" });
    if (!ok) return;
    try {
      const { data } = await api.delete(`/pagamentos/config/credenciais/${provedor.nome}`);
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };

  const copiar = (texto) => navigator.clipboard.writeText(texto).then(() => toast({ titulo: "Endereço copiado" }));

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start gap-3">
        <Logo nome={provedor.nome} />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {provedor.rotulo}
            {provedor.configurado ? <Badge variant="success">Conectado{provedor.resumo.conta ? ` · ${provedor.resumo.conta}` : ""}</Badge> : <Badge variant="warning">Sem credenciais</Badge>}
          </h3>
          {provedor.validadoEm && (
            <p className="text-xs text-muted-foreground">
              Testado em {dataHora(provedor.validadoEm)} por {provedor.atualizadoPor}
            </p>
          )}
        </div>
      </div>
      <form onSubmit={salvar} className="space-y-3">
        {provedor.campos.map((c) => (
          <Field key={c.chave} label={c.rotulo} obrigatorio={c.obrigatorio && !provedor.configurado} dica={c.dica}>
            {c.opcoes ? (
              <Select value={valores[c.chave] ?? ""} onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}>
                {Object.entries(c.opcoes).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type={c.secreto ? "password" : "text"}
                autoComplete="off"
                className="font-mono"
                value={valores[c.chave] ?? ""}
                onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                placeholder={c.secreto && provedor.resumo[c.chave] ? `Salvo: ${provedor.resumo[c.chave]} — deixe em branco para manter` : ""}
              />
            )}
          </Field>
        ))}
        {provedor.webhookUrl && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <p className="mb-1 font-semibold">Endereço de notificação (webhook) para cadastrar no {provedor.rotulo}:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all">{provedor.webhookUrl}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => copiar(provedor.webhookUrl)}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={salvando}>
            <KeyRound className="h-4 w-4" /> {provedor.configurado ? "Salvar alterações" : "Testar e salvar"}
          </Button>
          {provedor.configurado && (
            <Button type="button" variant="danger-outline" onClick={remover}>
              Remover credenciais
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function NovaMaquininha({ dados, onFechar, onSalvo }) {
  const toast = useToast();
  const comMaquininha = dados.provedores.filter((p) => p.canais.includes("maquininha"));
  const [f, setF] = useState({ nome: "", provedor: dados.emUso?.maquininha || comMaquininha.find((p) => p.configurado)?.nome || comMaquininha[0]?.nome, identificador: "", codigo: "", readerId: "" });
  const [readers, setReaders] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const provedor = comMaquininha.find((p) => p.nome === f.provedor);
  const sumup = f.provedor === "sumup";

  useEffect(() => {
    if (!sumup) return;
    api
      .get("/pagamentos/config/sumup/readers")
      .then(({ data }) => setReaders(data))
      .catch(() => setReaders([]));
  }, [sumup]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data } = sumup
        ? await api.post("/pagamentos/config/sumup/parear", { nome: f.nome, codigo: f.codigo || undefined, readerId: f.readerId || undefined })
        : await api.post("/pagamentos/config/maquininhas", { nome: f.nome, provedor: f.provedor, identificador: f.identificador });
      toast({ titulo: "Maquininha cadastrada" });
      onSalvo(data);
    } catch (error) {
      toast({ titulo: "Não foi possível cadastrar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      aberto
      onFechar={onFechar}
      titulo="Nova maquininha"
      rodape={
        <>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button loading={salvando} disabled={!f.nome.trim() || (sumup ? !f.codigo.trim() && !f.readerId : !f.identificador.trim())} onClick={salvar}>
            Cadastrar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nome" obrigatorio>
          <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Balcão loja" autoFocus />
        </Field>
        <Field label="Banco">
          <Select value={f.provedor} onChange={(e) => setF({ ...f, provedor: e.target.value })}>
            {comMaquininha.map((p) => (
              <option key={p.nome} value={p.nome} disabled={!p.configurado}>
                {p.rotulo}
                {!p.configurado ? " (cadastre as credenciais antes)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">{provedor?.ajudaMaquininha}</p>
        {sumup ? (
          <>
            <Field label="Código de pareamento (aparece na maquininha)">
              <Input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase(), readerId: "" })} className="font-mono" />
            </Field>
            {readers?.length > 0 && (
              <Field label="Ou escolha uma já conectada à conta">
                <Select value={f.readerId} onChange={(e) => setF({ ...f, readerId: e.target.value, codigo: "" })}>
                  <option value="">—</option>
                  {readers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome || r.serial || r.id} {r.status ? `(${r.status})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        ) : (
          <Field label={f.provedor === "stone" ? "Número de série" : "Terminal ID"} obrigatorio>
            <Input value={f.identificador} onChange={(e) => setF({ ...f, identificador: e.target.value })} className="font-mono" />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

function Alertas() {
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const carregar = useCallback(() => api.get("/pedidos/alertas-pagamento").then(({ data }) => setLista(Array.isArray(data) ? data : data.itens || [])).catch(() => setLista([])), []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const resolver = async (id) => {
    try {
      await api.put(`/pedidos/alertas-pagamento/${id}/resolver`);
      carregar();
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  if (!lista) return <Skeleton className="h-20" />;
  if (!lista.length) return <p className="text-sm text-muted-foreground">Nenhum alerta de pagamento em aberto.</p>;
  return (
    <div className="space-y-2">
      {lista.map((a) => (
        <div key={a.id} className={cx("flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center", a.severidade === "critical" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50")}>
          <AlertTriangle className={cx("h-5 w-5 shrink-0", a.severidade === "critical" ? "text-red-600" : "text-amber-600")} />
          <div className="flex-1">
            <p className="font-medium">{a.mensagem}</p>
            <p className="text-xs text-muted-foreground">
              {a.provedor} · {dataHora(a.createdAt)}
              {a.valorEsperado != null && ` · esperado ${moeda(a.valorEsperado)}`}
              {a.valorRecebido != null && ` · recebido ${moeda(a.valorRecebido)}`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => resolver(a.id)}>
            Marcar resolvido
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function Pagamentos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();
  const [dados, setDados] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [novaMaq, setNovaMaq] = useState(false);

  useEffect(() => {
    api
      .get("/pagamentos/config")
      .then(({ data }) => setDados(data))
      .catch((e) => toast({ titulo: "Erro ao carregar", descricao: mensagemErro(e), tipo: "erro" }));
  }, [toast]);

  if (usuario?.role !== "ADMIN") return <p className="p-10 text-center text-muted-foreground">Só o administrador acessa os pagamentos.</p>;
  if (!dados) return <Skeleton className="m-6 h-96" />;

  const escolher = async (canal, nome) => {
    const rotulo = dados.provedores.find((p) => p.nome === nome)?.rotulo;
    const ok = await confirmar({
      titulo:
        nome === "desligado"
          ? "Desligar este canal?"
          : nome
            ? `Usar ${rotulo} para ${canal === "online" ? "o pagamento online" : "a maquininha"}?`
            : "Escolher o banco automaticamente?",
      mensagem:
        nome === "desligado"
          ? canal === "online"
            ? "PIX online e cartão online somem do checkout; os pedidos seguem pelo fluxo manual."
            : "A equipe deixa de enviar cobranças para a maquininha pelo sistema."
          : nome
            ? "Vale para os próximos pedidos."
            : "O sistema usa o banco que tiver credenciais cadastradas.",
      confirmar: nome === "desligado" ? "Desligar" : "Confirmar",
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const { data } = await api.put("/pagamentos/config/canais", { [canal]: nome });
      setDados(data);
      toast({ titulo: nome === "desligado" ? "Canal desligado" : nome ? `${rotulo} ativo` : "Escolha automática ligada" });
    } catch (error) {
      toast({ titulo: "Não foi possível trocar", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const atualizarMaq = async (m, mudancas) => {
    try {
      const { data } = await api.put(`/pagamentos/config/maquininhas/${m.id}`, mudancas);
      setDados(data);
    } catch (error) {
      toast({ titulo: "Erro", descricao: mensagemErro(error), tipo: "erro" });
    }
  };
  const removerMaq = async (m) => {
    const ok = await confirmar({ titulo: `Remover a maquininha "${m.nome}"?`, perigo: true, confirmar: "Remover" });
    if (!ok) return;
    const { data } = await api.delete(`/pagamentos/config/maquininhas/${m.id}`);
    setDados(data);
  };

  return (
    <div className="container-app max-w-6xl space-y-5 py-6">
      <PageHeader titulo="Pagamentos" subtitulo="Bancos que recebem os pagamentos da loja e confirmam os pedidos sozinhos." voltar={false}>
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao Financeiro
        </Button>
      </PageHeader>

      <div className={cx("flex items-start gap-3 rounded-lg border p-3 text-sm", dados.chavePropria ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900")}>
        {dados.chavePropria ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <Lock className="h-5 w-5 shrink-0" />}
        <p>
          As credenciais são testadas no banco antes de salvar e ficam <strong>criptografadas (AES-256-GCM)</strong> no servidor. Ninguém consegue vê-las de novo pelo sistema: o painel mostra só o
          começo e o fim. Só o administrador acessa esta aba, e cada alteração fica registrada.
          {!dados.chavePropria && (
            <span className="mt-1 block font-semibold">
              Recomendado: crie a variável CREDENCIAIS_SECRET (texto aleatório com 32+ caracteres) no backend da Render para a chave de criptografia ser exclusiva destas credenciais. Faça isso antes de
              cadastrar as chaves — depois de trocar, será preciso cadastrá-las de novo.
            </span>
          )}
        </p>
      </div>

      {CANAIS.map((c) => (
        <Canal key={c.chave} canal={c} dados={dados} onEscolher={escolher} salvando={salvando} />
      ))}

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="h-5 w-5 text-primary" /> Credenciais dos bancos
        </h2>
        <div className="grid gap-4 xl:grid-cols-3">
          {dados.provedores.map((p) => (
            <Credenciais key={`${p.nome}-${p.validadoEm}`} provedor={p} onSalvo={setDados} />
          ))}
        </div>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Smartphone className="h-5 w-5 text-primary" /> Maquininhas
          </h2>
          <Button size="sm" onClick={() => setNovaMaq(true)}>
            <Plus className="h-4 w-4" /> Nova maquininha
          </Button>
        </div>
        {!dados.maquininhas.length ? (
          <EmptyState icon={CreditCard} titulo="Nenhuma maquininha cadastrada" descricao="Cadastre para a equipe enviar a cobrança do pedido direto para a tela dela." />
        ) : (
          <div className="divide-y divide-border">
            {dados.maquininhas.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                <Logo nome={m.provedor} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.nome}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{m.identificador}</p>
                </div>
                {dados.emUso?.maquininha !== m.provedor && <Badge variant="warning">Banco não está ativo na maquininha</Badge>}
                <Switch checked={m.ativa !== false} onChange={(v) => atualizarMaq(m, { ativa: v })} />
                <Button size="icon" variant="ghost" onClick={() => removerMaq(m)} aria-label="Remover">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5 text-primary" /> Alertas de pagamento
        </h2>
        <Alertas />
      </Card>

      {novaMaq && (
        <NovaMaquininha
          dados={dados}
          onFechar={() => setNovaMaq(false)}
          onSalvo={(d) => {
            setNovaMaq(false);
            setDados(d);
          }}
        />
      )}
    </div>
  );
}
