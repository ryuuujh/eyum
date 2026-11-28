import { read_document_options, write_document_selection } from "@/features/accessories/document_routes";

type Context = { params: Promise<{ option_id: string }> };

export async function GET(request: Request, { params }: Context) {
  return read_document_options(request, (await params).option_id);
}

export async function PATCH(request: Request, { params }: Context) {
  return write_document_selection(request, (await params).option_id);
}
