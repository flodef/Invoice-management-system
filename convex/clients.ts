import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get all clients
export const getClients = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query('clients')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
  },
});

// Add/update client
export const saveClient = mutation({
  args: {
    id: v.optional(v.id('clients')),
    name: v.string(),
    contactName: v.string(),
    address: v.string(),
    email: v.string(),
    legalForm: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const { id, ...clientData } = args;

    if (id) {
      await ctx.db.patch(id, clientData);
      return id;
    } else {
      return await ctx.db.insert('clients', { userId, ...clientData });
    }
  },
});

// Delete client
export const deleteClient = mutation({
  args: { id: v.id('clients') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const client = await ctx.db.get(args.id);
    if (!client || client.userId !== userId) {
      throw new Error('Client not found');
    }

    await ctx.db.delete(args.id);
  },
});

// Toggle client status
export const toggleClientStatus = mutation({
  args: {
    id: v.id('clients'),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const client = await ctx.db.get(args.id);
    if (!client || client.userId !== userId) {
      throw new Error('Client not found');
    }

    await ctx.db.patch(args.id, { isActive: !args.isActive });
  },
});
