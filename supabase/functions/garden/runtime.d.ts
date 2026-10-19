// Minimal platform surface for local tsc; runtime is Supabase's Deno Edge Runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
