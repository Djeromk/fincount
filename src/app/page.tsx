import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <Link href="/login">Login</Link>
      <Link href="/">Dashboard</Link>
    </div>
  );
}
