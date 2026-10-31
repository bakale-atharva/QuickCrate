/** @param {{deletedAt?: number, lastEventAt?: number, lastProfileUpdatedAt?: number} | null} user @param {string} type @param {number} timestamp @param {number | undefined} updatedAt */
export function eventDecision(user, type, timestamp, updatedAt) {
  if (type === 'user.deleted') return user?.deletedAt !== undefined ? 'ignore' : 'delete';
  if (user?.deletedAt !== undefined) return 'ignore';
  if (user?.lastProfileUpdatedAt !== undefined && updatedAt !== undefined) {
    if (updatedAt < user.lastProfileUpdatedAt || (updatedAt === user.lastProfileUpdatedAt && timestamp <= (user.lastEventAt ?? 0))) return 'ignore';
  } else if (user?.lastEventAt !== undefined && timestamp <= user.lastEventAt) return 'ignore';
  return 'upsert';
}
/** @template {{deletedAt?: number}} T @param {T | null} user @returns {T} */
export function requireActiveUser(user) {
  if (!user || user.deletedAt !== undefined) throw new Error('Unauthorized');
  return user;
}
/** @template {{deletedAt?: number, role?: string}} T @param {T | null} user @returns {T} */
export function requireAdmin(user) {
  const active = requireActiveUser(user);
  if (active.role !== 'admin') throw new Error('Forbidden');
  return active;
}
