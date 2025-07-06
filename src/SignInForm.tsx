"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Mot de passe invalide. Veuillez réessayer.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Impossible de vous connecter. Voulez-vous créer un compte ?"
                  : "Impossible de créer un compte. Avez-vous déjà un compte ?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <div className="relative">
          <input
            className="auth-input-field w-full"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Mot de passe"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            title={showPassword ? "Cacher le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
          </button>
        </div>
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Se connecter" : "S'inscrire"}
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Vous n'avez pas de compte ? "
              : "Vous avez déjà un compte ? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "S'inscrire" : "Se connecter"}
          </button>
        </div>
      </form>
    </div>
  );
}
