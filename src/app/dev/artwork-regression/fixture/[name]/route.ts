import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRegressionFixtureName, REGRESSION_FIXTURES } from "../../fixture-config";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { name } = await context.params;
  if (!isRegressionFixtureName(name)) return new Response("Unknown fixture", { status: 404 });
  const fixture = REGRESSION_FIXTURES.find((entry) => entry.name === name)!;
  const bytes = await readFile(path.resolve(process.cwd(), "tests/assets/artwork-regression", name));
  return new Response(bytes, {
    headers: {
      "Content-Type": fixture.mimeType,
      "Cache-Control": "no-store",
    },
  });
}
