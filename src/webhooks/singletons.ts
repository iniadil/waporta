import { WebhookUrlStore } from './store.js'
import { WebhookUrlManager } from './manager.js'
import { WebhookEventDispatcher } from './dispatcher.js'

export const webhookStore = new WebhookUrlStore()
webhookStore.init()
export const webhookManager = new WebhookUrlManager(webhookStore)
export const webhookDispatcher = new WebhookEventDispatcher(webhookManager)
