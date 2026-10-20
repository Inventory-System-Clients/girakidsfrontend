import { useState } from "react";
import api from "../../services/api";

// Preenche as ferramentas do Comercial a partir de um pedido da própria loja
// Gira Kids (antes os dados eram copiados à mão da loja antiga).
export function CarregarPedidoLoja({ onCarregado, descricao }) {
  const [numero, setNumero] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const carregar = async (e) => {
    e?.preventDefault();
    if (!numero.trim()) return;
    setCarregando(true);
    setMensagem(null);
    try {
      const { data } = await api.get(`/comercial/pedidos/${numero.trim()}`);
      onCarregado(data);
      setMensagem({ tipo: "ok", texto: `Pedido ${data.numero} · ${data.clienteNome} carregado.` });
    } catch (err) {
      setMensagem({ tipo: "erro", texto: err.response?.data?.error || "Pedido não encontrado." });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <form onSubmit={carregar} className="mb-6 rounded-xl border border-primary/20 bg-primary-soft/60 p-4">
      <p className="text-sm font-semibold">🎡 Puxar de um pedido da loja</p>
      <p className="mb-3 text-xs text-muted-foreground">{descricao}</p>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-48" placeholder="Nº do pedido (ex.: 63037)" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <button type="submit" className="btn-primary py-2" disabled={carregando}>
          {carregando ? "Carregando..." : "Carregar pedido"}
        </button>
      </div>
      {mensagem && <p className={`mt-2 text-xs ${mensagem.tipo === "ok" ? "text-emerald-700" : "text-red-600"}`}>{mensagem.texto}</p>}
    </form>
  );
}
