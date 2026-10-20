import { NextResponse } from "next/server";
import { ROOT_CA_CERT_PATH } from "@/mitm/cert/rootCA.js";
import fs from "fs";

export const dynamic = "force-dynamic";

// GET - Download the MITM root CA certificate (PEM) so it can be installed
// on other machines/tools (MI-04). 404 until a CA has been generated.
export async function GET() {
  try {
    if (!fs.existsSync(ROOT_CA_CERT_PATH)) {
      return NextResponse.json(
        { error: "Root CA has not been generated yet" },
        { status: 404 }
      );
    }
    const pem = fs.readFileSync(ROOT_CA_CERT_PATH, "utf8");
    return new NextResponse(pem, {
      status: 200,
      headers: {
        "Content-Type": "application/x-pem-file",
        "Content-Disposition": 'attachment; filename="bansur-router-ca.pem"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.log("Error downloading MITM CA:", error.message);
    return NextResponse.json({ error: "Failed to download CA certificate" }, { status: 500 });
  }
}
