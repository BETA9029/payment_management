/**
 * メインの処理関数。
 * タイマートリガー（1日1回など）でこの関数を実行するように設定します。
 */
function processReceipts() {
  Logger.log("レシート処理を開始します。");

  // Aさんのフォルダを処理
  processFolder(CONFIG.FOLDER_ID_USER_A, CONFIG.USER_A_NAME, CONFIG.FOLDER_ID_PROCESSED_A);
  
  // Bさんのフォルダを処理
  processFolder(CONFIG.FOLDER_ID_USER_B, CONFIG.USER_B_NAME, CONFIG.FOLDER_ID_PROCESSED_B);

  Logger.log("レシート処理が完了しました。");
}

/**
 * 指定されたフォルダ内の画像を処理する
 * @param {string} folderId
 * @param {string} payerName 
 * @param {string} processedFolderIdOrUrl
 */
function processFolder(folderId, payerName, processedFolderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const processedFolder = DriveApp.getFolderById(processedFolderId);
  
  while (files.hasNext()) {
    const file = files.next();
    const mimeType = file.getMimeType();

    // 画像ファイルのみを対象とする
    if (!mimeType.startsWith("image/")) {
      continue;
    }
    Logger.log(`処理中: ${file.getName()} (${payerName}のレシート)`);

    // 1. Gemini APIで解析
    const extractedData = analyzeReceiptWithGemini(file);
    if (!extractedData) {
      continue;
    }
    // 2. スプレッドシートに追記
    appendRecordToSheet(extractedData, payerName, file.getUrl());
    Logger.log(`スプレッドシートに追記完了: ${file.getName()}`);

    // 3. 処理済みフォルダへ移動 (フォルダが設定されている場合)
    // 月別フォルダの名前を決定
    let targetMonth = "";
    if (extractedData.date && extractedData.date.match(/^\d{4}[\/\-]\d{2}/)) {
      targetMonth = extractedData.date.substring(0, 7).replace("/", "-");
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      targetMonth = `${yyyy}-${mm}`;
    }
    
    // 月別フォルダを検索・作成
    let monthFolder = null;
    const folders = processedFolder.getFoldersByName(targetMonth);
    if (folders.hasNext()) {
      monthFolder = folders.next();
    } else {
      monthFolder = processedFolder.createFolder(targetMonth);
    }
    
    file.moveTo(monthFolder);
    Logger.log(`月別処理済みフォルダ(${targetMonth})へ移動: ${file.getName()}`);
  }
}
