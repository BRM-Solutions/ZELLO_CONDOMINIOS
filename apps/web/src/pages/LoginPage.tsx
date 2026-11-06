import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { PLATFORM_NAME, TenantLogo } from "../components/shell/Brand";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import { cx } from "../lib/cx";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres"),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { session, signInWithPassword, signInWithMagicLink } = useAuth();
  const { portalName, legalName, slogan, loginPhotoUrl } = useBranding();
  const location = useLocation();
  const [magicSent, setMagicSent] = useState(false);
  const [formError, setFormError] = useState("");
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
    setFormError("");
    try {
      await signInWithPassword(email, password);
    } catch {
      setFormError("E-mail ou senha incorretos. Confira os dados e tente de novo.");
    }
  });

  const onMagicLink = async () => {
    setFormError("");
    if (!(await trigger("email"))) return;
    try {
      await signInWithMagicLink(getValues("email"));
      setMagicSent(true);
    } catch {
      setFormError("Não foi possível enviar o link de acesso. Tente de novo.");
    }
  };

  return (
    <main className={cx("login", loginPhotoUrl && "login--photo")}>
      {loginPhotoUrl && (
        <div className="login__photo">
          <img src={loginPhotoUrl} alt={legalName || portalName} className="login__photo-img" />
          <div className="login__photo-fade" />
          <div className="login__photo-text">
            <h2 className="login__photo-title">{portalName}</h2>
            {slogan && <p className="login__slogan">{slogan}</p>}
          </div>
        </div>
      )}
      <div className="login__panel">
        <div className="login__box">
          <div className="login__head">
            <TenantLogo size="xl" />
            <h1 className="login__title">{portalName}</h1>
            {legalName && <p className="login__legal">{legalName}</p>}
          </div>
          <form className="login__form" onSubmit={onSubmit} noValidate>
            <Field label="E-mail" error={errors.email?.message}>
              <Input type="email" autoComplete="email" placeholder="voce@email.com" {...register("email")} />
            </Field>
            <Field label="Senha" error={errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...register("password")} />
            </Field>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <Button type="submit" size="lg" block loading={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
            <Button variant="outline" block onClick={() => void onMagicLink()}>
              Receber link de acesso por e-mail
            </Button>
            {magicSent && (
              <p className="muted" role="status">
                Enviamos o link para o seu e-mail.
              </p>
            )}
          </form>
          <p className="login__footer">uma plataforma {PLATFORM_NAME}</p>
        </div>
      </div>
    </main>
  );
}
