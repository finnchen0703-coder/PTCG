import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ✅ 安全版 base64（避免 stack overflow）
function toBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl } = await req.json()

    if (!imageUrl) {
      throw new Error("沒有提供 imageUrl")
    }

    console.log("收到圖片網址:", imageUrl)

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error("找不到 GEMINI_API_KEY（請到 Supabase Secrets 設定）")
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    console.log("正在抓取圖片...")
    const res = await fetch(imageUrl)
    if (!res.ok) {
      throw new Error(`圖片抓取失敗: ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()

    console.log("轉換 base64...")
    const base64Image = toBase64(arrayBuffer)

    console.log("呼叫 Gemini...")
    const prompt = `
你是一位 TCG 專家。

請辨識圖片中的卡片資訊。

⚠️ 嚴格規則：
- 只能回傳 JSON
- 不要 markdown
- 不要解釋

格式：
{"name": "...", "language": "...", "card_code": "..."}
`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      }
    ])

    let text = result.response.text()

    console.log("AI 原始回傳:", text)

    // ✅ 清理 ```json ``` 包裝
    text = text.replace(/```json|```/g, "").trim()

    console.log("清理後 JSON:", text)

    return new Response(text, {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error("錯誤:", err)

    return new Response(JSON.stringify({
      error: err.message || "未知錯誤"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})