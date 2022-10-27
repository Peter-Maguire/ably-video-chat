

/**
 * gunzips a base64 string and returns a string
 * @param input
 */
export async function decompress(input: string): Promise<string>{
  // The use of CompressionStream/DecompressionStream here limits this library to only being usable in Chrome
  // There is a library that can be used in place of this (fflate) but there was an issue with it that I didn't
  // have time to figure out. So for POC purposes, we are using draft APIs.
  //@ts-ignore
  const cs = new DecompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(Uint8Array.from(atob(input), c => c.charCodeAt(0)));
  writer.close();
  return new Response(cs.readable).arrayBuffer().then(function (arrayBuffer) {
    return new TextDecoder().decode(arrayBuffer);
  });
}

/**
 * gzips a string and returns a base64 string
 * @param input
 */
export async function compress(input: string): Promise<string>{
    const byteArray = new TextEncoder().encode(input);
    //@ts-ignore
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(byteArray);
    writer.close();
    return btoa(String.fromCharCode(...new Uint8Array(await new Response(cs.readable).arrayBuffer())));
}
