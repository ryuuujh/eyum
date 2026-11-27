import { read_document_options } from "@/features/accessories/document_routes";

export async function GET(request: Request) {
  return read_document_options(request);
}
