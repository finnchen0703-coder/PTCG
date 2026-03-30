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
    console.log("收到圖片網址:", imageUrl)

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error("雲端找不到 GEMINI_API_KEY，請檢查 Secrets 設定")

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    console.log("正在抓取圖片內容...")
    const imageResp = await fetch(imageUrl)
    if (!imageResp.ok) throw new Error(`無法抓取圖片: ${imageResp.statusText}`)
    
    const arrayBuffer = await imageResp.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    console.log("正在呼叫 Gemini AI...")
    const prompt = "你是一位 TCG 專家。請辨識這張卡片的名稱、語言及編號。請只回傳 JSON：{\"name\": \"...\", \"language\": \"...\", \"card_code\": \"...\"}"

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
    ])

    const responseText = result.response.text()
    console.log("AI 回傳成功:", responseText)

    return new Response(responseText, { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })

  } catch (err) {
    console.error("崩潰原因:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    })
  }
})