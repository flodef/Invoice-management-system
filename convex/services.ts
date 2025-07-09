import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get all services
export const getServices = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query('services')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
  },
});

// Add/update service
export const saveService = mutation({
  args: {
    id: v.optional(v.id('services')),
    label: v.string(),
    defaultPrice: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const { id, ...serviceData } = args;

    if (id) {
      await ctx.db.patch(id, serviceData);

      return id;
    } else {
      return await ctx.db.insert('services', { userId, ...serviceData });
    }
  },
});

// Delete service
export const deleteService = mutation({
  args: { id: v.id('services') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const service = await ctx.db.get(args.id);
    if (!service || service.userId !== userId) {
      throw new Error('Service not found');
    }

    await ctx.db.delete(args.id);
  },
});

// Toggle service status
export const toggleServiceStatus = mutation({
  args: {
    id: v.id('services'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const service = await ctx.db.get(args.id);
    if (!service || service.userId !== userId) {
      throw new Error('Service not found');
    }

    await ctx.db.patch(args.id, { isActive: !args.isActive });
  },
});
