/** Server-side guard: no demo code can open a network connection. */
export async function register() {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ demo: true, data: [], items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Doscientos-Demo': 'local' },
    })
}