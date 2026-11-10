import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import api, { mensagemErro } from "../../services/api";
import { Badge, Button, Dialog, Field, Input, Spinner, Switch, useToast } from "../ui";
import { BotaoWhatsapp } from "../Whatsapp";
import { Miniatura, ProdutoBusca } from "./comum";

// Login do fornecedor no portal (só os pré-recebimentos dele, sem valores) e
// os itens que ele traz (os únicos que aparecem para ele).
export default function AcessoFornecedor({ fornecedor, onFechar }) {
  const [acesso, setAcesso] = useState(null);
  const [email, setEmail] = useState(fornecedor.email || "");
  const [ativo, setAtivo] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [senha, setSenha] = useState(null);
  const [salvandoLogin, setSalvandoLogin] = useState(false);
  const [salvandoItens, setSalvandoItens] = useState(false);
  const toast = useToast();

  const aplicar = (d) => {
    setAcesso(d);
    setProdutos(d.produtos);
    if (d.usuario) {
      setEmail(d.usuario.email);
      setAtivo(d.usuario.ativo);
    }
  };
  useEffect(() => {
    api
      .get(`/recebimentos/fornecedores/${fornecedor.id}/acesso`)
      .then(({ data }) => aplicar(data))
      .catch((e) => toast({ titulo: "Erro ao carregar", descricao: mensagemErro(e), tipo: "erro" }));
  }, [fornecedor.id, toast]);

  const salvarLogin = async (novaSenha = false) => {
    setSalvandoLogin(true);
    try {
      const { data } = await api.put(`/recebimentos/fornecedores/${fornecedor.id}/acesso`, { email, ativo, novaSenha });
      aplicar(data);
      if (data.senha) setSenha(data.senha);
      toast({ titulo: data.senha ? "Login pronto: envie a senha ao fornecedor" : "Login atualizado" });
    } catch (e) {
      toast({ titulo: "Não foi possível salvar o login", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setSalvandoLogin(false);
    }
  };

  const salvarItens = async () => {
    setSalvandoItens(true);
    try {
      const { data } = await api.put(`/recebimentos/fornecedores/${fornecedor.id}/produtos`, { produtoIds: produtos.map((p) => p.id) });
      aplicar(data);
      toast({ titulo: "Itens do fornecedor salvos" });
    } catch (e) {
      toast({ titulo: "Não foi possível salvar os itens", descricao: mensagemErro(e), tipo: "erro" });
    } finally {
      setSalvandoItens(false);
    }
  };

  const linkPortal = `${window.location.origin}/login`;
  const mensagem = `Olá! Aqui é da Gira Kids. Seu acesso ao portal do fornecedor: ${linkPortal}\nE-mail: ${email}\nSenha provisória: ${senha}\nNo primeiro acesso você cria sua senha.`;
  const itensMudaram = acesso && JSON.stringify(produtos.map((p) => p.id).sort()) !== JSON.stringify(acesso.produtos.map((p) => p.id).sort());

  return (
    <Dialog aberto onFechar={onFechar} tamanho="lg" titulo={`Portal do fornecedor · ${fornecedor.nome}`} descricao="O fornecedor entra com o próprio login e vê só os pré-recebimentos dele, sem nenhum valor. Ele cria pré-recebimentos apenas dos itens liberados abaixo.">
      {!acesso ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <KeyRound className="h-4 w-4 text-primary" /> Login
              {acesso.usuario ? <Badge variant={acesso.usuario.ativo ? "success" : "default"}>{acesso.usuario.ativo ? "Ativo" : "Bloqueado"}</Badge> : <Badge>Sem login</Badge>}
              {acesso.usuario?.trocarSenha && <Badge variant="warning">Ainda não criou a senha</Badge>}
            </h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="E-mail de acesso">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fornecedor@empresa.com" />
              </Field>
              {acesso.usuario && <Switch label="Login ativo" checked={ativo} onChange={setAtivo} />}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button loading={salvandoLogin} disabled={!email.trim()} onClick={() => salvarLogin(false)}>
                {acesso.usuario ? "Salvar login" : "Criar login"}
              </Button>
              {acesso.usuario && (
                <Button variant="outline" disabled={salvandoLogin} onClick={() => salvarLogin(true)}>
                  Gerar nova senha provisória
                </Button>
              )}
            </div>
            {senha && (
              <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p>
                  Senha provisória: <b className="font-mono text-base">{senha}</b> (aparece só agora). No primeiro acesso o fornecedor cria a senha dele.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(mensagem).then(() => toast({ titulo: "Mensagem copiada" }))}>
                    <Copy className="h-4 w-4" /> Copiar acesso
                  </Button>
                  {fornecedor.telefone && (
                    <BotaoWhatsapp telefone={fornecedor.telefone} texto={mensagem}>
                      Enviar no WhatsApp
                    </BotaoWhatsapp>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Itens que este fornecedor traz ({produtos.length})</h3>
            <ProdutoBusca placeholder="Adicionar item pelo nome ou SKU..." excluir={produtos.map((p) => p.id)} onEscolher={(p) => setProdutos([...produtos, { id: p.id, nome: p.nome, sku: p.sku, imagemUrl: p.imagemUrl }].sort((a, b) => a.nome.localeCompare(b.nome)))} />
            {!produtos.length ? (
              <p className="text-sm text-muted-foreground">Nenhum item liberado: o fornecedor não consegue criar pré-recebimento.</p>
            ) : (
              <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {produtos.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <Miniatura src={p.imagemUrl} className="h-8 w-8" />
                    <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{p.sku}</span>
                    <Button size="icon" variant="ghost" onClick={() => setProdutos(produtos.filter((x) => x.id !== p.id))} aria-label={`Tirar ${p.nome}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant={itensMudaram ? "primary" : "outline"} loading={salvandoItens} disabled={!itensMudaram} onClick={salvarItens}>
              Salvar itens
            </Button>
          </section>
        </div>
      )}
    </Dialog>
  );
}
