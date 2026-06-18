"use client";

import dynamic from "next/dynamic";

const InvoiceManagement = dynamic(
  () => import("@/components/InvoiceManagement").then((mod) => mod.InvoiceManagement),
  { ssr: false }
);

export default function InvoicesPage() {
  return <InvoiceManagement />;
}
