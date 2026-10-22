import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Globe, Search, Sparkles, Truck } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Field, Input, Skeleton, Textarea, cx, useToast } from "../ui";
import { BotaoWhatsapp } from "../Whatsapp";
import { UFS, contemTexto, numero } from "../../utils/format";

// Equipe escolhendo "Transportadora" no checkout: sugere as que atendem a UF
// do cliente (planilha interna + Parceiros + já usadas para o estado) e
// permite buscar na web com IA, como na aba Comercial → Transportadoras.
// cotacao = { numero, com } — opcionais, ficam junto da transportadora no pedido.
export default function SeletorTransportadora({ uf, cidade, pesoGramas, selecionada, onSelecionar, observacao, onObservacao, cotacao, onCotacao }) {
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [verOutras, setVerOutras] = useState(false);
  const [web, setWeb] = useState(null);
  const [buscandoWeb, setBuscandoWeb] = useState(false);

  useEffect(() => {
    setWeb(null);
    if (!uf) return setDados(null);
    setDados(undefined);
    api
      .get("/checkout/transportadoras", { params: { uf } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados({ atendem: [], outras: [] }));
  }, [uf]);

  const filtrar = (lista) => {
    return filtro.trim() ? lista.filter((x) => contemTexto(x.nome, filtro)) : lista;
  };
  const atendem = useMemo(() => filtrar(dados?.atendem || []), [dados, filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  const outras = useMemo(() => filtrar(dados?.outras || []), [dados, filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const buscarWeb = async () => {
    setBuscandoWeb(true);
    try {
      const { data } = await api.post("/checkout/transportadoras/ia", {
        estadoDestino: uf,
        cidadeDestino: cidade || UFS[uf],
        peso: pesoGramas ? numero(pesoGramas / 1000, 1) : "",
      });
      setWeb(data);
    } catch (error) {
      toast({ titulo: "Não foi possível buscar na web", descricao: mensagemErro(error), tipo: "erro" });
    } finally {
      setBuscandoWeb(false);
    }
  };

  const ehSelecionada = (t) => selecionada && ((t.id && t.id === selecionada.id) || (!t.id && t.nome === selecionada.nome));

  const Cartao = ({ t }) => (
    <button
      type="button"
      onClick={() => onSelecionar(ehSelecionada(t) ? null : t)}
      className={cx(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
        ehSelecionada(t) ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "border-border bg-white hover:border-primary/40",
      )}
    >
      {ehSelecionada(t) ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Truck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{t.nome}</span>
          {t.vezesNoEstado > 0 && <Badge variant="success">Já usada {t.vezesNoEstado}x para {uf}</Badge>}
          {t.cadastrada ? <Badge variant="info">Cadastrada</Badge> : t.origem === "web" ? <Badge variant="primary">Web</Badge> : <Badge>Planilha</Badge>}
        </span>
        <span className="block text-xs text-muted-foreground">
          {[t.telefone, t.whatsapp && `WhatsApp ${t.whatsapp}`, t.abrangencia && `Atende: ${t.abrangencia}`, t.cidadeBase && `Base: ${t.cidadeBase}`].filter(Boolean).join(" · ")}
        </span>
        {t.motivo && <span className="block text-xs text-muted-foreground">{t.motivo}</span>}
      </span>
    </button>
  );

  if (!uf) {
    return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Preencha o estado (UF) do cliente para ver as transportadoras que atendem o endereço.</p>;
  }

  const listaWeb = (web?.transportadoras || []).map((t) => ({
    id: null,
    nome: t.nome,
    telefone: t.telefone,
    whatsapp: t.whatsapp,
    cidadeBase: t.cidadeBase,
    motivo: t.motivoRelevancia,
    origem: "web",
    observacao: [t.motivoRelevancia, t.fonte && `Fonte: ${t.fonte}`].filter(Boolean).join(" · "),
  }));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Transportadoras que atendem {cidade ? `${cidade}/` : ""}
          {uf}
        </p>
        <Button size="sm" variant="secondary" loading={buscandoWeb} onClick={buscarWeb}>
          <Sparkles className="h-4 w-4" /> {buscandoWeb ? "Buscando na web..." : "Buscar na web com IA"}
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <input className="input h-9 bg-white pl-9" placeholder="Filtrar pelo nome..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      {dados === undefined && <Skeleton className="h-24" />}
      {dados && (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {atendem.map((t) => (
            <Cartao key={t.id || t.nome} t={t} />
          ))}
          {!atendem.length && <p className="text-sm text-muted-foreground">Nenhuma transportadora da planilha/cadastro atende {uf}. Use a busca na web.</p>}
        </div>
      )}
      {outras.length > 0 && (
        <div>
          <button type="button" className="text-xs text-primary underline" onClick={() => setVerOutras(!verOutras)}>
            {verOutras ? "Ocultar" : "Ver"} outras transportadoras cadastradas ({outras.length})
          </button>
          {verOutras && (
            <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
              {outras.map((t) => (
                <Cartao key={t.id || t.nome} t={t} />
              ))}
            </div>
          )}
        </div>
      )}
      {web && (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-violet-800">
            <Globe className="h-3.5 w-3.5" /> Encontradas na web
          </p>
          {web.resumo && <p className="text-xs text-muted-foreground">{web.resumo}</p>}
          {listaWeb.map((t) => (
            <Cartao key={`web-${t.nome}`} t={t} />
          ))}
        </div>
      )}
      {selecionada && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-white p-3">
          <p className="text-sm">
            Selecionada: <strong>{selecionada.nome}</strong>
            {!selecionada.id && <span className="text-xs text-muted-foreground"> — será cadastrada em Parceiros ao salvar</span>}
          </p>
          {(selecionada.whatsapp || selecionada.telefone) && (
            <BotaoWhatsapp variante="contorno" className="py-1 text-xs" telefone={selecionada.whatsapp || selecionada.telefone} texto="Olá! Aqui é da Gira Kids, gostaria de cotar um frete.">
              Chamar no WhatsApp
            </BotaoWhatsapp>
          )}
          {onCotacao && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nº da cotação (opcional)">
                <Input value={cotacao?.numero || ""} maxLength={60} onChange={(e) => onCotacao({ ...cotacao, numero: e.target.value })} placeholder="Ex.: 458712" />
              </Field>
              <Field label="Cotação feita com (opcional)">
                <Input value={cotacao?.com || ""} maxLength={150} onChange={(e) => onCotacao({ ...cotacao, com: e.target.value })} placeholder="Nome de quem passou a cotação" />
              </Field>
            </div>
          )}
          <Field label="Observações para a transportadora (aparecem na expedição)">
            <Textarea rows={2} value={observacao} onChange={(e) => onObservacao(e.target.value)} placeholder="Ex.: coleta combinada para quinta" />
          </Field>
        </div>
      )}
    </div>
  );
}
