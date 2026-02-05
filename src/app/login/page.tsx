import { Header } from "@/components/core/Header";
import { LoginForm } from "@/features/auth/ui/LoginForm";

export default function LoginPage() {
  return (
    <>
      <Header maxWidth="6xl" />
      <main className="flex flex-1 items-center justify-center px-4">
        <LoginForm />
      </main>
    </>
  );
}
