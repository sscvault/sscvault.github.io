// Supabase Edge Function: notify-subscribers
// Trigger: Database Webhook on INSERT into public.items
// Sends via Brevo Transactional API (free tier ~300 emails/day)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL')! // verified sender in Brevo (can be Gmail)
const FROM_NAME = Deno.env.get('FROM_NAME') || 'College Lost & Found'
const SITE_URL = Deno.env.get('SITE_URL') || 'https://YOUR_USER.github.io/YOUR_REPO'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    // Database Webhook sends { type, table, record, ... }
    const record = payload.record || payload
    if (!record || !record.title) {
      return new Response(JSON.stringify({ error: 'No item record' }), { status: 400 })
    }

    const statusLabel = record.status === 'lost' ? 'LOST' : 'FOUND'
    const statusColor = record.status === 'lost' ? '#D8A2A2' : '#8EA66B'
    const browseUrl = `${SITE_URL.replace(/\/$/, '')}/browse.html`

    const { data: subs, error: subErr } = await supabase
      .from('subscribers')
      .select('email, token')
      .eq('active', true)

    if (subErr) throw subErr
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    const errors: string[] = []

    for (const sub of subs) {
      const unsubUrl = `${SITE_URL.replace(/\/$/, '')}/unsubscribe.html?token=${sub.token}`
      const html = buildEmailHtml({
        statusLabel,
        statusColor,
        title: record.title,
        category: record.category,
        location: record.location,
        item_date: record.item_date,
        description: record.description,
        browseUrl,
        unsubUrl,
      })

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: SENDER_EMAIL },
          to: [{ email: sub.email }],
          subject: `[${statusLabel}] ${record.title} · SSC Vault`,
          htmlContent: html,
        }),
      })

      if (res.ok) {
        sent++
      } else {
        const errText = await res.text()
        console.error('Brevo error for', sub.email, errText)
        errors.push(`${sub.email}: ${errText}`)
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

function escapeHtml(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmailHtml(opts: {
  statusLabel: string
  statusColor: string
  title: string
  category?: string
  location?: string
  item_date?: string
  description?: string
  browseUrl: string
  unsubUrl: string
}) {
  const {
    statusLabel, statusColor, title, category, location,
    item_date, description, browseUrl, unsubUrl,
  } = opts

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FFF9D6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9D6;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8ddd4;">
        <tr>
          <td style="background:${statusColor};color:#fff;padding:16px 24px;font-size:14px;font-weight:700;">
            ${statusLabel} ITEM · SSC Vault
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <h1 style="margin:0 0 12px;font-size:20px;color:#3d3d3d;">${escapeHtml(title)}</h1>
            <p style="margin:0 0 8px;font-size:14px;color:#6b6b6b;line-height:1.6;">
              <strong>Category:</strong> ${escapeHtml(category || '—')}<br>
              <strong>Location:</strong> ${escapeHtml(location || '—')}<br>
              <strong>Date:</strong> ${escapeHtml(item_date || '—')}
            </p>
            ${description ? `<p style="margin:12px 0;font-size:14px;color:#3d3d3d;line-height:1.5;">${escapeHtml(description)}</p>` : ''}
            <p style="margin:20px 0 0;">
              <a href="${browseUrl}" style="display:inline-block;background:#8EA66B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">View on SSC Vault</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#faf6f0;font-size:12px;color:#6b6b6b;border-top:1px solid #e8ddd4;line-height:1.5;">
            Shri Shivaji College of Arts, Commerce and Science<br>
            You received this because you subscribed to SSC Vault alerts.<br>
            <a href="${unsubUrl}" style="color:#8EA66B;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
