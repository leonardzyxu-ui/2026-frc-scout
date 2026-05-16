export const ADMIN_HASH = 'f51017681489feaa432c4f86ceb66aae7bf383ed137b75ae9eeeea61e616af02';

export async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAdminPassword(password: string) {
  const hash = await sha256(password);
  return hash === ADMIN_HASH;
}
