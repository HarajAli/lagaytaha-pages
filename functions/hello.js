export function onRequestGet() {
  return new Response("hello works", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
