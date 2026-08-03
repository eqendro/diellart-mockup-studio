import { notFound } from "next/navigation";

import RawImageTestClient from "./RawImageTestClient";

export default function RawImageTestPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <RawImageTestClient />;
}
