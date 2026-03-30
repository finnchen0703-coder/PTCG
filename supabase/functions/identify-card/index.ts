import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageUrl } = await req.json()
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = "你是一位 TCG 專家。請辨識這張卡片的名稱、語言及編號。請『只回傳』JSON：{\"name\": \"...\", \"language\": \"...\", \"card_code\": \"...\"}"

    const imageResp = await fetch(imageUrl).then(res => res.arrayBuffer())
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: btoa(String.fromCharCode(...new Uint8Array(imageResp))), mimeType: "image/jpeg" } }
    ])

    return new Response(result.response.text(), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})