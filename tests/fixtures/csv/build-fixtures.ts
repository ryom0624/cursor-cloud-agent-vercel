import * as Encoding from "encoding-japanese";
import { encodeCsvText, encodeUtf16 } from "../../../lib/csv-utils-beta";

export function utf8(text: string, bom = false) {
  return encodeCsvText(text, "utf-8", bom).bytes;
}

export function sjis(text: string) {
  return Uint8Array.from(Encoding.convert(Encoding.stringToCode(text), {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  }) as number[]);
}

export function eucJp(text: string) {
  return Uint8Array.from(Encoding.convert(Encoding.stringToCode(text), {
    from: "UNICODE",
    to: "EUCJP",
    type: "array",
  }) as number[]);
}

export function iso2022jp(text: string) {
  return Uint8Array.from(Encoding.convert(Encoding.stringToCode(text), {
    from: "UNICODE",
    to: "JIS",
    type: "array",
  }) as number[]);
}

export function utf16le(text: string, bom = true) {
  return encodeUtf16(text, true, bom);
}

export function utf16be(text: string, bom = true) {
  return encodeUtf16(text, false, bom);
}

export const texts = {
  ascii: "id,name\n1,Taro\n2,Hanako",
  japaneseLf: "id,name\n1,東京都\n2,開発",
  japaneseCrlf: "id,name\r\n1,東京都\r\n2,開発",
  jtcNames: "社員コード,氏名,所属,備考\n000001,髙橋 太郎,第一営業部,㈱テスト担当\n000002,﨑山 花子,総務部,①確認済\n000003,山田 半角,ｶﾀｶﾅ営業部,半角ｶﾅ",
  personHell: "name\n髙橋\n高橋\n﨑山\n崎山\n𠮷田\n吉田",
  sjisUnsafe: "id,name\n1,𠮷田\n2,😀\n3,𩸽",
  utf16Names: "id,name,note\n1,髙橋,😀\n2,𠮷田,①",
  leadingZero: "id,value\n1,00123\n2,0000000001\n3,09012345678",
  longInt: "id,value\n1,123456789012345\n2,1234567890123456\n3,123456789012345678",
  formulas: "id,note\n1,=1+1\n2,+SUM(A1:A2)\n3,-cmd\n4,@external\n5,*test\n6,＝1+1\n7,＋cmd\n8,－cmd\n9,＠external",
  quotedMultilineCrlf: "id,memo\r\n1,\"line1\nline2\"\r\n2,\"normal\"\r\n",
  quotedMultilineLf: "id,memo\n1,\"line1\r\nline2\"\n2,\"normal\"\n",
  quotedMultilineCr: "id,memo\r1,\"line1\nline2\"\r2,\"normal\"\r",
  realMixed: "id,name\r\n1,A\n2,B\r\n3,C",
  duplicateHeader: "code,name,code,name\nA,山田,B,佐藤",
  blankHeader: "code,,name,\n1,x,y,z",
  caseHeader: "name,Name,NAME\n1,2,3",
  jpDuplicateHeader: "コード,名称,コード,名称\nA,商品,B,部品",
  uneven: "a,b,c\n1,2,3\n4,5\n6,7,8,9",
  trailingEmpty: "a,b,c,\n1,2,3,\n4,5,6,",
  emptyRows: "a,b\n\n1,2\n\n\n3,4\n",
  sepDirective: "sep=;\nid;name\n1;test",
  headerOnly: "id,name,status",
  oneColumn: "name\nTaro\nHanako",
  accounting: "伝票番号,日付,借方科目,借方金額,貸方科目,貸方金額,摘要\n000001,2026/09/01,普通預金,\"1,234,567\",売上高,\"1,234,567\",\"A社,9月売上\"",
  hr: "社員番号,氏名,郵便番号,電話番号,入社日,メール\n00001234,髙橋 太郎,001-0001,090-0000-0001,2020/04/01,takahashi@example.invalid",
  jan: "JANコード,商品コード,商品名,価格\n4901234567890,000123,\"商品A,特別版\",1200",
  dates: "value\n2026-09-12\n2026/09/12\n09-12\n9/12\n12-09\n1-2\n20260912\n令和8年9月12日",
  scientific: "value\n1E10\n1e10\n123E5\n1E+10\n1E-10",
  nullish: "value\nNULL\nnull\nN/A\nNA\n-\n0\n\"\"",
  delimiterConflict: "id,name,comment\n1,A,\"aaa;bbb|ccc\"\n2,B,\"ddd;eee|fff\"",
  spaceAccident: "id name note\n1 John \"hello world\"",
  unclosed: "1,\"abc\n2,def",
  escapedQuote: "1,\"彼は\"\"OK\"\"と言った\"",
  nfcNfd: "value\nCafe\u0301\nCafé",
};
