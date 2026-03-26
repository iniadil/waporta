import nodemailer from 'nodemailer'

export interface FailureDetails {
  sessionId: string
  to: string
  messageType: 'text' | 'image' | 'document'
  error: string
  attempts: number
  timestamp: string
}

export interface Notifier {
  name: string
  notify(details: FailureDetails): Promise<void>
}

class EmailNotifier implements Notifier {
  name = 'email'
  private transporter: ReturnType<typeof nodemailer.createTransport>
  private recipient: string

  constructor(config: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string
  }) {
    this.recipient = config.to
    this.transporter = nodemailer.createTransport(
      {
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      },
      { from: config.from }
    )
  }

  async notify(details: FailureDetails): Promise<void> {
    await this.transporter.sendMail({
      to: this.recipient,
      subject: `[WaPorta] Message delivery failed — Session: ${details.sessionId}`,
      text: [
        `Session   : ${details.sessionId}`,
        `Recipient : ${details.to}`,
        `Type      : ${details.messageType}`,
        `Attempts  : ${details.attempts}`,
        `Error     : ${details.error}`,
        `Time      : ${details.timestamp}`,
      ].join('\n'),
    })
  }
}

class WebhookNotifier implements Notifier {
  name = 'webhook'
  constructor(private url: string) {}

  async notify(details: FailureDetails): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    })
  }
}

export class NotifierRegistry {
  private notifiers: Notifier[] = []

  register(notifier: Notifier) {
    this.notifiers.push(notifier)
    console.log(`[notifier] registered: ${notifier.name}`)
  }

  async notifyAll(details: FailureDetails): Promise<void> {
    if (this.notifiers.length === 0) return
    const results = await Promise.allSettled(
      this.notifiers.map((n) => n.notify(details))
    )
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        console.error(
          `[notifier] ${this.notifiers[i].name} failed:`,
          result.reason
        )
      }
    }
  }
}

function createRegistry(): NotifierRegistry {
  const registry = new NotifierRegistry()

  const smtpHost = process.env.SMTP_HOST
  const notifyEmail = process.env.NOTIFY_EMAIL
  if (smtpHost && notifyEmail) {
    registry.register(
      new EmailNotifier({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'waporta@localhost',
        to: notifyEmail,
      })
    )
  }

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL
  if (webhookUrl) {
    registry.register(new WebhookNotifier(webhookUrl))
  }

  return registry
}

export const registry = createRegistry()
