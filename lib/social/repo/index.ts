/**
 * Social Hub — repository barrel.
 *
 * Single entry point for all DB access (posts, insights, comments). Services and
 * server actions import from here so persistence details stay swappable behind
 * one module boundary.
 */

export * from './automations'
export * from './comments'
export * from './insights'
export * from './posts'
