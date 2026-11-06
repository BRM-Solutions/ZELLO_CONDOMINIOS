import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres"),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { session, signInWithPassword, signInWithMagicLink } = useAuth();
  const location = useLocation();
  const [magicSent, setMagicSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await signInWithPassword(email, password);
    } catch {
      toast.error("E-mail ou senha incorretos");
    }
  });

  const onMagicLink = async () => {
    if (!(await trigger("email"))) return;
    try {
      await signInWithMagicLink(getValues("email"));
      setMagicSent(true);
    } catch {
      toast.error("Não foi possível enviar o link de acesso");
    }
  };

  return (
    <main className="login">
      <form className="card form" onSubmit={onSubmit} noValidate>
        <h1>Entrar em {"{{PROJETO}}"}</h1>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>
        <button type="submit" className="button button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
        <button type="button" className="button button-ghost" onClick={() => void onMagicLink()}>
          Receber link de acesso por e-mail
        </button>
        {magicSent && <p className="state" role="status">Enviamos o link para o seu e-mail.</p>}
      </form>
    </main>
  );
}
