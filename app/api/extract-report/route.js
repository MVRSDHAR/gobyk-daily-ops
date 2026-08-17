import { NextResponse } from 'next/server';

const FIELDS = [
  'inward_volume', 'delivered_volume', 'revenue', 'amc_count', 'google_reviews',
  'cash', 'card', 'scan', 'neft', 'paytm', 'credit', 'advance',
  'third_party_revenue', 'parts', 'labour',
  'counter_sale_volume', 'counter_sale_revenue', 'scheme_7rs_count',
  'vehicle_2w_volume', 'vehicle_2w_revenue', 'vehicle_4w_volume', 'vehicle_4w_revenue',
];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file) {
      return NextResponse.json({ error: 'No image received' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const prompt = `You are reading a photographed daily workshop report. Extract these numeric fields if visible: ${FIELDS.join(', ')}.

Rules:
- Return ONLY a JSON object, no other text, no markdown formatting.
- Use exactly these field names as keys.
- If a field is not visible or not present in the photo, set its value to null.
- Numbers only, no currency symbols or commas.
- Also include a "confidence_notes" field: a short plain-English note on anything unclear, blurry, or uncertain.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Image } },
              ],
            },
          ],
        }),
      }
    );

    const result = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return NextResponse.json(
        { error: 'Gemini API error', details: result },
        { status: 502 }
      );
    }

    let text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json|```/g, '').trim();

    let extracted;
    try {
      extracted = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: 'Could not parse AI response', raw: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ extracted });
  } catch (err) {
    return NextResponse.json(
      { error: 'Server error', details: String(err) },
      { status: 500 }
    );
  }
}