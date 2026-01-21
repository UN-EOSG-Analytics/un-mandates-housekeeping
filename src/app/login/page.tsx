import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";

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
