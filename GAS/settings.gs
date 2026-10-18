/**
 * スプレッドシートに抽出したレシートデータを記録する
 * @param {Object} data - Gemini API から取得した抽出データ
 * @param {string} payerName - 支払い者 (Aさん or Bさん)
 * @param {string} fileUrl - 画像ファイルのURL
 */
function appendRecordToSheet(data, payerName, fileUrl) {
  const sheetId = CONFIG.SPREADSHEET_ID;

  // シート名（タブ名）を処理対象の年月(YYYY-MM)から生成
  // レシートの日付がある場合はそこから、ない場合は現在の日付を使用
  let targetMonth = "";
  if (data.date && data.date.match(/^\d{4}[\/\-]\d{2}/)) {
    targetMonth = data.date.substring(0, 7).replace("/", "-");
  } else {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    targetMonth = `${yyyy}-${mm}`;
  }
  const sheetName = targetMonth;

  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(sheetName);
  
  // シートが存在しない場合は新規作成してヘッダーをセット
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    createfirstRow(sheet);
  }

  // レシートに含まれる商品のリスト（配列でない場合は配列化するフォールバック）
  let items = data.items || [];
  if (!Array.isArray(items)) {
    items = [{ name: String(items), quantity: 1, unitPrice: data.totalAmount || 0, taxRate: 0 }];
  }
  if (items.length === 0) {
    items = [{ name: "商品不明", quantity: 1, unitPrice: data.totalAmount || 0, taxRate: 0 }];
  }

  // 現在の最終行を確認
  const lastRow = sheet.getLastRow();
  const targetRow = lastRow + 1;

  // IDの採番（直前の行のID + 1）
  let nextId = 1;
  if (targetRow > 4) {
    const prevId = sheet.getRange(lastRow - 1, 1).getValue();
    if (!isNaN(prevId) && prevId > 0) {
      nextId = Number(prevId) + 1;
    }
  }

  // 複数行のデータを構築
  const records = items.map((item, index) => {
    const currentRow = targetRow + index;
    return [
      nextId, // A: ID
      data.date || "", // B: 日付
      data.storeName || "", // C: 店舗名
      item.name || "", // D: 商品
      item.unitPrice || 0, // E: 単価
      item.quantity || 1, // F: 個数
      item.taxRate, // G: 消費税率 (手動変更可能)
      `=ROUND(E${currentRow} * F${currentRow} * (1 + G${currentRow}))`,
      data.sum, // I: 合計金額
      data.sum,
      payerName, // J: 支払い者
      "割り勘", // K: 
      fileUrl // L: レシートURL
    ];
  });

  const recordsLength = records.length;
  const lastRecordLow = targetRow + records.length -1;

  // レコードの一括書き込み
  sheet.getRange(targetRow, 1, recordsLength, 13).setValues(records);

  const paymentSum = `=I${targetRow} 
      - SUMIF(L${targetRow}:L${lastRecordLow}, "なし", H${targetRow}:H${lastRecordLow}) 
      - SUMIF(L${targetRow}:L${lastRecordLow}, "割り勘", H${targetRow}:H${lastRecordLow})/2`;

  sheet.getRange(targetRow, 10, recordsLength, 1).setFormula(paymentSum)

  //チェックボックスを作成
  // 2. 選択肢の配列を用意
  const options = ["なし", "割り勘", "全額"];
  const taxOptions = [0, 0.08, 0.1];
  
  // 3. 入力規則（プルダウンルール）を構築
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true) // 第1引数に配列、第2引数をtrueで矢印を表示
    .setAllowInvalid(false)            // リスト以外の直接入力を拒否（エラーにする）
    .setHelpText("リストの中から選択してください") // 無効な値が入った場合のアラート表示設定
    .build();

  sheet.getRange(targetRow, 12, recordsLength, 1).setDataValidation(rule);// 11列目(K列)

  const taxRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(taxOptions, true) // 第1引数に配列、第2引数をtrueで矢印を表示
    .setAllowInvalid(false)            // リスト以外の直接入力を拒否（エラーにする）
    .setHelpText("リストの中から選択してください") // 無効な値が入った場合のアラート表示設定
    .build();

  sheet.getRange(targetRow, 7, recordsLength, 1).setDataValidation(taxRule);

  //セルを結合
  sheet.getRange(targetRow, 1, recordsLength, 1).merge();
  sheet.getRange(targetRow, 2, recordsLength, 1).merge();
  sheet.getRange(targetRow, 3, recordsLength, 1).merge();
  sheet.getRange(targetRow, 9, recordsLength, 1).merge();
  sheet.getRange(targetRow, 10, recordsLength, 1).merge();
  sheet.getRange(targetRow, 13, recordsLength, 1).merge();

  // 消費税率の列(H列)をパーセント表示にフォーマット
  //sheet.getRange(targetRow, 7, recordsLength, 1).setNumberFormat("0%");
}

/**
 * シートの初回作成時にヘッダーなどのテンプレートを作成
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet 
 */
function createfirstRow(sheet) {
  const userA = CONFIG.USER_A_NAME;
  const userB = CONFIG.USER_B_NAME;

  // J列(支払い者)を条件にして、I列(税込金額)の合計を出す数式
  const userASumformula = `=SUMIF(K:K, "${userA}", J:J)`;
  const userBSumformula = `=SUMIF(K:K, "${userB}", J:J)`;
  const payTextformula =`=if(B2 > C2, "${userB} から ${userA} に支払う金額", "${userA}から${userB}に支払う金額")`;
  const paySumformula = `=ABS(B2 - C2)`;

  // TOTAL行のセット
  sheet.getRange(1, 1).setValue("TOTAL").setFontWeight("bold");
  sheet.getRange(1, 2).setValue(`${userA} の請求金額`).setHorizontalAlignment("right");
  sheet.getRange(2, 2).setFormula(userASumformula);
  
  sheet.getRange(1, 3).setValue(`${userB} の請求金額`).setHorizontalAlignment("right");
  sheet.getRange(2, 3).setFormula(userBSumformula);

  sheet.getRange(1, 4).setFormula(payTextformula);
  sheet.getRange(2, 4).setFormula(paySumformula);
  
  // 背景色をつけて目立たせる (A列からK列まで 11列分)
  sheet.getRange(1, 1, 1, 12).setBackground("#fff2cc");

  const headers = ["ID", "日付", "店舗名", "商品", "表記単価", "個数", "加算する消費税率", "税込金額", "表記合計金額", "支払い負担額" , "支払い者", "相手への支払い要求ステータス",  "レシートURL"];
  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(4, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");
  sheet.getRange("A:L").setVerticalAlignment("middle");
}
