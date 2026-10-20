import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "./ui";

// permissoes: telas internas aceitas (ADMIN passa sempre). Sem permissões =
// basta estar logado.
export default function PrivateRoute({ permissoes, children }) {
  const { usuario, carregando, pode } = useAuth();
  const location = useLocation();

  if (carregando && !usuario) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" state={{ de: location.pathname }} replace />;
  if (usuario.trocarSenha && location.pathname !== "/perfil") {
    return <Navigate to="/perfil" state={{ trocarSenha: true }} replace />;
  }
  if (permissoes?.length && !pode(...permissoes)) return <Navigate to="/" replace />;
  return children;
}
