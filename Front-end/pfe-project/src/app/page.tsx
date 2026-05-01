"use client";

import { LandingPage } from "@/components/LandingPage";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleGetStarted = () => {
    // Navigate to authentication page
    router.push("/auth");
  };

  return <LandingPage onGetStarted={handleGetStarted} />;
}
