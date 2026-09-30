// Supabase Edge Function — sends email notifications via Resend
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    if (!record || !record.description) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    const { description, amount, paid_by, category } = record

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Expense Tracker <onboarding@resend.dev>',
        to: 'himanshusinghadia1@gmail.com',
        subject: `New Expense Added: ${description}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f1f5f9;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px;">
              <h2 style="color: #6366f1;">💰 New Expense Added</h2>
              <p><strong>Description:</strong> ${description}</p>
              <p><strong>Amount:</strong> ₹${amount}</p>
              <p><strong>Category:</strong> ${category || 'Other'}</p>
              <p><strong>Paid by:</strong> ${paid_by}</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 13px;">Automated notification from your Expense Tracker.</p>
            </div>
          </div>
        `
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})