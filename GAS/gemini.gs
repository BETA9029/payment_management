/**
 * レシート画像を Gemini API に送信し、情報を構造化（JSON）して取得する
 * @param {GoogleAppsScript.Drive.File} file - ドライブの画像ファイル
 * @return {Object|null} 解析結果のオブジェクト。失敗時は null
 */
function analyzeReceiptWithGemini(file) {
  const apiKey = CONFIG.GEMINI_API_KEY ? CONFIG.GEMINI_API_KEY.trim() : "";
  const model = CONFIG.GEMINI_MODEL ? CONFIG.GEMINI_MODEL.trim() : "gemini-1.5-flash";
  
  if (!apiKey || apiKey === "ここにGeminiのAPIキーを入れる") {
    console.error("Gemini APIキーが設定されていません。");
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // 画像をBase64にエンコード
  const blob = file.getBlob();
  const base64Image = Utilities.base64Encode(blob.getBytes());
  const mimeType = blob.getContentType();

  // Geminiに送るプロンプト
  const prompt = `
あなたは優秀な経理アシスタントです。添付されたレシートまたは領収書の画像を解析し、以下の情報を正確に抽出してください。
抽出結果は、必ず以下の形式のJSONデータのみを出力してください。マークダウンの装飾 (\`\`\`json など) は含めないでください。

【抽出項目】
1. date: 買い物をした日付 (YYYY/MM/DD の形式)
2. storeName: 店舗名 (不明な場合は "不明")
3. sum: 合計 (消費税を含めた合計金額を出してください。)
4. items: 購入した商品のリスト。必ず配列（リスト）形式で、各商品ごとに以下の4つの情報を持たせてください。また、割引に関する記述があればそれも含めてください。
   - name: 商品名
   - quantity: 個数（数値のみ、割引に関するものの場合は1で固定）
   - unitPrice: その商品の「1個あたりの単価」（数値のみ。カンマや円マークは除去、割引に関するものの場合はマイナスで表記）
   - taxRate: 消費税率。レシート全体を見て「税抜表記」だと判断した場合は 0.08 (軽減税率) または 0.1 (標準税率) を、「税込表記」だと判断した場合と割引の際は 0 を指定してください。

【出力JSONの例】
{
  "date": "2026/07/19",
  "storeName": "スーパーABC",
  "sum" : "3000",
  "items": [
    { "name": "牛乳", "quantity": 1, "unitPrice": 200, "taxRate": 0.08 },
    { "name": "洗剤", "quantity": 2, "unitPrice": 200, "taxRate": 0.1 },
    { "name": "パン(税込)", "quantity": 3, "unitPrice": 150, "taxRate": 0 },
    { "name": "割引", "quantity": 1, "unitPrice": -150, "taxRate": 0 }
  ]
}
  `;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      console.error("Gemini API Error:", json.error.message);
      return null;
    }

    // Geminiの返答テキストを取得
    let responseText = json.candidates[0].content.parts[0].text;
    
    // Markdownの ```json や ``` が含まれている場合は除去する
    responseText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    const result = JSON.parse(responseText);
    
    return result;

  } catch (e) {
    console.error("解析中にエラーが発生しました:", e);
    return null;
  }
}
