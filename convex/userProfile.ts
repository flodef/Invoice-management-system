import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get user profile
export const getUserProfile = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query('userProfiles')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();
  },
});

// Update user profile
export const updateUserProfile = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    address: v.string(),
    freelanceId: v.string(),
    iban: v.string(),
    bic: v.string(),
    bank: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert('userProfiles', { userId, ...args });
    }
  },
});
