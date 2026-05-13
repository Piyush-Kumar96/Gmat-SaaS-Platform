import { IUser } from '../models/User';
import { HydratedDocument } from 'mongoose';

type UserDoc = HydratedDocument<IUser>;

const PAID_ROLES = ['monthly_pack', 'quarterly_pack', 'annual_pack'] as const;
type PaidRole = typeof PAID_ROLES[number];

const isPaidRole = (role: string): role is PaidRole =>
  (PAID_ROLES as readonly string[]).includes(role);

/**
 * Downgrade a paid user whose plan has expired back to `registered`.
 *
 * Runs on every authenticated request so an expired user can never make
 * another paid-tier call after their endDate. Admins are never downgraded.
 * Mutates and persists the user document if a downgrade happens, then
 * returns the updated doc; otherwise returns the original.
 */
export async function downgradeIfExpired<T extends UserDoc | null>(user: T): Promise<T> {
  if (!user) return user;
  if (user.role === 'admin') return user;
  if (!isPaidRole(user.role)) return user;

  const endDate = user.planInfo?.endDate;
  if (!endDate) return user;

  if (new Date(endDate).getTime() > Date.now()) return user;

  user.role = 'registered';
  user.subscriptionPlan = 'free_mock';
  user.mockTestLimit = 2;
  if (user.planInfo) {
    user.planInfo.plan = 'free_mock';
    user.planInfo.isActive = false;
  }
  await user.save();
  return user;
}
