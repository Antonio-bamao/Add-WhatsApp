const fs = require('node:fs');
const path = require('node:path');

class PendingCloudSyncStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  list() {
    return this.#read().items;
  }

  upsert(item) {
    const payload = this.#read();
    const taskId = String(item && item.taskId ? item.taskId : '');
    if (!taskId) throw new Error('PENDING_SYNC_TASK_REQUIRED');
    const existingItem = payload.items.find(existing => existing.taskId === taskId) || {};
    const hasBillingSessionId = Object.prototype.hasOwnProperty.call(item || {}, 'billingSessionId');
    const hasBillingPolicySnapshot = Object.prototype.hasOwnProperty.call(item || {}, 'billingPolicySnapshot');
    const nextItem = {
      taskId,
      billingSessionId: hasBillingSessionId ? item.billingSessionId || null : existingItem.billingSessionId || null,
      billingPolicySnapshot: hasBillingPolicySnapshot ? item.billingPolicySnapshot || null : existingItem.billingPolicySnapshot || null,
      sentRows: Array.isArray(item.sentRows) ? item.sentRows : [],
      workspaceId: item.workspaceId || 'main',
      sentAt: item.sentAt || new Date().toISOString(),
      reason: item.reason || 'UNKNOWN',
      updatedAt: new Date().toISOString()
    };
    const index = payload.items.findIndex(existing => existing.taskId === taskId);
    if (index >= 0) {
      payload.items[index] = { ...payload.items[index], ...nextItem };
    } else {
      payload.items.push({ ...nextItem, createdAt: nextItem.updatedAt });
    }
    this.#write(payload);
    return nextItem;
  }

  remove(taskId) {
    const payload = this.#read();
    const nextItems = payload.items.filter(item => item.taskId !== taskId);
    if (nextItems.length === payload.items.length) return;
    this.#write({ items: nextItems });
  }

  #read() {
    try {
      if (!fs.existsSync(this.filePath)) return { items: [] };
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return { items: Array.isArray(parsed.items) ? parsed.items : [] };
    } catch {
      return { items: [] };
    }
  }

  #write(payload) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({ items: payload.items || [] }, null, 2));
  }
}

module.exports = {
  PendingCloudSyncStore
};
