import { NextRequest, NextResponse } from "next/server";

interface VerifyLinkResult {
  status: "valid" | "warning" | "error";
  message?: string;
}

/**
 * API endpoint to do basic URL validation.
 * Since many UN document sites require authentication, we only do basic checks here.
 * The actual document verification is done client-side via iframe preview.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json<VerifyLinkResult>(
        { status: "error", message: "URL parameter is required" },
        { status: 400 },
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json<VerifyLinkResult>({
        status: "error",
        message: "Invalid URL format",
      });
    }

    // Check protocol
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json<VerifyLinkResult>({
        status: "error",
        message: "URL must use HTTP or HTTPS",
      });
    }

    // Known trusted UN document domains
    const trustedDomains = [
      "docs.un.org",
      "documents.un.org",
      "undocs.org",
      "digitallibrary.un.org",
      "documents-dds-ny.un.org",
      "unescwa.org",
      "unece.org",
      "unctad.org",
      "unep.org",
    ];

    const isTrustedDomain = trustedDomains.some((domain) =>
      parsedUrl.hostname.includes(domain),
    );

    // Check for document-like patterns in URL
    const hasDocPattern =
      /\.(pdf|docx?|odt)$/i.test(parsedUrl.pathname) ||
      /\/[A-Z]\/\d+\/\d+/i.test(parsedUrl.pathname) || // UN document symbol pattern like /A/78/706
      /\/[A-Z]\/RES\//i.test(parsedUrl.pathname); // Resolution pattern

    if (isTrustedDomain) {
      return NextResponse.json<VerifyLinkResult>({
        status: "valid",
        message:
          "Recognized UN document source. Please verify the document loads correctly in the preview below.",
      });
    }

    if (hasDocPattern) {
      return NextResponse.json<VerifyLinkResult>({
        status: "valid",
        message:
          "URL appears to point to a document. Please verify it loads correctly in the preview below.",
      });
    }

    // Generic URL - warn user to verify
    return NextResponse.json<VerifyLinkResult>({
      status: "warning",
      message:
        "Please verify the document loads correctly in the preview below.",
    });
  } catch (error) {
    console.error("Error verifying link:", error);
    return NextResponse.json<VerifyLinkResult>(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
