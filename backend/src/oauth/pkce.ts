import { createHash, randomBytes } from "node:crypto";

interface PkceData {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePkce(): PkceData {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");

  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return {
    state,
    codeVerifier,
    codeChallenge,
  };
}