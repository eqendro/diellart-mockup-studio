import { notFound } from "next/navigation";
import ArtworkRegressionClient from "./ArtworkRegressionClient";

export default function ArtworkRegressionPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ArtworkRegressionClient />;
}
