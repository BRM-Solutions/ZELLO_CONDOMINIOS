import { Toaster } from "sonner";
import { useTheme } from "../../hooks/useTheme";

export function AppToaster() {
  const { preference } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      theme={preference}
      className="zl-toaster"
      toastOptions={{
        classNames: {
          toast: "zl-toast",
          description: "zl-toast-description",
          actionButton: "zl-toast-action",
          cancelButton: "zl-toast-cancel",
        },
      }}
    />
  );
}
