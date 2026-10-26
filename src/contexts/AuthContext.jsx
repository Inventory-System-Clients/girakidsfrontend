import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { mensagemErro } from "../services/api";

const AuthContext = createContext({});

// Telas internas (mesmas opções do cadastro de funcionário).
export const TELAS = {
  FINANCEIRO: { label: "Time Financeiro", rota: "/dashboard", descricao: "Acesso aos indicadores e às visões consolidadas do negócio." },
  CHECKOUT: { label: "Checkout", rota: "/checkout", descricao: "Permite montar pedidos e usar o fluxo interno de checkout." },
  VENDAS: { label: "Time de Vendas", rota: "/historico-pedidos", descricao: "Permite consultar pedidos e operar o histórico administrativo." },
  EXPEDICAO: { label: "Time Expedição", rota: "/expedicao", descricao: "Permite acompanhar a separação, a montagem e a expedição dos pedidos." },
  PRODUTOS: { label: "Gerenciar Produtos", rota: "/produtos", descricao: "Permite consultar e operar a gestão de produtos e estoque." },
  ENTRADAS: { label: "Entradas", rota: "/entradas", descricao: "Resumo de entradas: fornecedores, entregas e histórico de custos (abre também pela aba Recebimentos)." },
  ORCAMENTOS: { label: "Orçamentos", rota: "/orcamentos", descricao: "Permite gerar orçamentos usando o fluxo administrativo dedicado." },
  USUARIOS: { label: "Gerenciar Usuários", rota: "/usuarios", descricao: "Permite acessar a gestão de usuários dentro do escopo delegado." },
  COMERCIAL: { label: "Comercial", rota: "/comercial/correios", descricao: "Transportadoras, calculadora de pedidos, notas fiscais e Correios." },
  RECEBIMENTOS: { label: "Recebimentos", rota: "/recebimentos", descricao: "Pré-recebimentos com link para o fornecedor, conferência, montagem em cápsula e compra de cápsulas." },
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
      return null;
    }
  });
  const [carregando, setCarregando] = useState(Boolean(localStorage.getItem("token")));

  const salvar = (token, dados) => {
    if (token) localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(dados));
    setUsuario(dados);
  };

  // Revalida o usuário salvo (permissões podem ter mudado).
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api
      .get("/auth/perfil")
      .then(({ data }) => salvar(null, data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const login = async (email, senha) => {
    try {
      const { data } = await api.post("/auth/login", { email, senha });
      salvar(data.token, data.usuario);
      return { success: true, usuario: data.usuario };
    } catch (error) {
      return { success: false, error: mensagemErro(error, "Erro ao fazer login") };
    }
  };

  const registrar = async (dados) => {
    try {
      const { data } = await api.post("/auth/registrar", dados);
      salvar(data.token, data.usuario);
      return { success: true };
    } catch (error) {
      return { success: false, error: mensagemErro(error, "Erro ao criar conta") };
    }
  };

  const atualizarUsuario = useCallback((dados) => salvar(null, dados), []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
  };

  const interno = usuario?.role === "ADMIN" || usuario?.role === "FUNCIONARIO";
  // Totem do showroom: tira pedidos para clientes, sem telas internas.
  const showroom = usuario?.role === "SHOWROOM";
  const tiraPedido = interno || showroom;
  const pode = useCallback(
    (...permissoes) => {
      if (!usuario) return false;
      if (usuario.role === "ADMIN") return true;
      if (usuario.role !== "FUNCIONARIO") return false;
      return permissoes.some((p) => (usuario.permissoes || []).includes(p));
    },
    [usuario],
  );

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, login, registrar, logout, atualizarUsuario, interno, showroom, tiraPedido, pode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
