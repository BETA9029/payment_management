/**
 * 相手への支払い要求ステータス（GASの「相手への支払い要求ステータス」に対応）
 * - なし: 自分が全額負担（相手へ0円請求）
 * - 割り勘: 折半（相手へ50%請求）
 * - 全額: 相手が全額負担（相手へ100%請求）
 */
export type SplitType = "なし" | "割り勘" | "全額";

/**
 * 支払い者（GASの Aさん / Bさん）
 */
export type PayerName = "Aさん" | "Bさん";

/**
 * レシートの商品明細（子データ）
 */
export interface ReceiptItem {
  readonly id: string;
  readonly name: string;           // 商品名
  readonly unitPrice: number;      // 表記単価
  readonly quantity: number;       // 個数
  readonly taxRate: number;        // 消費税率 (0, 0.08, 0.1)
  readonly subtotal: number;       // 税込金額: ROUND(unitPrice * quantity * (1 + taxRate))
  readonly splitType: SplitType;   // 相手への支払い要求ステータス
}

/**
 * レシート・支出情報（親データ）
 */
export interface Receipt {
  readonly id: string;
  readonly date: string;              // 日付 (YYYY-MM-DD)
  readonly storeName: string;         // 店舗名
  readonly totalAmount: number;       // 表記合計金額 (税込)
  readonly payer: PayerName;          // 支払い者
  readonly items: readonly ReceiptItem[]; // 商品明細リスト
  readonly chargeAmount: number;      // 相手への支払い負担額 (GASのJ列相当の計算値)
  readonly receiptImageUrl?: string;  // レシート画像URL (任意)
  readonly targetMonth: string;       // 年月 (YYYY-MM)
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * レシート新規作成時の入力用型
 * （id, createdAt, updatedAt はサーバーで自動採番するため除外）
 */
export type CreateReceiptInput = Omit<Receipt, "id" | "createdAt" | "updatedAt">;

/**
 * 月次精算サマリー（GASのTOTAL行に相当）
 */
export interface SettlementSummary {
  readonly targetMonth: string;
  readonly userAClaim: number;        // Aさんの請求金額合計
  readonly userBClaim: number;        // Bさんの請求金額合計
  readonly payDirectionText: string;  // 例: "Bさん から Aさん に支払う金額"
  readonly payAmount: number;         // 差額 (例: 15000)
}
